# @deepseek-ai/dsh-client-ui-desktop-decoration

English | [中文](README.zh.md)

Desktop decoration switch, browser half: one settings row in the General section that shows or hides the Electron decoration window (the always-on-top mascot). The row only exists when the page runs inside the desktop shell — it detects `window.desktopBridge` and hides itself in a plain browser. The bridge is the only shell touchpoint: the switch reads and writes the shell-persisted enabled state; the decoration window's session-state animation is fed by its own mux downlink, not by this package.

## Model Experience

None, as this browser-side settings row renders a switch and registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Desktop-only surface** — the row is invisible outside the Electron shell; a browser deployment has no decoration to switch.
- **One global switch** — the decoration window and its state mirroring have no per-session or per-window options yet.
