/**
 * Extensions tab: the MCP server and skill entries of the `extensions-center`
 * settings section, as two editable groups with an add form each and per-entry
 * toggle, edit, and remove.
 */

import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the settings shell's SlotMap merge (the 'settings.plugins.tab' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  ExtensionsCenterActions, ExtensionsTabFace, McpServerDraft, SkillDraft, ServerTransport,
} from './extensions-controller.ts'
import type { ExtensionsCenterLocaleKey } from './locales.ts'
import css from './ExtensionsTab.module.css'

type TabLocale = (key: ExtensionsCenterLocaleKey) => string

/** Props the renderer binds for the extensions tab. */
export type ExtensionsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.extensions'>
  & InjectFace<ExtensionsTabFace>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Extensions center tab copy. */
    'settings.extensions': ExtensionsCenterLocaleKey
  }
}

/** Render the two extension groups of the extensions center. */
export function ExtensionsTab({
  t, useExtensions, saveServer, removeServer, toggleServer, saveSkill, removeSkill, toggleSkill,
}: ExtensionsTabProps) {
  const view = useExtensions(value => value)
  if (!view.available) return null
  const readOnly = !view.writable
  return (
    <div className={css.tab}>
      {view.failed && <p role="alert" className={css.failed}>{t('saveFailed')}</p>}
      {readOnly && <p role="status" className={css.readOnly}>{t('readOnly')}</p>}
      <section className={css.group} aria-labelledby="extensions-servers-heading">
        <h3 id="extensions-servers-heading" className={css.heading}>{t('serversHeading')}</h3>
        <p className={css.intro}>{t('serversIntro')}</p>
        {view.servers.length === 0 ? <p className={css.empty}>{t('empty')}</p> : (
          <ul className={css.entries}>
            {view.servers.map(server => (
              <ServerRow
                key={server.id}
                t={t}
                server={server}
                readOnly={readOnly}
                saving={view.saving}
                onToggle={toggleServer}
                onRemove={removeServer}
                onSave={saveServer}
              />
            ))}
          </ul>
        )}
        <AddServerForm t={t} readOnly={readOnly} saving={view.saving} onSave={saveServer} />
      </section>
      <section className={css.group} aria-labelledby="extensions-skills-heading">
        <h3 id="extensions-skills-heading" className={css.heading}>{t('skillsHeading')}</h3>
        <p className={css.intro}>{t('skillsIntro')}</p>
        {view.skills.length === 0 ? <p className={css.empty}>{t('empty')}</p> : (
          <ul className={css.entries}>
            {view.skills.map(skill => (
              <SkillRow
                key={skill.name}
                t={t}
                skill={skill}
                readOnly={readOnly}
                saving={view.saving}
                onToggle={toggleSkill}
                onRemove={removeSkill}
                onSave={saveSkill}
              />
            ))}
          </ul>
        )}
        <AddSkillForm t={t} readOnly={readOnly} saving={view.saving} onSave={saveSkill} />
      </section>
    </div>
  )
}

/** One server row: summary, toggle, edit form, and remove. */
function ServerRow({
  t, server, readOnly, saving, onToggle, onRemove, onSave,
}: {
  t: TabLocale
  server: McpServerDraft
  readOnly: boolean
  saving: boolean
  onToggle: ExtensionsCenterActions['toggleServer']
  onRemove: ExtensionsCenterActions['removeServer']
  onSave: ExtensionsCenterActions['saveServer']
}) {
  const [editing, setEditing] = useState(false)
  return (
    <li className={css.entry}>
      <div className={css.row}>
        <input
          type="checkbox"
          aria-label={t('enabled')}
          checked={server.enabled}
          disabled={readOnly || saving}
          onChange={(event) => { onToggle(server.id, event.target.checked) }}
        />
        <span className={css.rowText}>
          <span className={css.rowName}>{server.name}</span>
          <span className={css.rowMeta}>{server.id} · {server.transport}</span>
        </span>
        <span className={css.rowActions}>
          <button type="button" className={css.rowAction} disabled={readOnly || saving}
            onClick={() => { setEditing(!editing) }}>
            {t(editing ? 'cancel' : 'edit')}
          </button>
          <button type="button" className={css.rowAction} disabled={readOnly || saving}
            onClick={() => { onRemove(server.id) }}>
            {t('remove')}
          </button>
        </span>
      </div>
      {editing && (
        <ServerFields t={t} initial={server} disabled={readOnly || saving} onSave={onSave} onCancel={() => { setEditing(false) }} />
      )}
    </li>
  )
}

/** The collapsed add form for one server. */
function AddServerForm({ t, readOnly, saving, onSave }: {
  t: TabLocale
  readOnly: boolean
  saving: boolean
  onSave: ExtensionsCenterActions['saveServer']
}) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className={css.add} disabled={readOnly || saving} onClick={() => { setOpen(true) }}>
        {t('addServer')}
      </button>
    )
  }
  return (
    <div className={css.formWrap}>
      <ServerFields
        t={t}
        disabled={readOnly || saving}
        onSave={(draft) => { onSave(draft); setOpen(false) }}
        onCancel={() => { setOpen(false) }}
      />
    </div>
  )
}

