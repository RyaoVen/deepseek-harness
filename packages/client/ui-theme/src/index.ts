/** Host registration for the browser theme preference and pre-plugin palette. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { injectBootTheme } from './boot-theme.ts'
import {
  DEFAULT_ACCENT, DEFAULT_MOTION, DEFAULT_PREFERENCE, THEME_SETTINGS_NAMESPACE, ThemeSettingsSchema,
  type ThemeAccent, type ThemeMotion, type ThemePreference, type ThemeSettings,
} from './theme-settings.ts'

export {
  DEFAULT_ACCENT, DEFAULT_MOTION, DEFAULT_PREFERENCE, THEME_ACCENT_FIELD, THEME_ACCENTS,
  THEME_MOTION_FIELD, THEME_MOTION_LEVELS, THEME_PREFERENCE_FIELD, THEME_PREFERENCES,
  THEME_SETTINGS_NAMESPACE,
  type ThemeAccent, type ThemeMotion, type ThemePreference, type ThemeSettings,
} from './theme-settings.ts'

const THEME_NAMESPACE = settingsNamespace(THEME_SETTINGS_NAMESPACE)

/** The registered theme section, or each field's schema default without one. */
function readThemeSection(ctx: Context): {
  preference: ThemePreference
  accent: ThemeAccent
  motion: ThemeMotion
} {
  const settings = ctx.get('settings')
  if (settings === undefined) return { preference: DEFAULT_PREFERENCE, accent: DEFAULT_ACCENT, motion: DEFAULT_MOTION }
  const section = settings.get(THEME_NAMESPACE) as ThemeSettings | undefined
  if (section === undefined) return { preference: DEFAULT_PREFERENCE, accent: DEFAULT_ACCENT, motion: DEFAULT_MOTION }
  return section
}

/**
 * Register the durable theme section and initial-theme index transform when
 * their optional Host services are composed.
 * @param ctx - Host context that may acquire settings and HTTP services.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(THEME_NAMESPACE, ThemeSettingsSchema)
  })
  ctx.inject(['webServer'], (httpCtx) => {
    httpCtx.effect(
      () => httpCtx.webServer.tapIndex((html) => {
        const section = readThemeSection(ctx)
        return injectBootTheme(html, section.preference, section.accent, section.motion)
      }),
      'client-ui-theme: initial theme bootstrap',
    )
  })
}
