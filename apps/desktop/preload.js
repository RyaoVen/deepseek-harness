/**
 * Preload for the MAIN window: exposes the desktop-only decoration switch to
 * the Web settings page. In a plain browser the bridge is absent and the
 * settings row hides itself; nothing else crosses the context boundary.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopBridge', {
  /** Whether the decoration window is currently shown. */
  getDecorEnabled: () => ipcRenderer.invoke('desktop:decor-get'),
  /** Show or hide the decoration window (persisted by the shell). */
  setDecorEnabled: (enabled) => ipcRenderer.send('desktop:decor-set', Boolean(enabled)),
})
