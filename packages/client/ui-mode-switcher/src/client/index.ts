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
// Type-only: the api-remotes assembly's remote merge (ctx.remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the generated sessionModesRemote namespace merge.
import type {} from '@deepseek-ai/dsh-agent-modes/remote'
import type { AgentMode } from '@deepseek-ai/dsh-agent-modes/types'
import { en, zh, type ModeSwitcherLocaleKey } from './locales.ts'

export type { ModeSwitcherLocaleKey } from './locales.ts'

/** The known mode values, in UI order. Spelled here: a client bundle must not value-import a Host package. */
const AGENT_MODES: readonly AgentMode[] = ['standard', 'creative']

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
    detail: t(`${mode}Detail`),
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
}
