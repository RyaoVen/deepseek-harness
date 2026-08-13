/**
 * Usage dashboard settings surface, browser half — one section that reads
 * the host `usageDashboard` Remote and renders the four usage charts.
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.section' entry)
// and the ctx.remote Context merge with its generated Remote namespaces.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-host-usage-dashboard/remote'
import type { UsageSummary } from '@deepseek-ai/dsh-host-usage-dashboard/types'
import { en, zh } from './locales.ts'
import { UsageDashboardController } from './usage-dashboard-controller.ts'
import { UsageDashboardSection } from './UsageDashboardSection.tsx'

export type { UsageDashboardState, UsageDashboardInjected } from './usage-dashboard-controller.ts'
export type { UsageDashboardSectionProps } from './UsageDashboardSection.tsx'
export type { UsageDashboardLocaleKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.usage'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.usageDashboard']

/**
 * Mount the usage section into the settings shell.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-usage-dashboard: section dictionaries')

  const list = async (): Promise<UsageSummary> => {
    const result = await ctx.remote.usageDashboard.summarize()
    if (!result.ok) {
      throw new Error(`usageDashboard.summarize failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const controller = new UsageDashboardController(list)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'usage',
    order: 10,
    label: () => t('nav'),
    locale: NS,
    inject: () => controller.inject(),
  }, UsageDashboardSection))
}
