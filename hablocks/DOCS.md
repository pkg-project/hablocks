# HA Blocks — Visual Blockly Automations for Home Assistant

A visual, drag-and-drop automation builder for Home Assistant powered by Google Blockly.
Inspired by ioBroker's JavaScript/Blockly adapter, bringing the same intuitive visual
scripting experience to the Home Assistant ecosystem.

## Features

- **Visual Blockly Editor** — Build automations by dragging and connecting blocks
- **Full ioBroker API Parity** — All major block categories from the ioBroker JS adapter
- **Live Execution** — Run scripts directly against your HA instance via WebSocket
- **Real-time Entity Browser** — See all entities and their states, click to copy IDs
- **Code Preview** — See the generated JavaScript code in real-time
- **Live Log Console** — Debug output with severity levels
- **Multi-Script Support** — Create, manage, and run multiple scripts
- **Persistent Storage** — Scripts and blocks survive add-on restarts
- **Auto-Connect** — Connects to HA automatically via Supervisor API

## Block Categories

| Category | Blocks | ioBroker Equivalent |
|----------|--------|---------------------|
| 🔧 **System** | Debug, Comment, Control State, Toggle, Create State, Get State, Get Attribute, State Is, Exists | System Blocks |
| ⚡ **Actions** | Call Service, HTTP GET | Actions Blocks |
| 📨 **Send To** | Persistent Notification, Mobile Notification | SendTo Blocks |
| 🔔 **Trigger** | On Change, On Value, On Multiple, Event Data, Cron, Interval, Astro Trigger, On Stop | Trigger Blocks |
| ⏱ **Timeouts** | Wait, Delayed Execution, Named Interval, Stop Interval | Timeout Blocks |
| 🕐 **Date/Time** | Current Time, Time Compare, Astro Date, Is Daytime, Format Date | DateTime Blocks |
| 🔄 **Convert** | To Number, To Boolean, Type Of, JSON Parse, JSON Stringify | Convert Blocks |
| + | Logic, Loops, Math, Text, Lists, Colour, Variables, Functions | Standard Blockly |

## Installation

1. Add the repository URL to your Home Assistant Add-on Store:
   - Go to **Settings** → **Add-ons** → **Add-on Store**
   - Click the **⋮** menu (top right) → **Repositories**
   - Paste: `https://github.com/YOUR_USERNAME/ha-hablocks-addon`
   - Click **Add**
2. Find **HA Blocks** in the store and click **Install**
3. Start the add-on
4. Click **Open Web UI** or access via the sidebar

## Configuration

The add-on auto-connects to Home Assistant using the Supervisor API — no manual
token configuration needed.

For astro-based triggers (sunrise, sunset, etc.), set your latitude and longitude
in the ⚙ Settings panel within the app.

### Option: `log_level`

The log level for the add-on. Default: `info`.

Possible values: `trace`, `debug`, `info`, `notice`, `warning`, `error`, `fatal`

## How It Works

1. **Drag blocks** from the toolbox on the left onto the workspace
2. **Connect blocks** together to form your automation logic
3. **Preview the code** in the Code tab at the bottom
4. **Click Run** to execute your script against Home Assistant
5. **Monitor logs** in the Log tab to see your script output

## Tips

- Click any entity in the Entities tab to copy its ID to clipboard
- Use **Ctrl/Cmd+S** to quick-save your script
- Wildcard patterns work in triggers: `light.*`, `sensor.temp*`
- Cron format: `minute hour day month weekday` (e.g., `0 8 * * 1-5` = 8am weekdays)
- Named intervals can be stopped later by name

## Support

- [GitHub Issues](https://github.com/YOUR_USERNAME/ha-hablocks-addon/issues)
- [Home Assistant Community](https://community.home-assistant.io/)
