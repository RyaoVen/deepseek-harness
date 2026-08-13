/**
 * Desktop decoration switch row in the settings General section. Rendered
 * only inside the desktop shell (the store's `available` flag); the switch
 * calls the shell bridge, and the row state mirrors the shell's persisted
 * choice.
 */
import clsx from 'clsx'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createDecorationRowStore } from './settings-store.ts'
import css from './DecorationRow.module.css'

/** Injected business face: the switch write (t rides the standard locale seat). */
export interface DecorationRowInjected {
  /** Show or hide the decoration window through the desktop shell bridge. */
  setEnabled: (enabled: boolean) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type DecorationRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createDecorationRowStore>>
  & PropsLocale<'settings.decoration'> & DecorationRowInjected

/**
 * Render the decoration switch row.
 * @param props - composed slot props.
 * @returns the row element tree, or null outside the desktop shell.
 */
export function DecorationRow({ t, setEnabled, useStore }: DecorationRowComponentProps) {
  const available = useStore(s => s.available)
  const enabled = useStore(s => s.enabled)
  if (!available) return null
  return (
    <div className={css.group}>
      <div className={css.text}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.description}>{t('description')}</div>
      </div>
      <button
        type="button"
        className={clsx(css.switch, enabled && css.switchOn)}
        aria-pressed={enabled}
        aria-label={t('title')}
        onClick={() => { setEnabled(!enabled) }}
      >
        <span className={css.knob} />
        <span className={css.label}>{t(enabled ? 'on' : 'off')}</span>
      </button>
    </div>
  )
}
