/**
 * The desktop shell bridge: the `window.desktopBridge` surface the Electron
 * preload exposes. Absent in a plain browser, where the desktop-only UI
 * (decoration switch, title bar) hides itself.
 */

/** The desktop shell bridge, when this page runs inside it. */
export interface DesktopBridge {
  /** Whether the decoration window is currently shown. */
  getDecorEnabled(): Promise<boolean>
  /** Show or hide the decoration window (persisted by the shell). */
  setDecorEnabled(enabled: boolean): void
  /** Minimize the main window. */
  minimize(): void
  /** Toggle the main window between maximized and restored. */
  toggleMaximize(): void
  /** Whether the main window is currently maximized. */
  isMaximized(): Promise<boolean>
  /** Close the main window (persisted by the shell on close). */
  close(): void
}

/**
 * Resolve the shell bridge.
 * @returns the desktop shell bridge, or undefined in a plain browser.
 */
export function desktopBridgeOf(): DesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { desktopBridge?: DesktopBridge }).desktopBridge
}
