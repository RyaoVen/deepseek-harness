/**
 * DeepSeek Harness desktop shell: spawns the `dsh web` server as a child
 * process, waits for its URL line, and shows the GUI in a native window.
 * Plain Electron main (ESM); the shell owns no page code — the Web GUI is
 * served by the child exactly as it would be for a browser.
 */

import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const HERE = dirname(fileURLToPath(import.meta.url))

/** 16x16 blue dot tray glyph (data URL; no asset file needed). */
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuMTM0A1t6AAAAK0lEQVQ4T2P8//8/AyUYE6EGgBgMDGwMDGQZQKph1CFQjGGgBjAyMABq1AY3BHnB7QAAAABJRU5ErkJggg=='

/** Path of the window-state JSON the shell owns in userData. */
function statePath() {
  return join(app.getPath('userData'), 'window-state.json')
}

/**
 * Resolve the `dsh` CLI entry this shell drives. Packaged builds read the CLI
 * from `resources/dsh-cli` (electron-builder extraResources); dev runs prefer
 * the workspace package's built `lib/bin.js`, falling back to the source entry
 * (`src/bin.ts`) through tsx when the workspace has not been built.
 * @returns the absolute path of the CLI bin script (`.ts` when the source
 *   entry must be used).
 */
function resolveCli() {
  // Explicit override: point the shell at any dsh CLI (useful for testing and
  // for installations outside the workspace).
  const override = process.env.DSH_DESKTOP_CLI
  if (override !== undefined && override.length > 0) return override
  if (app.isPackaged) {
    return join(process.resourcesPath ?? '', 'dsh-cli', 'lib', 'bin.js')
  }
  try {
    const pkg = require.resolve('@deepseek-ai/dsh/package.json')
    const dir = dirname(pkg)
    const built = join(dir, 'lib', 'bin.js')
    if (existsSync(built)) return built
    const source = join(dir, 'src', 'bin.ts')
    if (existsSync(source)) return source
    throw new Error(`找不到 dsh CLI 入口（${built} 与 ${source} 都不存在）`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('找不到')) throw error
    throw new Error('找不到 dsh CLI：请先在仓库根目录运行 pnpm install')
  }
}

/**
 * Spawn the Web server and wait for its URL line.
 * @returns the child process and the canonical loopback URL once the server
 *   answers HTTP.
 */
async function launchServer() {
  const bin = resolveCli()
  const sourceEntry = bin.endsWith('.ts')
  // `--expose-internals` is required by the harness's HMR plugin on Node 24
  // (Electron's bundled runtime) and harmless on the supported Node 22 line.
  const args = sourceEntry
    ? ['--expose-internals', '--import', 'tsx/esm', bin, '--profile', 'web', '--port', '0']
    : ['--expose-internals', bin, '--profile', 'web', '--port', '0']
  const proc = spawn(process.execPath, args, {
    // Detached on POSIX so the whole tree can be signalled as one group;
    // Windows kills the tree by pid instead.
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    // In Electron main, process.execPath IS the Electron binary; this env var
    // makes that same binary behave as a plain Node runtime, which is the
    // interpreter the dsh CLI expects.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error('dsh web 启动超时（120s 内未就绪）'))
    }, 120_000)
    const fail = (message) => {
      clearTimeout(timeout)
      reject(new Error(message))
    }
    const settle = (url) => {
      clearTimeout(timeout)
      resolve({ proc, url })
    }
    proc.stdout?.on('data', (chunk) => {
      const text = chunk.toString()
      console.error('[dsh stdout]', text)
      const match = /dsh web: (http:\/\/\S+)/.exec(text)
      if (match === null) return
      const url = match[1] ?? ''
      // The URL line precedes readiness; poll HTTP before showing the window.
      void (async () => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          try {
            const response = await fetch(url)
            if (response.ok) { settle(url); return }
          } catch {
            /* server not listening yet */
          }
          await sleep(300)
        }
        fail(`服务就绪检查超时：${url}`)
      })()
    })
    proc.stderr?.on('data', (chunk) => {
      console.error('[dsh]', chunk.toString())
    })
    proc.on('exit', (code) => {
      fail(`dsh web 进程提前退出（code ${String(code)}）`)
    })
    proc.on('error', (error) => {
      fail(`无法启动 dsh web：${error.message}`)
    })
  })
}

/** Kill the child and its whole process tree. */
function killTree(proc) {
  if (proc.pid === undefined) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'])
  } else {
    try { process.kill(-proc.pid, 'SIGTERM') } catch { try { process.kill(proc.pid, 'SIGTERM') } catch { /* already gone */ } }
  }
}

/** Read the persisted window geometry, validated to plausible numbers. */
async function readWindowState() {
  try {
    const raw = JSON.parse(await readFile(statePath(), 'utf8'))
    const width = raw['width']
    const height = raw['height']
    if (typeof width === 'number' && typeof height === 'number' && width >= 400 && height >= 300) {
      return { width, height, decorEnabled: raw['decorEnabled'] === true }
    }
  } catch {
    /* no state yet or unreadable — first run defaults */
  }
  return undefined
}

