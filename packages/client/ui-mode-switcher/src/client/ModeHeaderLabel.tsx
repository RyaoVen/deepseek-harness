/**
 * The session header's mode chip: shows the current session mode and switches
 * it inline (the visible counterpart of the /mode command — a running session
 * can change its mode at any time, unlike its preset). Reading and switching
 * ride the same `sessionModesRemote` the /mode popup uses.
 */

import { useCallback, useEffect, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the conversation SlotMap merge (the header actions).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AgentMode } from '@deepseek-ai/dsh-agent-modes/types'
import { AGENT_MODES } from './mode-seat-store.ts'
import type { ModeSwitcherLocaleKey } from './locales.ts'
import css from './ModeHeaderLabel.module.css'

/** Registration-side business face for the header mode chip. */
export interface ModeHeaderLabelInjected {
  /** Read one session's current mode. */
  getMode: (sessionId: SessionId) => Promise<AgentMode>
  /** Switch one session's mode. */
  setMode: (sessionId: SessionId, mode: AgentMode) => Promise<boolean>
}

/** Full component props. */
export type ModeHeaderLabelProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'modeSwitcher'>
  & InjectFace<ModeHeaderLabelInjected>

/**
 * Render this session's mode chip in the header.
 * @param props - composed slot props.
 */
export function ModeHeaderLabel({ sessionId, getMode, setMode, t }: ModeHeaderLabelProps) {
  const [mode, setModeState] = useState<AgentMode>('standard')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    void getMode(sessionId).then(setModeState).catch(() => {})
  }, [getMode, sessionId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={AGENT_MODES.map(candidate => ({
        id: candidate,
        label: (
          <span className={css.item}>
            <span className={css.itemName}>{t(candidate)}</span>
            <span className={css.itemDetail}>{t(`${candidate}Detail` as ModeSwitcherLocaleKey)}</span>
          </span>
        ),
      }))}
      selectedId={mode}
      onSelect={(id) => {
        setOpen(false)
        const next = id as AgentMode
        if (next === mode) return
        setBusy(true)
        void setMode(sessionId, next).then((accepted) => {
          if (accepted) setModeState(next)
        }).finally(() => { setBusy(false) })
      }}
      align="start"
      portal
      anchor={(
        <button
          type="button"
          className={css.chip}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy}
          title="切换本会话的模式"
          onClick={() => { setOpen(value => !value) }}
        >
          <span className={css.label}>{t(mode)}</span>
          <IconChevronDownOutline14 className={css.chevron} />
        </button>
      )}
    />
  )
}
