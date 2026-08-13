/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Accent palettes offered by the product; `deepseek` is the base ramp the token stylesheets ship. */
export const THEME_ACCENTS = ['deepseek', 'teal', 'violet', 'rose', 'amber', 'emerald', 'graphite'] as const

/** Motion levels offered by the product; `reduced` disables decorative animation. */
export const THEME_MOTION_LEVELS = ['standard', 'reduced'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the selected accent palette. */
export const THEME_ACCENT_FIELD = 'accent'

/** Field carrying the selected motion level. */
export const THEME_MOTION_FIELD = 'motion'

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Accent palette persisted by the product Appearance row. */
export type ThemeAccent = typeof THEME_ACCENTS[number]

/** Motion level persisted by the product Appearance row. */
export type ThemeMotion = typeof THEME_MOTION_LEVELS[number]

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Default accent: the shipped DeepSeek ramp, so absence and the base palette are the same rendering. */
export const DEFAULT_ACCENT: ThemeAccent = 'deepseek'

/** Default motion level: decorative animation on, system reduced-motion still wins. */
export const DEFAULT_MOTION: ThemeMotion = 'standard'

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in preference. */
  preference: ThemePreference
  /** Selected accent palette. */
  accent: ThemeAccent
  /** Selected motion level. */
  motion: ThemeMotion
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [THEME_ACCENT_FIELD]: z.union([...THEME_ACCENTS]).default(DEFAULT_ACCENT),
  [THEME_MOTION_FIELD]: z.union([...THEME_MOTION_LEVELS]).default(DEFAULT_MOTION),
})

/**
 * Narrow one wire or registry value to a persistable preference.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}

/**
 * Narrow one wire or registry value to a persistable accent id.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is an offered accent palette.
 */
export function isThemeAccent(value: unknown): value is ThemeAccent {
  return THEME_ACCENTS.some(accent => accent === value)
}

/**
 * Narrow one wire or registry value to a persistable motion level.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is an offered motion level.
 */
export function isThemeMotion(value: unknown): value is ThemeMotion {
  return THEME_MOTION_LEVELS.some(motion => motion === value)
}
