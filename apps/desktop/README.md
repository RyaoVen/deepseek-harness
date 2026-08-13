# @deepseek-ai/dsh-desktop

English | [中文](README.zh.md)

Desktop shell for the DeepSeek Harness: it spawns `dsh --profile web` as a child process, waits for the server's URL line plus an HTTP 200, and shows the Web GUI in a native Electron window — no browser tab required.

## Running

From the repository root (the workspace `dsh` CLI must be installed):

```sh
pnpm --filter @deepseek-ai/dsh-desktop start
```

The shell resolves the `dsh` CLI from the workspace (`@deepseek-ai/dsh`), spawns it with `--port 0` (the OS picks a free port), parses the printed `dsh web: http://…` line, polls the URL until the server answers, then loads it in the window.

## Behaviors

- **Single instance** — a second launch focuses the existing window instead of starting another server.
- **Window state** — the window size is persisted to `userData/window-state.json` and restored on the next launch.
- **Tray** — a tray icon offers 打开主窗口, 在浏览器中打开 (when the server is up), and 退出.
- **Clean shutdown** — quitting kills the child `dsh web` process tree (`taskkill /T /F` on Windows, the process group on POSIX).
- **Credential posture** — the shell adds nothing to the server's surface: the GUI, models, credentials, and settings are exactly the Web GUI's own.

## Packaging

```sh
pnpm --filter @deepseek-ai/dsh-desktop build
```

`electron-builder` produces a Windows NSIS installer. The packaged app expects the CLI under `resources/dsh-cli` (configured `extraResources` from the workspace `@deepseek-ai/dsh` package); a full distribution bundles that package's dependency closure as well.

## Known Limitations and Deferred Work

- **Packaged CLI closure** — `extraResources` copies the `@deepseek-ai/dsh` package directory; its transitive dependencies are not yet deployed with it, so a packaged build requires the CLI's dependencies to be resolvable from the extracted resources (dev mode, which uses the workspace install, is the fully supported path today).
- **Windows installer signing** — the NSIS target is unsigned; production distribution needs a code-signing certificate.
- **macOS/Linux packaging** — only the Windows target is configured; other platforms can be added to the electron-builder targets.
