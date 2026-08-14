/**
 * Desktop-shell title bar: the frameless window's drag region and window
 * controls. Rendered only inside the Electron shell (the AppFrame renders the
 * `shell.titlebar` row only when `window.desktopBridge` exists), so a plain
 * browser never sees it. The window controls ride the same bridge the
 * decoration switch uses; the drag region is an Electron-native
 * `-webkit-app-region: drag` area (double-click maximizes natively).
 */

import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { desktopBridgeOf } from './index.ts'
import css from './TitleBar.module.css'

/** Props the renderer binds for the title-bar row. */
export type TitleBarProps = PropsRuntime<'shell.titlebar'>

/** Render the frameless-window title bar. */
export function TitleBar(_props: TitleBarProps) {
  const bridge = desktopBridgeOf()
  if (bridge === undefined) return null
  return (
    <div className={css.titlebar} data-drag-region>
      <div className={css.dragRegion} />
      <div className={css.controls}>
        <button
          type="button"
          className={css.control}
          aria-label="最小化"
          title="最小化"
          onClick={() => { bridge.minimize() }}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5h8" /></svg>
        </button>
        <button
          type="button"
          className={css.control}
          aria-label="最大化"
          title="最大化"
          onClick={() => { bridge.toggleMaximize() }}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" /></svg>
        </button>
        <button
          type="button"
          className={css.controlClose}
          aria-label="关闭"
          title="关闭"
          onClick={() => { bridge.close() }}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" /></svg>
        </button>
      </div>
    </div>
  )
}
