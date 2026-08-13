# @deepseek-ai/dsh-client-ui-mode-switcher

English | [中文](README.zh.md)

Session mode switcher, browser half: one `/mode` popupSelect command that lists every known mode with the session's current one marked active, reads through `sessionModesRemote/get`, and switches through `sessionModesRemote/set`. The durable mode state and the per-agent prompt section belong to `dsh-agent-modes`; this package is the surface only.

## Model Experience

None, as this browser-side command surface renders a mode list and registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Command-only surface** — no inline mode indicator in the composer yet; the current mode is visible in the popup's active row and in the agent's prompt section.
- **No per-mode submenus** — modes with options (design, vibe, spec) will extend the popup rows as their issues land.