/** One server's editable fields, shared by the add form and the edit row. */
function ServerFields({ t, initial, disabled, onSave, onCancel }: {
  t: TabLocale
  initial?: McpServerDraft
  disabled: boolean
  onSave: (draft: McpServerDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<McpServerDraft>(() => initial ?? emptyServerDraft())
  const set = <K extends keyof McpServerDraft>(field: K, value: McpServerDraft[K]): void => {
    setDraft(current => ({ ...current, [field]: value }))
  }
  const valid = draft.id.trim() !== '' && draft.name.trim() !== ''
    && (draft.transport === 'stdio' ? draft.command.trim() !== '' : draft.url.trim() !== '')
  return (
    <form
      className={css.form}
      aria-label={t('serverFields')}
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onSave(normalizeServer(draft))
      }}
    >
      <div className={css.field}>
        <label>
          {t('id')}
          <input value={draft.id} disabled={disabled || initial !== undefined}
            onChange={(event) => { set('id', event.target.value) }} />
        </label>
        <small>{t('idHint')}</small>
      </div>
      <div className={css.field}>
        <label>
          {t('name')}
          <input value={draft.name} disabled={disabled}
            onChange={(event) => { set('name', event.target.value) }} />
        </label>
        <small>{t('nameHint')}</small>
      </div>
      <div className={css.field}>
        <label>
          {t('transport')}
          <select value={draft.transport} disabled={disabled}
            onChange={(event) => { set('transport', event.target.value as ServerTransport) }}>
            <option value="stdio">{t('transportStdio')}</option>
            <option value="streamable-http">{t('transportStreamableHttp')}</option>
          </select>
        </label>
      </div>
      {draft.transport === 'stdio' ? (
        <>
          <div className={css.field}>
            <label>
              {t('command')}
              <input value={draft.command} disabled={disabled}
                onChange={(event) => { set('command', event.target.value) }} />
            </label>
            <small>{t('commandHint')}</small>
          </div>
          <div className={css.field}>
            <label>
              {t('args')}
              <textarea rows={2} value={draft.args.join('\n')} disabled={disabled}
                onChange={(event) => { set('args', lines(event.target.value)) }} />
            </label>
            <small>{t('argsHint')}</small>
          </div>
          <div className={css.field}>
            <label>
              {t('env')}
              <textarea rows={2} value={pairs(draft.env)} disabled={disabled}
                onChange={(event) => { set('env', pairsToRecord(event.target.value)) }} />
            </label>
            <small>{t('envHint')}</small>
          </div>
          <div className={css.field}>
            <label>
              {t('cwd')}
              <input value={draft.cwd} disabled={disabled}
                onChange={(event) => { set('cwd', event.target.value) }} />
            </label>
            <small>{t('cwdHint')}</small>
          </div>
        </>
      ) : (
        <>
          <div className={css.field}>
            <label>
              {t('url')}
              <input value={draft.url} disabled={disabled}
                onChange={(event) => { set('url', event.target.value) }} />
            </label>
            <small>{t('urlHint')}</small>
          </div>
          <div className={css.field}>
            <label>
              {t('headers')}
              <textarea rows={2} value={pairs(draft.headers)} disabled={disabled}
                onChange={(event) => { set('headers', pairsToRecord(event.target.value)) }} />
            </label>
            <small>{t('headersHint')}</small>
          </div>
        </>
      )}
      <div className={css.field}>
        <label>
          {t('toolCallTimeoutMs')}
          <input type="number" min={1} value={draft.toolCallTimeoutMs} disabled={disabled}
            onChange={(event) => { set('toolCallTimeoutMs', Number(event.target.value)) }} />
        </label>
        <small>{t('toolCallTimeoutMsHint')}</small>
      </div>
      <label className={css.checkbox}>
        <input type="checkbox" checked={draft.failOnStartupError} disabled={disabled}
          onChange={(event) => { set('failOnStartupError', event.target.checked) }} />
        {t('failOnStartupError')}
      </label>
      <div className={css.actions}>
        <button type="submit" className={css.primary} disabled={disabled || !valid}>{t('save')}</button>
        <button type="button" disabled={disabled} onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  )
}

/** One skill row: summary, toggle, edit form, and remove. */
function SkillRow({
  t, skill, readOnly, saving, onToggle, onRemove, onSave,
}: {
  t: TabLocale
  skill: SkillDraft
  readOnly: boolean
  saving: boolean
  onToggle: ExtensionsCenterActions['toggleSkill']
  onRemove: ExtensionsCenterActions['removeSkill']
  onSave: ExtensionsCenterActions['saveSkill']
}) {
  const [editing, setEditing] = useState(false)
  return (
    <li className={css.entry}>
      <div className={css.row}>
        <input
          type="checkbox"
          aria-label={t('enabled')}
          checked={skill.enabled}
          disabled={readOnly || saving}
          onChange={(event) => { onToggle(skill.name, event.target.checked) }}
        />
        <span className={css.rowText}>
          <span className={css.rowName}>{skill.name}</span>
          {skill.description !== undefined && skill.description !== '' && (
            <span className={css.rowMeta}>{skill.description}</span>
          )}
        </span>
        <span className={css.rowActions}>
          <button type="button" className={css.rowAction} disabled={readOnly || saving}
            onClick={() => { setEditing(!editing) }}>
            {t(editing ? 'cancel' : 'edit')}
          </button>
          <button type="button" className={css.rowAction} disabled={readOnly || saving}
            onClick={() => { onRemove(skill.name) }}>
            {t('remove')}
          </button>
        </span>
      </div>
      {editing && (
        <SkillFields t={t} initial={skill} disabled={readOnly || saving} onSave={onSave} onCancel={() => { setEditing(false) }} />
      )}
    </li>
  )
}

