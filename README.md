# HA Blocks — Visual Blockly Automations for Home Assistant

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Fha-hablocks-addon)

A visual, drag-and-drop automation builder for Home Assistant powered by [Google Blockly](https://developers.google.com/blockly).

Inspired by [ioBroker's JavaScript/Blockly adapter](https://github.com/ioBroker/ioBroker.javascript), bringing the same intuitive visual scripting experience to the Home Assistant ecosystem.

![HA Blocks Screenshot](hablocks/screenshot.png)

## Quick Install

1. Click the badge above, or manually add this repository URL in your HA Add-on Store:

   ```
   https://github.com/YOUR_USERNAME/ha-hablocks-addon
   ```

2. Install the **HA Blocks** add-on
3. Start it and click **Open Web UI**

## Features

- 🧩 **Visual Blockly Editor** — No coding required
- 🔔 **Trigger Blocks** — State changes, cron, intervals, astro events
- ⚡ **Action Blocks** — Control entities, call services, send notifications
- 📖 **State Blocks** — Read states, attributes, check conditions
- ⏱ **Timer Blocks** — Delays, intervals, scheduled execution
- 🕐 **Date/Time Blocks** — Time comparisons, formatting, astro calculations
- 🔄 **Convert Blocks** — Type conversion, JSON parse/stringify
- 📝 **Full Standard Blockly** — Logic, loops, math, text, lists, variables, functions
- 🔴 **Live Execution** — Run scripts directly against your HA instance
- 💾 **Persistent Storage** — Scripts survive restarts
- 🌙 **Dark Theme** — Matches Home Assistant's dark mode

## Block Categories

| Category | Description |
|----------|-------------|
| 🔧 System | Debug, control state, toggle, create virtual states, read state/attributes |
| ⚡ Actions | Call any HA service, HTTP requests |
| 📨 Send To | Persistent notifications, mobile app notifications |
| 🔔 Trigger | State change triggers, cron schedules, intervals, astro events |
| ⏱ Timeouts | Wait/delay, named intervals, delayed state changes |
| 🕐 Date/Time | Time comparison, astro dates, formatting |
| 🔄 Convert | Number/boolean/JSON conversion, type checking |

## Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ha-hablocks-addon.git
cd ha-hablocks-addon

# The add-on can be developed locally by opening
# hablocks/rootfs/var/www/index.html in a browser
# (standalone mode — enter HA URL and token manually)
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Credits

- [Google Blockly](https://developers.google.com/blockly) — Visual programming editor
- [ioBroker JavaScript Adapter](https://github.com/ioBroker/ioBroker.javascript) — API inspiration
- [Home Assistant](https://www.home-assistant.io/) — The best home automation platform
