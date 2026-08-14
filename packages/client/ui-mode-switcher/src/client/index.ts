/**
 * Session mode switcher, browser half: the `/mode` popupSelect command over
 * the host `sessionModesRemote` Remote. The popup lists every known mode with
 * the session's current one marked active; picking one switches the durable
 * session mode, which the host prompt section folds on the next request.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { CommandUiContract, SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the conversation SlotMap merge (the hero mode seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the api-remotes assembly's remote merge (ctx.remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the generated sessionModesRemote namespace merge.
import type {} from '@deepseek-ai/dsh-agent-modes/remote'
import type { AgentMode } from '@deepseek-ai/dsh-agent-modes/types'
import { en, zh, type ModeSwitcherLocaleKey } from './locales.ts'
import { AGENT_MODES, ModeSeatController } from './mode-seat-store.ts'
import { ModeSeat, type ModeSeatInjected } from './ModeSeat.tsx'

export type { ModeSwitcherLocaleKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
export const NS = 'modeSwitcher'

/** Required services (cordis fiber inject). */
export const inject = ['commandUi', 'connection', 'locale', 'sessions', 'remote', 'remote.sessionModesRemote']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The mode switcher copy. */
    'modeSwitcher': ModeSwitcherLocaleKey
  }
}

/** One mode's popup row. */
function optionOf(mode: AgentMode, current: AgentMode, t: (key: ModeSwitcherLocaleKey) => string): SelectOption {
  return {
    id: mode,
    label: t(mode),
    detail: t(`${mode}Detail` as ModeSwitcherLocaleKey),
    ...(mode === current ? { active: true } : {}),
  }
}

/**
 * Mount the /mode command.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-mode-switcher: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.inject(['commandUi', 'sessions', 'remote.sessionModesRemote'], (scope: ClientContext) => {
    const command = scope.get('commandUi') as CommandUiContract
    scope.effect(() => command.register({
      name: 'mode',
      description: t('commandDescription'),
      available: session => scope.sessions.subagentAddress(session.sessionId) === undefined,
      ui: {
        kind: 'popupSelect',
        options: async (session) => {
          const result = await scope.remote.sessionModesRemote.get({ sessionId: session.sessionId })
          if (!result.ok) {
            throw new Error(`sessionModesRemote.get failed: ${result.error.code}: ${result.error.message}`)
          }
          return AGENT_MODES.map(mode => optionOf(mode, result.value.mode, t))
        },
        onSelect: async (option, session) => {
          const mode = option.id as AgentMode
          const result = await scope.remote.sessionModesRemote.set({ sessionId: session.sessionId, mode })
          if (!result.ok) {
            throw new Error(`sessionModesRemote.set failed: ${result.error.code}: ${result.error.message}`)
          }
        },
      },
    }), 'ui-mode-switcher: /mode contribution')
  })

  // The new-session mode chip: same staged-pick flow as the preset chip, so a
  // mode chosen for the session about to start lands on it when it appears.
  ctx.inject(['slots', 'sessions', 'remote.sessionModesRemote'], (scope: ClientContext) => {
    const seat = new ModeSeatController(
      async (sessionId) => {
        const result = await scope.remote.sessionModesRemote.get({ sessionId })
        return result.ok ? result.value.mode : 'standard'
      },
      async (sessionId, mode) => {
        const result = await scope.remote.sessionModesRemote.set({ sessionId, mode })
        return result.ok
      },
      () => {
        const state = scope.sessions.list.getSnapshot()
        const current = state.current
        if (current === undefined) return undefined
        const summary = state.byId[current]
        return summary === undefined ? undefined : { id: current, blank: summary.blank }
      },
    )
    const seatInjected = (): ModeSeatInjected => ({
      hooks: { modeSeat: seat.store },
      load: () => seat.load(),
      select: (mode: AgentMode) => seat.select(mode),
    })
    scope.effect(() => {
      // Connecting a workspace either creates a blank session or reuses one,
      // and either way the chip's pick predates it — so the staged mode is
      // applied when the session arrives, not when it was made.
      const stop = scope.sessions.list.subscribe(() => { void seat.apply() })
      const chip = scope.slots.register({
        name: 'conversation.hero.agentMode',
        locale: NS,
        inject: seatInjected,
      }, ModeSeat)
      return () => {
        stop()
        chip()
      }
    }, 'ui-mode-switcher: hero mode chip')
  })
}
