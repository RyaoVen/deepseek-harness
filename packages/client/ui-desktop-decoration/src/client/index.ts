/**
 * Desktop decoration settings row, browser half: a General-section switch
 * that shows or hides the Electron decoration window. The row exists only
 * when the page runs inside the desktop shell (`window.desktopBridge`), so a
 * plain browser never sees it; the bridge is the only shell touchpoint.
 */

import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the settings general-item slot merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { DecorationRow } from './DecorationRow.tsx'
import type { DecorationRowInjected } from './DecorationRow.tsx'
import { createDecorationRowStore } from './settings-store.ts'
import { en, zh, type DecorationKey } from './locales.ts'

export type { DecorationRowComponentProps, DecorationRowInjected } from './DecorationRow.tsx'
export type { DecorationRowState } from './settings-store.ts'
export type { DecorationKey } from './locales.ts'

/** Namespace owning this feature's settings-row copy. */
export const NS = 'settings.decoration'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The desktop decoration settings row's copy. */
    'settings.decoration': DecorationKey
  }
}

/** The desktop shell bridge, when this page runs inside it. */
export interface DesktopBridge {
  /** Whether the decoration window is currently shown. */
  getDecorEnabled(): Promise<boolean>
  /** Show or hide the decoration window (persisted by the shell). */
  setDecorEnabled(enabled: boolean): void
}

/**
 * Resolve the shell bridge.
 * @returns the desktop shell bridge, or undefined in a plain browser.
 */
export function desktopBridgeOf(): DesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { desktopBridge?: DesktopBridge }).desktopBridge
}

/**
 * Mount the decoration settings row.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-desktop-decoration: dictionaries')

  const bridge = desktopBridgeOf()
  const store = createDecorationRowStore()
  let bound: BoundActions<typeof store> | undefined
  // A user toggle wins over the async initial read (the read may resolve late).
  let touched = false

  const publish = (enabled: boolean): void => {
    bound?.sync(true, enabled)
  }

  if (bridge !== undefined) {
    void bridge.getDecorEnabled().then((enabled) => {
      if (touched) return
      publish(enabled)
    }).catch(() => {
      // The bridge lives in the desktop shell; an IPC failure means the
      // switch is inert this session — keep the row in the off state.
      if (touched) return
      publish(false)
    })
  }

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'desktop-decoration',
    order: 30,
    store,
    locale: NS,
    inject: (actions: BoundActions<typeof store>): DecorationRowInjected => {
      bound = actions
      return {
        setEnabled: (enabled) => {
          touched = true
          bridge?.setDecorEnabled(enabled)
          publish(enabled)
        },
      }
    },
  }, DecorationRow))
}
