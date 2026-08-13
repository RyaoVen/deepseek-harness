# Agent Note: Desktop decoration window with UI beautification

Status: implemented

English | [中文](2026-08-15-desktop-decoration.zh.md)

## Problem

The desktop shell (issue #3) was a plain window over the Web GUI: no ambient presence, no session-state visibility when the window is in the background, and no settings seat for either. The requested decoration is a transparent always-on-top mascot window that mirrors the conversation state, plus a token-driven UI polish pass.

## Decision

The shell gains a decoration window and the Web settings page gains its switch; the polish rides the existing theme tokens.

**Decoration window** (`apps/desktop`): a 150×150 transparent, frameless, always-on-top, skip-taskbar `BrowserWindow` loads a plain local page (`decor.html`/`decor.css`/`decor.js` — no bundler). The mascot is a CSS orb with three states driven by `body[data-status]`: idle (gentle bob), thinking (pulsing orbit ring + narrowed eyes), done (check badge pop). The page opens the same `/api/events.mux` WebSocket downlink the GUI uses and folds `step/start` → thinking, `step/end`/`turn/end` → done (then back to idle after a short grace) — so the decoration is linked to the session state by construction, with zero client wiring and no bridge from the main window. The orb is a drag region except itself (click → focus the main window; right-click → menu with 隐藏挂饰/退出). The enabled state persists in `userData/window-state.json`.

**Settings switch** (`@deepseek-ai/dsh-client-ui-desktop-decoration`): a General-section row registered through the same `settings.general.item` slot the Appearance row uses. It detects `window.desktopBridge` (the main window's new preload — `getDecorEnabled`/`setDecorEnabled` over contextBridge) and renders nothing in a plain browser; a user toggle wins over the async initial read.

**UI polish** (token-driven): three new theme tokens in `design-platform.css` (both palettes) and registered for inspection — `--dsw-alias-surface-glass`, `--dsw-alias-border-glass`, `--dsw-alias-gradient-brand`. The user message bubble gets a gradient hairline (fill on the padding box, brand gradient on the border box) plus a short entrance animation; the sidebar column and the details panel become glassmorphism surfaces (translucent fill + `backdrop-filter: blur`). The motion system's reduced-motion rule collapses the new animation automatically.

## Alternatives considered

- **Client-side status bridge** — the GUI reports its busy state to the shell via the preload. Rejected: it would need a new client plugin wired into conversation state and a second IPC path; the mux downlink already IS the session state, and the decoration page consumes it directly.
- **Decoration as a web route** — the decoration window loads the GUI with a special hash. Rejected: the GUI brings its own background, scripts, and connection churn; a local page is a fraction of the surface.
- **Host settings for the switch** — a `dsh-settings` namespace toggled from the GUI. Rejected: the switch is a shell-window concern, not a harness setting; the shell's own persisted state plus the bridge keeps the surface one IPC pair.

## Consequences

- The decoration always mirrors the session (same event stream as the GUI), needs no GUI code, and is switchable from the settings page inside the shell only.
- The polish is theme-safe: new tokens have both palette modes, the animation is motion-aware, and no hardcoded colors entered UI styles.
- The shell's published files grow the page + preloads; the constraint gate's desktop files policy grew with them.
