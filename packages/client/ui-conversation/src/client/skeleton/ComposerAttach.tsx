/**
 * Composer attach toolbar: Skill and MCP buttons above the input. Each opens
 * a menu of the session-visible skills / configured MCP servers; picking one
 * appends an `@name ` mention to the draft (the shell's appendText path — one
 * undo step, no span CAS). Absent skills or servers show the empty copy
 * inside the menu, so the buttons never disappear and never lie.
 */

import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ComposerAttach.module.css'

/** One pickable reference in a toolbar menu. */
export interface AttachOption {
  /** Reference text appended to the draft (with a trailing space). */
  reference: string
  /** Menu row label. */
  label: string
  /** Secondary menu row line (description / id), when available. */
  detail?: string
}

/** Registration-side business face for the attach toolbar. */
export interface ComposerAttachInjected {
  /** List the user-invocable skills visible to this session. */
  listSkills: () => Promise<readonly AttachOption[]>
  /** List the MCP servers from the extensions-center settings section. */
  listServers: () => Promise<readonly AttachOption[]>
  /** Append one reference mention to the composer draft. */
  append: (reference: string) => void
}

/** Full component props. */
export type ComposerAttachProps =
  PropsRuntime<'conversation.input.left'>
  & PropsLocale<'conversation'>
  & InjectFace<ComposerAttachInjected>

/** One menu button: loads its option list on open and renders rows or copy. */
function AttachMenu({
  label, hint, emptyText, failedText, load, onPick, align,
}: {
  label: string
  hint: string
  emptyText: string
  failedText: string
  load: () => Promise<readonly AttachOption[]>
  onPick: (option: AttachOption) => void
  align: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<readonly AttachOption[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const loadingRef = useRef(false)
  useEffect(() => {
    if (!open || options !== undefined || failed) return
    loadingRef.current = true
    void load().then((loaded) => {
      loadingRef.current = false
      setOptions(loaded)
    }).catch(() => {
      loadingRef.current = false
      setFailed(true)
    })
  }, [open, options, failed, load])
  const settled = options ?? (failed ? [] : undefined)
  const rows = settled === undefined
    ? [{ id: '__loading__', label: hint, disabled: true }]
    : settled.length === 0
      ? [{ id: '__empty__', label: failed ? failedText : emptyText, disabled: true }]
      : settled.map(option => ({
        id: option.reference,
        label: (
          <span className={css.item}>
            <span className={css.itemName}>{option.label}</span>
            {option.detail !== undefined && <span className={css.itemDetail}>{option.detail}</span>}
          </span>
        ),
      }))
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={rows}
      onSelect={(id) => {
        const picked = settled?.find(option => option.reference === id)
        if (picked !== undefined) onPick(picked)
        setOpen(false)
      }}
      align={align}
      portal
      anchor={(
        <button
          type="button"
          className={css.button}
          aria-haspopup="menu"
          aria-expanded={open}
          title={hint}
          onClick={() => { setOpen(value => !value) }}
        >
          {label}
        </button>
      )}
    />
  )
}

/** Render the Skill / MCP attach toolbar. */
export function ComposerAttach({ t, listSkills, listServers, append }: ComposerAttachProps) {
  return (
    <div className={css.toolbar}>
      <AttachMenu
        label={t('attach.skills')}
        hint={t('attach.skillsHint')}
        emptyText={t('attach.skillsEmpty')}
        failedText={t('attach.skillsFailed')}
        load={listSkills}
        onPick={(option) => { append(option.reference) }}
        align="start"
      />
      <AttachMenu
        label={t('attach.mcp')}
        hint={t('attach.mcpHint')}
        emptyText={t('attach.mcpEmpty')}
        failedText={t('attach.mcpFailed')}
        load={listServers}
        onPick={(option) => { append(option.reference) }}
        align="end"
      />
    </div>
  )
}
