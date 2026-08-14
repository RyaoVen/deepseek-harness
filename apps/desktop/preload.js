/**
 * Preload for the MAIN window: exposes the desktop-only decoration switch and
 * the frameless title-bar controls to the Web GUI. In a plain browser the
 * bridge is absent and the desktop-only UI hides itself; nothing else crosses
 * the context boundary.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopBridge', {
  /** Whether the decoration window is currently shown. */
  getDecorEnabled: () => ipcRenderer.invoke('desktop:decor-get'),
  /** Show or hide the decoration window (persisted by the shell). */
  setDecorEnabled: (enabled) => ipcRenderer.send('desktop:decor-set', Boolean(enabled)),
  /** Minimize the main window. */
  minimize: () => ipcRenderer.send('window:minimize'),
  /** Toggle the main window between maximized and restored. */
  toggleMaximize: () => ipcRenderer.send('window:maximize-toggle'),
  /** Whether the main window is currently maximized. */
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  /** Close the main window (persisted by the shell on close). */
  close: () => ipcRenderer.send('window:close'),
})
