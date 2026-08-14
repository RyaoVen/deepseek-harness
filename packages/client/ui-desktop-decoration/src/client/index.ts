/**
 * Desktop shell surfaces, browser half: the General-section decoration switch
 * and the frameless-window title bar. Both exist only when the page runs
 * inside the desktop shell (`window.desktopBridge`), so a plain browser never
 * sees them; the bridge is the only shell touchpoint.
 */

import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the settings general-item slot merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls ui-layout's SlotMap merge (the 'shell.titlebar' entry) into
// every consumer of the slot types.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { desktopBridgeOf } from './bridge.ts'
import { DecorationRow } from './DecorationRow.tsx'
import type { DecorationRowInjected } from './DecorationRow.tsx'
import { TitleBar } from './TitleBar.tsx'
import { createDecorationRowStore } from './settings-store.ts'
import { en, zh, type DecorationKey } from './locales.ts'

export type { DecorationRowComponentProps, DecorationRowInjected } from './DecorationRow.tsx'
export type { DecorationRowState } from './settings-store.ts'
export type { DecorationKey } from './locales.ts'
export type { DesktopBridge } from './bridge.ts'
export { desktopBridgeOf } from './bridge.ts'

/** Namespace owning this feature's settings-row copy. */
export const NS = 'settings.decoration'

/** Services this browser plugin consumes: the locale dictionaries and the slot system. */
export const inject = ['locale', 'slots']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The desktop decoration settings row's copy. */
    'settings.decoration': DecorationKey
  }
}

/**
 * Mount the desktop shell surfaces.
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

  ctx.slots.inject('shell.titlebar', () => ctx.slots.register({
    name: 'shell.titlebar',
    id: 'desktop-titlebar',
  }, TitleBar))
}
