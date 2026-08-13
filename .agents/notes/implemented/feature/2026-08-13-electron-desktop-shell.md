# Agent Note: Electron desktop shell for the Web GUI

Status: implemented

English | [中文](2026-08-13-electron-desktop-shell.zh.md)

## Problem

The Web GUI lives in a browser tab: starting it means running `dsh --profile web` and opening the printed URL by hand. A desktop product wants a double-click entry that opens the GUI in a native window, with the server lifecycle owned by the app.

## Decision

`apps/desktop` is a new workspace app (plain Electron main, ESM, no build step) that owns the whole lifecycle: it spawns the workspace `dsh` CLI with `--port 0`, parses the printed `dsh web: http://…` URL line, polls the URL until HTTP 200, then loads it in a `BrowserWindow`. The shell adds no page code and no server surface — the GUI, models, credentials, and settings are exactly the Web GUI's own, so the shell stays upgrade-decoupled from `dsh`. Single-instance lock, tray (打开主窗口 / 在浏览器中打开 / 退出), window-size persistence in `userData`, and process-tree kill on quit (`taskkill /T /F` on Windows, process group on POSIX) round out the app behaviors. `electron-builder` targets the Windows NSIS installer; the packaged CLI is expected at `resources/dsh-cli` via `extraResources`, with the full dependency closure deferred.

## Alternatives considered

- **Tauri** — smaller binaries and lower memory, but the harness is a Node process: a Tauri shell would still spawn the same `dsh` child and additionally carry a Rust toolchain and a sidecar packaging pipeline. Electron reuses the workspace Node toolchain and `electron-builder` handles Windows packaging in one config.
- **Browser launch only** (the status quo, `dsh web` prints the URL) — no app identity, no tray, no lifecycle ownership; explicitly what this change replaces.
- **Embedding the server in-process** — import the web composition inside the Electron main process. Rejected: the harness's own composition boot is exactly what `dsh web` already does, and a separate child keeps crash/isolation boundaries and lets the shell outlive or restart the server independently.

## Consequences

- A native window replaces the manual browser step; quitting the app reliably stops the server (no orphaned `dsh web` processes).
- The child-process boundary means the GUI can crash or be restarted without taking the shell down, and the shell can relaunch it.
- Packaging a full standalone distribution still needs the CLI dependency closure deployed beside `resources/dsh-cli`; dev mode (workspace install) is the fully supported path today.
- The shell is Windows-first (NSIS target); macOS/Linux targets remain future work.
