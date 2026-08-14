/**
 * The session-mode chip on the new-session screen, beside the workspace
 * picker and the agent-preset chip. Picking stages a mode for the session
 * about to start; the choice reaches it when a blank session becomes current
 * (mode-seat-store's apply path, the same flow the preset chip uses).
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AgentMode } from '@deepseek-ai/dsh-agent-modes/types'
import type { ModeSeatState } from './mode-seat-store.ts'
import type { ModeSwitcherLocaleKey } from './locales.ts'
import css from './ModeSeat.module.css'

/** Registration-side business face for the hero mode chip. */
export interface ModeSeatInjected {
  hooks: {
    /** Seat snapshot bound by the renderer as useModeSeat. */
    modeSeat: SnapshotStore<ModeSeatState>
  }
  /** Read the current session's mode when the chip first renders. */
  load: () => Promise<void>
  /** Stage one mode for the next session. */
  select: (mode: AgentMode) => Promise<void>
}

/** Full component props. */
export type ModeSeatProps =
  PropsRuntime<'conversation.hero.agentMode'>
  & PropsLocale<'modeSwitcher'>
  & InjectFace<ModeSeatInjected>

/**
 * Render the new-session mode chip.
 * @param props - composed slot props.
 * @returns the chip.
 */
export function ModeSeat({ load, select, useModeSeat, t }: ModeSeatProps) {
  const state = useModeSeat(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    void load()
  }, [load])
  const current = state.current
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={state.options.map(mode => ({
        id: mode,
        label: (
          <span className={css.item}>
            <span className={css.itemName}>{t(mode)}</span>
            <span className={css.itemDetail}>{t(`${mode}Detail` as ModeSwitcherLocaleKey)}</span>
          </span>
        ),
      }))}
      selectedId={current}
      onSelect={(id) => {
        setOpen(false)
        void select(id as AgentMode)
      }}
      align="start"
      portal
      anchor={(
        <button
          type="button"
          className={css.seat}
          aria-haspopup="menu"
          aria-expanded={open}
          title={state.error ?? 'Switch the next session\'s mode'}
          disabled={state.busy}
          onClick={() => { setOpen(value => !value) }}
        >
          <span className={css.seatLabel}>{t(current)}</span>
          <IconChevronDownOutline14 className={css.chevron} />
        </button>
      )}
    />
  )
}
