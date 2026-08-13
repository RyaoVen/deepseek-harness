/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30012 'Frame 2117131228'): title + three preference cubes, the
 * accent palette swatches, and the motion toggle. Registered by this package —
 * the theme feature owns its own settings surface. Selection follows the
 * persisted preference, never the resolved active theme.
 */
import clsx from 'clsx'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { THEME_ACCENTS, THEME_MOTION_LEVELS } from '../theme-settings.ts'
import type { ThemeAccent, ThemeMotion, ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference writes (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
  /** Switch the accent palette. */
  setAccent: (id: ThemeAccent) => void
  /** Switch the motion level. */
  setMotion: (level: ThemeMotion) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({ t, setTheme, setAccent, setMotion, useStore }: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const accent = useStore(s => s.accent)
  const motion = useStore(s => s.motion)
  return (
    <div className={css.group}>
      <div className={css.title}>{t('appearance.title')}</div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, preference === id && css.selected)}
            aria-pressed={preference === id}
            onClick={() => { setTheme(id) }}
          >
            <Icon />
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div className={css.subTitle}>{t('appearance.accent')}</div>
      <div className={css.swatchRow}>
        {THEME_ACCENTS.map(id => (
          <button
            key={id}
            type="button"
            className={clsx(css.swatch, css[`swatch_${id}`], accent === id && css.swatchSelected)}
            aria-label={t(`appearance.accent.${id}` as ThemeKey)}
            aria-pressed={accent === id}
            title={t(`appearance.accent.${id}` as ThemeKey)}
            onClick={() => { setAccent(id) }}
          >
            <span className={css.swatchDot} />
          </button>
        ))}
      </div>
      <div className={css.subTitle}>{t('appearance.motion')}</div>
      <div className={css.cubeRow}>
        {THEME_MOTION_LEVELS.map(level => (
          <button
            key={level}
            type="button"
            className={clsx(css.themeCube, css.motionCube, motion === level && css.selected)}
            aria-pressed={motion === level}
            onClick={() => { setMotion(level) }}
          >
            {t(`appearance.motion.${level}` as ThemeKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
