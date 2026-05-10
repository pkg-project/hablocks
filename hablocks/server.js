'use strict';
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');

const BACKEND_PORT = 8765;
const HA_WS_URL = 'ws://supervisor/core/websocket';
const TOKEN_FILE = '/data/ha_token';
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || '';

// ── State ────────────────────────────────────────────────────
let haWs = null, haConnected = false, haToken = null, haMsgId = 1;
const haPending = new Map();
const haEventSubs = new Map();
const entityStates = new Map();
const runningScripts = new Map();
const clients = new Set();
const logBuffer = []; // last 300 log lines, sent to new browser clients

// Load saved token
if (fs.existsSync(TOKEN_FILE)) {
  try { haToken = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch {}
}

// ── Helpers ──────────────────────────────────────────────────
function sysLog(msg) { console.log('[Backend]', msg); }

function broadcast(msg) {
  if (msg.type === 'log') { logBuffer.push(msg); if (logBuffer.length > 300) logBuffer.shift(); }
  const s = JSON.stringify(msg);
  for (const c of clients) try { c.send(s); } catch {}
}

// ── HA WebSocket ─────────────────────────────────────────────
function haConnect(token) {
  return new Promise((resolve, reject) => {
    if (haConnected) { resolve(); return; }
    const ws = new WebSocket(HA_WS_URL, { headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` } });
    let settled = false;
    const settle = err => { if (settled) return; settled = true; err ? reject(err) : resolve(); };

    sysLog('Connecting to HA at ' + HA_WS_URL + ' (supervisor token: ' + (SUPERVISOR_TOKEN ? 'present' : 'MISSING') + ')');
    ws.on('open', () => sysLog('HA WS open'));
    ws.on('message', data => {
      let m; try { m = JSON.parse(data); } catch { return; }
      if (m.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      } else if (m.type === 'auth_ok') {
        haWs = ws; haConnected = true; haToken = token;
        try { fs.writeFileSync(TOKEN_FILE, token); } catch {}
        sysLog('HA authenticated');
        const sid = haMsgId++;
        ws.send(JSON.stringify({ id: sid, type: 'subscribe_events', event_type: 'state_changed' }));
        haEventSubs.set(sid, ev => {
          const eid = ev.data?.entity_id;
          if (eid) { if (ev.data.new_state) entityStates.set(eid, ev.data.new_state); else entityStates.delete(eid); }
          broadcast({ type: 'state_changed', data: ev });
          for (const sc of runningScripts.values()) sc.onSC(ev);
        });
        haCall({ type: 'get_states' }).then(states => {
          entityStates.clear(); states.forEach(s => entityStates.set(s.entity_id, s));
          broadcast({ type: 'states', data: states });
        }).catch(e => sysLog('get_states failed: ' + e.message));
        broadcast({ type: 'ha_status', status: 'connected' });
        settle();
      } else if (m.type === 'auth_invalid') {
        settle(new Error(m.message || 'Auth failed')); ws.close();
      } else if (m.type === 'result') {
        const p = haPending.get(m.id);
        if (p) { haPending.delete(m.id); m.success ? p.resolve(m.result) : p.reject(new Error(m.error?.message || 'HA error')); }
      } else if (m.type === 'event') {
        const h = haEventSubs.get(m.id); if (h) h(m.event);
      }
    });
    ws.on('close', () => {
      sysLog('HA WS closed'); haWs = null; haConnected = false;
      settle(new Error('Connection closed'));
      broadcast({ type: 'ha_status', status: 'disconnected' });
      if (haToken) setTimeout(() => haConnect(haToken).catch(() => {}), 5000);
    });
    ws.on('error', e => { sysLog('HA WS error: ' + e.message); settle(new Error('WebSocket error: ' + e.message)); });
  });
}

function haCall(payload) {
  return new Promise((resolve, reject) => {
    if (!haConnected || !haWs) { reject(new Error('Not connected to HA')); return; }
    const id = haMsgId++;
    haPending.set(id, { resolve, reject });
    haWs.send(JSON.stringify({ id, ...payload }));
    setTimeout(() => { if (haPending.has(id)) { haPending.delete(id); reject(new Error('Timeout')); } }, 10000);
  });
}

// ── Pattern matching ─────────────────────────────────────────
function eMatch(p, eid) {
  if (!eid) return false;
  if (p === '*') return true;
  if (p instanceof RegExp) return p.test(eid);
  if (p === eid) return true;
  if (typeof p === 'string' && (p.includes('*') || p.includes('?')))
    return new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$').test(eid);
  return false;
}

// ── Cron ─────────────────────────────────────────────────────
function pCF(f, mn, mx) {
  if (f === '*') return null;
  const s = new Set();
  for (const p of f.split(',')) {
    if (p.includes('/')) {
      const [r, st] = p.split('/'); let a = mn, b = mx;
      if (r !== '*') { if (r.includes('-')) [a, b] = r.split('-').map(Number); else { a = +r; b = mx; } }
      for (let i = a; i <= b; i += +st) s.add(i);
    } else if (p.includes('-')) { const [a, b] = p.split('-').map(Number); for (let i = a; i <= b; i++) s.add(i); }
    else s.add(+p);
  }
  return s;
}
function pCron(s) {
  const p = s.trim().split(/\s+/);
  if (p.length !== 5) throw new Error('5 cron fields needed');
  return { mi: pCF(p[0], 0, 59), hr: pCF(p[1], 0, 23), d: pCF(p[2], 1, 31), mo: pCF(p[3], 1, 12), dw: pCF(p[4], 0, 6) };
}
function cMatch(c, d) {
  return [[c.mi, d.getMinutes()], [c.hr, d.getHours()], [c.d, d.getDate()], [c.mo, d.getMonth() + 1], [c.dw, d.getDay()]].every(([s, v]) => s === null || s.has(v));
}

// ── Sun times ─────────────────────────────────────────────────
function sunTimes(lat, lng, date) {
  const r = Math.PI / 180, dMs = 864e5;
  const tJ = d => d.valueOf() / dMs - 0.5 + 2440588, fJ = j => new Date((j + 0.5 - 2440588) * dMs), tD = d => tJ(d) - 2451545;
  const sMA = d => r * (357.5291 + 0.98560028 * d), eL = M => { const C = r * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)); return M + C + r * 282.9372 + Math.PI; };
  const dec = l => Math.asin(Math.sin(r * 23.4397) * Math.sin(l));
  const lw = r * -lng, phi = r * lat, d = tD(date || new Date()), n = Math.round(d - 0.0009 - lw / (2 * Math.PI)), ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = sMA(ds), L = eL(M), dc = dec(L), Jn = 2451545 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const hA = h => Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dc)) / (Math.cos(phi) * Math.cos(dc)));
  const res = { noon: fJ(Jn) };
  try { const w = hA(r * -0.833); const Js = 2451545 + (0.0009 + (w + lw) / (2 * Math.PI) + n) + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L); res.sunset = fJ(Js); res.sunrise = fJ(Jn - (Js - Jn)); } catch {}
  try { const w = hA(r * -6); const Js = 2451545 + (0.0009 + (w + lw) / (2 * Math.PI) + n) + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L); res.dusk = fJ(Js); res.dawn = fJ(Jn - (Js - Jn)); } catch {}
  return res;
}

// ── mapSet (mirrors browser version for setState calls) ───────
function mapSet(eid, val) {
  if (!haConnected) throw new Error('Not connected');
  const dom = eid.split('.')[0];
  const tog = ['light', 'switch', 'fan', 'input_boolean', 'automation', 'script', 'siren', 'humidifier'];
  if (val && typeof val === 'object' && val.service) return haCall({ type: 'call_service', domain: dom, service: val.service, service_data: val.data || {}, target: { entity_id: eid } });
  if (tog.includes(dom)) { const on = val === true || val === 'on' || val === 1; return haCall({ type: 'call_service', domain: dom, service: on ? 'turn_on' : 'turn_off', service_data: {}, target: { entity_id: eid } }); }
  if (dom === 'cover') return haCall({ type: 'call_service', domain: 'cover', service: val === true || val === 'open' ? 'open_cover' : 'close_cover', service_data: {}, target: { entity_id: eid } });
  if (dom === 'lock') return haCall({ type: 'call_service', domain: 'lock', service: val === true || val === 'lock' ? 'lock' : 'unlock', service_data: {}, target: { entity_id: eid } });
  if (dom === 'input_number' || dom === 'number') return haCall({ type: 'call_service', domain: dom, service: 'set_value', service_data: { value: +val }, target: { entity_id: eid } });
  if (dom === 'input_text' || dom === 'text') return haCall({ type: 'call_service', domain: dom, service: 'set_value', service_data: { value: '' + val }, target: { entity_id: eid } });
  if (dom === 'input_select' || dom === 'select') return haCall({ type: 'call_service', domain: dom, service: 'select_option', service_data: { option: '' + val }, target: { entity_id: eid } });
  if (dom === 'climate') {
    if (typeof val === 'number') return haCall({ type: 'call_service', domain: 'climate', service: 'set_temperature', service_data: { temperature: val }, target: { entity_id: eid } });
    return haCall({ type: 'call_service', domain: 'climate', service: 'set_hvac_mode', service_data: { hvac_mode: '' + val }, target: { entity_id: eid } });
  }
  const on = val === true || val === 'on' || val === 1;
  return haCall({ type: 'call_service', domain: dom, service: on ? 'turn_on' : 'turn_off', service_data: {}, target: { entity_id: eid } });
}

// ── Script runtime (mirrors createRT in the browser) ──────────
function createRT(sid, sname, opts) {
  const lat = opts?.lat ?? 51.97, lng = opts?.lng ?? 5.67;
  const subs = [], tms = new Set(), ivs = new Set(), crons = [], stops = [], vStates = new Map(), namedIv = new Map();
  let dead = false, nid = 1;

  function scriptLog(level, msg) {
    const line = { type: 'log', script: sid, level, msg: String(msg), t: Date.now() };
    broadcast(line);
    console.log(`[${sname}][${level}] ${msg}`);
  }
  const safe = (fn, ...a) => { if (dead) return; try { fn(...a); } catch (e) { scriptLog('error', 'Uncaught: ' + (e.message || e)); } };

  const api = {
    on(p, cb) { const id = nid++; subs.push({ id, p, cb }); return id; },
    subscribe(...a) { return api.on(...a); },
    unsubscribe(id) { const i = subs.findIndex(s => s.id === id); if (i >= 0) subs.splice(i, 1); },
    getState(id) {
      const vs = vStates.get(id); if (vs) return { ...vs };
      const e = entityStates.get(id); if (!e) return null;
      return { state: e.state, val: e.state, attributes: e.attributes || {}, lastChanged: e.last_changed, ts: new Date(e.last_updated).getTime() };
    },
    existsState(id) { return vStates.has(id) || entityStates.has(id); },
    getAttr(id, attr) { const s = api.getState(id); return s ? s.attributes[attr] : null; },
    setState(id, v) {
      if (vStates.has(id)) {
        const o = vStates.get(id), os = o.state, ns = typeof v === 'object' && v?.state !== undefined ? String(v.state) : String(v);
        vStates.set(id, { ...o, state: ns, val: ns, ts: Date.now() });
        for (const s of subs) { if (!eMatch(s.p, id) || ns === os) continue; safe(s.cb, { id, entityId: id, state: ns, oldState: os, val: ns, ts: Date.now() }); }
        return;
      }
      return mapSet(id, v);
    },
    setStateDelayed(id, v, ms, clr) { if (clr !== false) api.clearStateDelayed(id); const t = setTimeout(() => { tms.delete(t); safe(() => api.setState(id, v)); }, ms); tms.add(t); return t; },
    clearStateDelayed() {},
    createState(name, init, common) { const fid = name.includes('.') ? name : 'virtual.' + name; vStates.set(fid, { state: String(init ?? ''), val: init, ts: Date.now(), attributes: common || {} }); return fid; },
    deleteState(name) { const fid = name.includes('.') ? name : 'virtual.' + name; return vStates.delete(fid); },
    callService(dom, svc, data, target) { return haCall({ type: 'call_service', domain: dom, service: svc, service_data: data || {}, target: target || {} }); },
    schedule(cron, cb) { const parsed = pCron(cron); const id = nid++; crons.push({ id, parsed, cb }); return id; },
    clearSchedule(id) { const i = crons.findIndex(c => c.id === id); if (i >= 0) crons.splice(i, 1); },
    setTimeout(fn, ms) { const t = setTimeout(() => { tms.delete(t); safe(fn); }, ms); tms.add(t); return t; },
    setInterval(fn, ms, name) { const t = setInterval(() => safe(fn), ms); ivs.add(t); if (name) namedIv.set(name, t); return t; },
    clearTimeout(t) { clearTimeout(t); tms.delete(t); },
    clearInterval(t) {
      if (typeof t === 'string') { const v = namedIv.get(t); if (v) { clearInterval(v); ivs.delete(v); namedIv.delete(t); } }
      else { clearInterval(t); ivs.delete(t); }
    },
    log: Object.assign(m => scriptLog('info', m), { info: m => scriptLog('info', m), warn: m => scriptLog('warn', m), error: m => scriptLog('error', m), debug: m => scriptLog('debug', m) }),
    console: { log: (...a) => scriptLog('info', a.join(' ')), warn: (...a) => scriptLog('warn', a.join(' ')), error: (...a) => scriptLog('error', a.join(' ')), info: (...a) => scriptLog('info', a.join(' ')) },
    onStop(cb) { stops.push(cb); },
    wait(ms) { return new Promise(r => { const t = setTimeout(() => { tms.delete(t); r(); }, ms); tms.add(t); }); },
    sleep(ms) { return api.wait(ms); },
    formatDate(d, f) {
      const dt = d instanceof Date ? d : new Date(d), pad = n => String(n).padStart(2, '0');
      return (f || 'YYYY-MM-DD hh:mm:ss').replace('YYYY', dt.getFullYear()).replace('MM', pad(dt.getMonth() + 1)).replace('DD', pad(dt.getDate())).replace('hh', pad(dt.getHours())).replace('mm', pad(dt.getMinutes())).replace('ss', pad(dt.getSeconds()));
    },
    getAstroDate(ev) { return sunTimes(lat, lng, new Date())[ev] || null; },
    isAstroDay() { const t = sunTimes(lat, lng, new Date()); if (!t.sunrise || !t.sunset) return true; const now = Date.now(); return now >= t.sunrise.getTime() && now <= t.sunset.getTime(); },
    toNumber(v) { return Number(v); },
    toBoolean(v) { return !!v && v !== 'false' && v !== '0' && v !== 'off'; },
    typeOf(v) { if (v === null) return 'null'; if (Array.isArray(v)) return 'array'; return typeof v; },
    parseJSON(s) { try { return JSON.parse(s); } catch { return null; } },
    toJSON(o) { return JSON.stringify(o); },
    httpGet(url) {
      return new Promise(resolve => {
        const mod = url.startsWith('https') ? https : http;
        let d = '';
        mod.get(url, res => { res.on('data', c => d += c); res.on('end', () => resolve(d)); }).on('error', e => { scriptLog('error', 'httpGet: ' + e.message); resolve(null); });
      });
    },
    sendNotification(msg, title) { return api.callService('persistent_notification', 'create', { message: msg, title: title || 'Automation' }); },
    sendToMobile(svc, msg, title, data) { return api.callService('notify', svc || 'notify', { message: msg, title: title || 'HA Blocks', ...(data || {}) }); },
  };

  return {
    api,
    onSC(ev) {
      if (dead) return;
      const { entity_id: eid, new_state: ns, old_state: os } = ev.data || {};
      if (!eid) return;
      for (const s of subs) {
        if (!eMatch(s.p, eid)) continue;
        safe(s.cb, { id: eid, entityId: eid, state: ns?.state, oldState: os?.state, newState: ns, previousState: os, attributes: ns?.attributes, ts: Date.now() });
      }
    },
    tickCron(d) { if (dead) return; for (const c of crons) if (cMatch(c.parsed, d)) safe(c.cb); },
    destroy() {
      dead = true;
      stops.forEach(cb => { try { cb(); } catch {} });
      tms.forEach(t => clearTimeout(t)); ivs.forEach(t => clearInterval(t));
      tms.clear(); ivs.clear(); subs.length = 0; crons.length = 0; stops.length = 0;
    },
    get subCnt() { return subs.length; },
    get schCnt() { return crons.length; },
  };
}

function broadcastRunning() {
  let subs = 0, scheds = 0;
  runningScripts.forEach(rt => { subs += rt.subCnt; scheds += rt.schCnt; });
  broadcast({ type: 'running', ids: Array.from(runningScripts.keys()), subs, scheds });
}

function runScript(id, name, code, opts) {
  stopScript(id);
  const rt = createRT(id, name, opts);
  try {
    const fn = new Function(
      'on','subscribe','unsubscribe','getState','setState','existsState','getAttr','setStateDelayed','clearStateDelayed',
      'createState','deleteState','callService','schedule','clearSchedule','setTimeout','setInterval','clearTimeout',
      'clearInterval','log','console','onStop','wait','sleep','formatDate','getAstroDate','isAstroDay',
      'toNumber','toBoolean','typeOf','parseJSON','toJSON','httpGet','sendNotification','sendToMobile',
      code
    );
    fn(
      rt.api.on, rt.api.subscribe, rt.api.unsubscribe, rt.api.getState, rt.api.setState, rt.api.existsState,
      rt.api.getAttr, rt.api.setStateDelayed, rt.api.clearStateDelayed, rt.api.createState, rt.api.deleteState,
      rt.api.callService, rt.api.schedule, rt.api.clearSchedule, rt.api.setTimeout, rt.api.setInterval,
      rt.api.clearTimeout, rt.api.clearInterval, rt.api.log, rt.api.console, rt.api.onStop, rt.api.wait,
      rt.api.sleep, rt.api.formatDate, rt.api.getAstroDate, rt.api.isAstroDay, rt.api.toNumber,
      rt.api.toBoolean, rt.api.typeOf, rt.api.parseJSON, rt.api.toJSON, rt.api.httpGet,
      rt.api.sendNotification, rt.api.sendToMobile
    );
    runningScripts.set(id, rt);
    broadcast({ type: 'log', script: id, level: 'info', msg: `Script "${name}" started`, t: Date.now() });
    broadcastRunning();
  } catch (e) {
    rt.destroy();
    broadcast({ type: 'log', script: id, level: 'error', msg: `Start failed: ${e.message}`, t: Date.now() });
    broadcast({ type: 'script_status', id, status: 'error', message: e.message });
    broadcastRunning();
  }
}

function stopScript(id) {
  const sc = runningScripts.get(id); if (!sc) return;
  sc.destroy(); runningScripts.delete(id);
  broadcast({ type: 'log', script: id, level: 'info', msg: 'Script stopped', t: Date.now() });
  broadcastRunning();
}

// Cron tick every second
setInterval(() => { const now = new Date(); if (now.getSeconds() === 0) runningScripts.forEach(rt => rt.tickCron(now)); }, 1000);

// ── Browser WebSocket server ──────────────────────────────────
const wss = new WebSocket.Server({ port: BACKEND_PORT });

wss.on('connection', ws => {
  clients.add(ws);
  sysLog('Browser connected');
  ws.send(JSON.stringify({ type: 'ha_status', status: haConnected ? 'connected' : 'disconnected' }));
  if (haConnected) ws.send(JSON.stringify({ type: 'states', data: Array.from(entityStates.values()) }));
  logBuffer.forEach(l => { try { ws.send(JSON.stringify(l)); } catch {} });
  broadcastRunning();

  ws.on('message', async data => {
    let msg; try { msg = JSON.parse(data); } catch { return; }
    try {
      switch (msg.type) {
        case 'auth':
          await haConnect(msg.token);
          ws.send(JSON.stringify({ type: 'auth_ok' }));
          break;
        case 'run':
          if (!haConnected) { ws.send(JSON.stringify({ type: 'error', msg: 'Not connected to HA' })); break; }
          runScript(msg.id, msg.name, msg.code, msg.opts);
          break;
        case 'stop':
          stopScript(msg.id);
          break;
        case 'get_states':
          ws.send(JSON.stringify({ type: 'states', data: Array.from(entityStates.values()) }));
          break;
        case 'call_service':
          await haCall({ type: 'call_service', domain: msg.domain, service: msg.service, service_data: msg.data || {}, target: msg.target || {} });
          break;
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', msg: e.message }));
    }
  });

  ws.on('close', () => { clients.delete(ws); sysLog('Browser disconnected'); });
  ws.on('error', () => clients.delete(ws));
});

sysLog(`Runtime started on port ${BACKEND_PORT}`);
if (haToken) {
  sysLog('Auto-connecting with saved token...');
  haConnect(haToken).catch(e => sysLog('Auto-connect failed: ' + e.message));
}
