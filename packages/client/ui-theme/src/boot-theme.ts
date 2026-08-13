/**
 * Host-rendered theme bootstrap for the browser's pre-plugin interval. Each
 * index response embeds the current durable built-in preference, accent, and
 * motion level; the browser resolves only `system`, then writes the same DOM
 * fields ui-layout's ThemePresenter owns after the client plugin tree
 * activates.
 */

import {
  DEFAULT_ACCENT, DEFAULT_MOTION, DEFAULT_PREFERENCE,
  type ThemeAccent, type ThemeMotion, type ThemePreference,
} from './theme-settings.ts'

/** Build the inline script for one schema-validated theme section. */
function bootThemeScript(preference: ThemePreference, accent: ThemeAccent, motion: ThemeMotion): string {
  return `<script>(() => {
  const preference = ${JSON.stringify(preference)}
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  document.body.setAttribute('data-accent', ${JSON.stringify(accent)})
  document.body.setAttribute('data-motion', ${JSON.stringify(motion)})
})()</script>`
}

/**
 * Insert the theme bootstrap immediately after the opening body tag, before
 * the shell mount and module script. Body-less fragments receive it at the
 * end, where the HTML parser has already synthesized a body.
 * @param html - Raw application index HTML.
 * @param preference - Current Host-backed built-in preference.
 * @param accent - Current Host-backed accent palette.
 * @param motion - Current Host-backed motion level.
 * @returns HTML containing the theme bootstrap.
 */
export function injectBootTheme(
  html: string,
  preference: ThemePreference = DEFAULT_PREFERENCE,
  accent: ThemeAccent = DEFAULT_ACCENT,
  motion: ThemeMotion = DEFAULT_MOTION,
): string {
  const script = bootThemeScript(preference, accent, motion)
  const body = /<body(?:\s[^>]*)?>/i.exec(html)
  if (body === null) return `${html}${script}`
  const at = body.index + body[0].length
  return `${html.slice(0, at)}${script}${html.slice(at)}`
}
