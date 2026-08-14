/**
 * Extensions center settings surface, browser half — one tab inside the
 * Plugins settings section that edits the `extensions-center` settings
 * namespace; the node half mounts the entries live.
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  InputTriggerServiceContract, InputTriggerSource,
} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.plugins.tab'
// entry) and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  ExtensionsCenterController, EXTENSIONS_CENTER_NS,
  type ExtensionsCenterSection, type McpServerDraft,
} from './extensions-controller.ts'
import { ExtensionsTab } from './ExtensionsTab.tsx'
import { en, zh } from './locales.ts'

export type { ExtensionsCenterView, ExtensionsCenterActions, ExtensionsTabFace } from './extensions-controller.ts'
export type { McpServerDraft, SkillDraft, ServerTransport } from './extensions-controller.ts'
export type { ExtensionsCenterLocaleKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.extensions'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'settingsScope', 'inputTriggers']

/**
 * Mount the extensions tab into the shared Plugins section and the MCP
 * reference source into the '@' trigger pipeline.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'extensions-center: tab dictionaries')

  const scope = ctx.settingsScope.bind<ExtensionsCenterSection>({
    namespace: EXTENSIONS_CENTER_NS,
  })
  const controller = new ExtensionsCenterController(scope)

  // The '@' reference source over the enabled MCP servers: candidates and the
  // hot lexicon both derive from the settings snapshot, so a picked
  // `@server ` mention renders the same chip visuals as skills and subagents.
  const enabledServers = (): readonly McpServerDraft[] => {
    const snapshot = scope.getSnapshot()
    return snapshot.status === 'ready' ? (snapshot.value?.servers ?? []).filter(server => server.enabled) : []
  }
  const mcpSource: InputTriggerSource = {
    trigger: '@',
    name: 'mcp',
    order: 30,
    candidates(_session, { query }) {
      const matches = enabledServers().filter(server => server.name.includes(query))
      return Promise.resolve(matches.map(server => ({ name: server.name, description: server.id })))
    },
    lexicon() {
      const names = enabledServers().map(server => server.name)
      return names.length === 0 ? undefined : names
    },
    subscribeLexicon(_session, listener) {
      return scope.subscribe(listener)
    },
    onPick({ candidate }) {
      return { text: `@${candidate.name} ` }
    },
  }
  ctx.effect(() => {
    const unregister = (ctx.get('inputTriggers') as InputTriggerServiceContract).registerSource(mcpSource)
    return unregister
  }, 'extensions-center: mcp @ source')

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'extensions',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: () => controller.inject(),
  }, ExtensionsTab))
}
