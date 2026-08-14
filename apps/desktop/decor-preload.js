/**
 * Preload for the DECORATION window: a minimal, isolated bridge so the plain
 * decor page can signal click and right-click intent to the shell main
 * process. Nothing else is exposed.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('decorBridge', {
  /** Click on the mascot: focus the main window. */
  activate: () => ipcRenderer.send('decor:activate'),
  /** Right-click on the mascot: show the decoration context menu. */
  menu: () => ipcRenderer.send('decor:menu'),
  /** Drag the mascot: move the decoration window by the pointer delta. */
  drag: (dx, dy) => ipcRenderer.send('decor:drag', { dx, dy }),
})