/** The collapsed add form for one skill. */
function AddSkillForm({ t, readOnly, saving, onSave }: {
  t: TabLocale
  readOnly: boolean
  saving: boolean
  onSave: ExtensionsCenterActions['saveSkill']
}) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className={css.add} disabled={readOnly || saving} onClick={() => { setOpen(true) }}>
        {t('addSkill')}
      </button>
    )
  }
  return (
    <div className={css.formWrap}>
      <SkillFields
        t={t}
        disabled={readOnly || saving}
        onSave={(draft) => { onSave(draft); setOpen(false) }}
        onCancel={() => { setOpen(false) }}
      />
    </div>
  )
}

/** One skill's editable fields, shared by the add form and the edit row. */
function SkillFields({ t, initial, disabled, onSave, onCancel }: {
  t: TabLocale
  initial?: SkillDraft
  disabled: boolean
  onSave: (draft: SkillDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<SkillDraft>(() => initial ?? emptySkillDraft())
  const set = <K extends keyof SkillDraft>(field: K, value: SkillDraft[K]): void => {
    setDraft(current => ({ ...current, [field]: value }))
  }
  const valid = draft.name.trim() !== '' && draft.description.trim() !== '' && draft.content.trim() !== ''
  return (
    <form
      className={css.form}
      aria-label={t('skillFields')}
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onSave(normalizeSkill(draft))
      }}
    >
      <div className={css.field}>
        <label>
          {t('name')}
          <input value={draft.name} disabled={disabled || initial !== undefined}
            onChange={(event) => { set('name', event.target.value) }} />
        </label>
        <small>{t('nameHint')}</small>
      </div>
      <div className={css.field}>
        <label>
          {t('description')}
          <input value={draft.description} disabled={disabled}
            onChange={(event) => { set('description', event.target.value) }} />
        </label>
        <small>{t('descriptionHint')}</small>
      </div>
      <div className={css.field}>
        <label>
          {t('whenToUse')}
          <input value={draft.whenToUse ?? ''} disabled={disabled}
            onChange={(event) => { set('whenToUse', event.target.value) }} />
        </label>
        <small>{t('whenToUseHint')}</small>
      </div>
      <div className={css.field}>
        <label>
          {t('content')}
          <textarea rows={6} value={draft.content} disabled={disabled}
            onChange={(event) => { set('content', event.target.value) }} />
        </label>
        <small>{t('contentHint')}</small>
      </div>
      <div className={css.actions}>
        <button type="submit" className={css.primary} disabled={disabled || !valid}>{t('save')}</button>
        <button type="button" disabled={disabled} onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  )
}

function emptyServerDraft(): McpServerDraft {
  return {
    id: '',
    name: '',
    enabled: true,
    transport: 'stdio',
    command: '',
    args: [],
    env: {},
    cwd: '',
    url: '',
    headers: {},
    toolCallTimeoutMs: 60_000,
    failOnStartupError: false,
  }
}

function emptySkillDraft(): SkillDraft {
  return { name: '', description: '', enabled: true, content: '' }
}

/** Trim the free-text fields before the draft leaves the form. */
function normalizeServer(draft: McpServerDraft): McpServerDraft {
  return {
    ...draft,
    id: draft.id.trim(),
    name: draft.name.trim(),
    command: draft.command.trim(),
    cwd: draft.cwd.trim(),
    url: draft.url.trim(),
  }
}

/** Trim the free-text fields before the draft leaves the form. */
function normalizeSkill(draft: SkillDraft): SkillDraft {
  const whenToUse = draft.whenToUse?.trim()
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    enabled: draft.enabled,
    content: draft.content,
    ...(whenToUse === undefined || whenToUse === '' ? {} : { whenToUse }),
  }
}

/** Split a textarea into trimmed, non-empty lines. */
function lines(text: string): string[] {
  return text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
}

/** Render a record as `KEY=VALUE` lines. */
function pairs(record: Record<string, string>): string {
  return Object.entries(record).map(([key, value]) => `${key}=${value}`).join('\n')
}

/** Parse `KEY=VALUE` lines back into a record, skipping malformed lines. */
function pairsToRecord(text: string): Record<string, string> {
  const record: Record<string, string> = {}
  for (const line of lines(text)) {
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    record[line.slice(0, separator)] = line.slice(separator + 1)
  }
  return record
}