/** Persist the window geometry and the decoration switch on close. */
async function writeWindowState(win) {
  const [width, height] = win.getSize()
  await mkdir(dirname(statePath()), { recursive: true })
  await writeFile(statePath(), JSON.stringify({ width, height, decorEnabled }))
}

let mainWindow
let tray
let serverProc
let serverUrl
let decorWindow

/** Whether the desktop decoration is shown; persisted with the window state. */
let decorEnabled = false

/** Focus the main window, creating nothing new. */
function focusWindow() {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/**
 * Create the transparent always-on-top decoration window. The page folds the
 * session mux downlink itself, so the only shell input is click/menu intent.
 */
function createDecorWindow() {
  if (decorWindow !== undefined && !decorWindow.isDestroyed()) {
    decorWindow.show()
    return
  }
  decorWindow = new BrowserWindow({
    width: 150,
    height: 150,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(HERE, 'decor-preload.js'),
    },
  })
  void decorWindow.loadFile(join(HERE, 'decor.html'), { query: serverUrl === undefined ? {} : { server: serverUrl } })
  // Closing the decoration hides it (the tray/right-click menu reopens it);
  // the shell keeps running while the main window exists.
  decorWindow.on('close', (event) => {
    event.preventDefault()
    decorWindow?.hide()
  })
  decorWindow.on('closed', () => { decorWindow = undefined })
}

/** Hide the decoration window (the settings switch and menu both land here). */
function hideDecorWindow() {
  decorWindow?.hide()
}

/** The decoration's right-click menu. */
function decorContextMenu() {
  return Menu.buildFromTemplate([
    { label: '隐藏挂饰', click: () => { decorEnabled = false; hideDecorWindow() } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit() } },
  ])
}

/** Wire the shell IPC: the decoration switch, the decor window's intents, and the title-bar controls. */
function mountIpc() {
  ipcMain.handle('desktop:decor-get', () => decorEnabled)
  ipcMain.on('desktop:decor-set', (_event, enabled) => {
    decorEnabled = enabled === true
    if (decorEnabled) createDecorWindow()
    else hideDecorWindow()
    if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
      void writeWindowState(mainWindow)
    }
  })
  ipcMain.on('decor:activate', () => { focusWindow() })
  ipcMain.on('decor:menu', () => {
    decorContextMenu().popup({ window: decorWindow })
  })
  // Pointer-driven drag from the decor page: the page reports screen-space
  // deltas and the shell moves the frameless window by them.
  ipcMain.on('decor:drag', (_event, delta) => {
    if (decorWindow === undefined || decorWindow.isDestroyed()) return
    const [x, y] = decorWindow.getPosition()
    const dx = typeof delta?.dx === 'number' ? delta.dx : 0
    const dy = typeof delta?.dy === 'number' ? delta.dy : 0
    decorWindow.setPosition(Math.round(x + dx), Math.round(y + dy))
  })
  // Frameless-window controls driven by the GUI's own title bar.
  ipcMain.on('window:minimize', () => { mainWindow?.minimize() })
  ipcMain.on('window:maximize-toggle', () => {
    if (mainWindow === undefined || mainWindow.isDestroyed()) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => { mainWindow?.close() })
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
}

/** Build the tray icon and its menu once the window exists. */
function mountTray() {
  if (tray !== undefined) return
  tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL))
  tray.setToolTip('DeepSeek Harness')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主窗口', click: () => { focusWindow() } },
    ...serverUrl === undefined ? [] : [{ label: '在浏览器中打开', click: () => { void shell.openExternal(serverUrl) } }],
    { type: 'separator' },
    { label: '退出', click: () => { app.quit() } },
  ]))
}

/** Boot the window once the server answers. */
async function boot() {
  const { proc, url } = await launchServer()
  serverProc = proc
  serverUrl = url
  mountIpc()

  const bounds = await readWindowState()
  decorEnabled = bounds?.decorEnabled ?? false
  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    minWidth: 480,
    minHeight: 360,
    autoHideMenuBar: true,
    // Frameless: the GUI's own title bar (drag region + window controls)
    // replaces the native frame inside the desktop shell.
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(HERE, 'preload.js'),
    },
  })
  void mainWindow.loadURL(url)
  mainWindow.on('close', () => { void writeWindowState(mainWindow) })
  mainWindow.on('closed', () => { mainWindow = undefined })
  mountTray()
  if (decorEnabled) createDecorWindow()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => { focusWindow() })
  app.whenReady().then(() => {
    void boot().catch((error) => {
      console.error('[desktop] 启动失败：', error instanceof Error ? error.message : error)
      // The server may have partially started before the failure; make sure
      // its process tree is gone before quitting.
      if (serverProc !== undefined) killTree(serverProc)
      app.quit()
    })
  })
  app.on('before-quit', () => {
    if (serverProc !== undefined) killTree(serverProc)
  })
  app.on('window-all-closed', () => {
    app.quit()
  })
}
