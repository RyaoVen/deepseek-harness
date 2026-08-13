/**
 * Extensions center settings surface, browser half — one tab inside the
 * Plugins settings section that edits the `extensions-center` settings
 * namespace; the node half mounts the entries live.
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.plugins.tab'
// entry) and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { ExtensionsCenterController, EXTENSIONS_CENTER_NS } from './extensions-controller.ts'
import { ExtensionsTab } from './ExtensionsTab.tsx'
import { en, zh } from './locales.ts'

export type { ExtensionsCenterView, ExtensionsCenterActions, ExtensionsTabFace } from './extensions-controller.ts'
export type { McpServerDraft, SkillDraft, ServerTransport } from './extensions-controller.ts'
export type { ExtensionsCenterLocaleKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.extensions'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Mount the extensions tab into the shared Plugins section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'extensions-center: tab dictionaries')

  const controller = new ExtensionsCenterController(ctx.settingsScope.bind({ namespace: EXTENSIONS_CENTER_NS }))

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'extensions',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: () => controller.inject(),
  }, ExtensionsTab))
}
