// @vitest-environment jsdom
/**
 * What the extensions tab shows: nothing while the namespace is unavailable,
 * the two groups and their add forms, and the per-entry toggle, edit, and
 * remove gestures.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { ExtensionsTab } from '../src/client/ExtensionsTab.tsx'
import type { ExtensionsTabProps } from '../src/client/ExtensionsTab.tsx'
import type { ExtensionsCenterView, McpServerDraft, SkillDraft } from '../src/client/extensions-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

const server = (overrides: Partial<McpServerDraft> = {}): McpServerDraft => ({
  id: 'files', name: 'Files', enabled: true, transport: 'stdio', command: 'node',
  args: [], env: {}, cwd: '', url: '', headers: {}, toolCallTimeoutMs: 60_000,
  failOnStartupError: false, ...overrides,
})

const skill = (overrides: Partial<SkillDraft> = {}): SkillDraft => ({
  name: 'deploy', description: 'Deploy the blog', enabled: true, content: 'Run the deploy.', ...overrides,
})

function actions() {
  return {
    saveServer: vi.fn(), removeServer: vi.fn(), toggleServer: vi.fn(),
    saveSkill: vi.fn(), removeSkill: vi.fn(), toggleSkill: vi.fn(),
  }
}

function renderTab(state: Partial<ExtensionsCenterView> = {}, overrides: Partial<ReturnType<typeof actions>> = {}) {
  const store = createSnapshotStore<ExtensionsCenterView>({
    available: true, writable: true, servers: [], skills: [], saving: false, failed: false, ...state,
  })
  const bound = actions()
  const props = {
    ...bound, ...overrides,
    t,
    useExtensions: bindSnapshotSelector(store),
  } as unknown as ExtensionsTabProps
  render(<ExtensionsTab {...props} />)
  return { ...bound, ...overrides }
}

describe('ExtensionsTab', () => {
  it('renders nothing while the namespace is unavailable', () => {
    const { container } = render(<div />)
    renderTab({ available: false })

    expect(container.textContent).toBe('')
    expect(screen.queryByText(en.serversHeading)).toBeNull()
  })

  it('leads with both groups and their empty lines', () => {
    renderTab()

    expect(screen.getByRole('heading', { name: en.serversHeading })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.skillsHeading })).toBeTruthy()
    expect(screen.getAllByText(en.empty)).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: en.addServer })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: en.addSkill })).toHaveLength(1)
  })

  it('says the document is read-only and disables the add buttons', () => {
    renderTab({ writable: false })

    expect(screen.getByRole('status')).toHaveProperty('textContent', en.readOnly)
    expect(screen.getByRole('button', { name: en.addServer })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.addSkill })).toHaveProperty('disabled', true)
  })

  it('reports a refused write', () => {
    renderTab({ failed: true })

    expect(screen.getByRole('alert')).toHaveProperty('textContent', en.saveFailed)
  })

  it('adds a stdio server through the add form', () => {
    const { saveServer } = renderTab()
    fireEvent.click(screen.getByRole('button', { name: en.addServer }))

    fireEvent.change(screen.getByLabelText(en.id), { target: { value: ' git-bot ' } })
    fireEvent.change(screen.getByLabelText(en.name), { target: { value: ' Git bot ' } })
    fireEvent.change(screen.getByLabelText(en.command), { target: { value: ' npx ' } })
    fireEvent.change(screen.getByLabelText(en.args), { target: { value: 'mcp-server-git\n--port 4000' } })
    fireEvent.change(screen.getByLabelText(en.env), { target: { value: 'TOKEN=abc\nbroken line' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    expect(saveServer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'git-bot', name: 'Git bot', command: 'npx', args: ['mcp-server-git', '--port 4000'],
      env: { TOKEN: 'abc' },
    }))
  })

  it('switches the transport fields and keeps save disabled while invalid', () => {
    const { saveServer } = renderTab()
    fireEvent.click(screen.getByRole('button', { name: en.addServer }))

    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText(en.transport), { target: { value: 'streamable-http' } })
    expect(screen.queryByLabelText(en.command)).toBeNull()
    expect(screen.getByLabelText(en.url)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(en.id), { target: { value: 'web' } })
    fireEvent.change(screen.getByLabelText(en.name), { target: { value: 'Web' } })
    fireEvent.change(screen.getByLabelText(en.url), { target: { value: 'https://example.com/mcp' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    expect(saveServer).toHaveBeenCalledWith(expect.objectContaining({ transport: 'streamable-http', url: 'https://example.com/mcp' }))
  })

  it('toggles, edits, and removes a server row', () => {
    const bound = renderTab({ servers: [server()] })
    const checkbox = screen.getByRole('checkbox', { name: en.enabled })
    fireEvent.click(checkbox)
    expect(bound.toggleServer).toHaveBeenCalledWith('files', false)

    fireEvent.click(screen.getByRole('button', { name: en.remove }))
    expect(bound.removeServer).toHaveBeenCalledWith('files')

    fireEvent.click(screen.getByRole('button', { name: en.edit }))
    const name = screen.getByLabelText(en.name) as HTMLInputElement
    expect(name.value).toBe('Files')
    expect(screen.getByLabelText(en.id)).toHaveProperty('disabled', true)
    fireEvent.change(name, { target: { value: 'File server' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    expect(bound.saveServer).toHaveBeenCalledWith(expect.objectContaining({ id: 'files', name: 'File server' }))
  })

  it('adds, toggles, edits, and removes a skill row', () => {
    const bound = renderTab({ skills: [skill()] })
    const checkbox = screen.getByRole('checkbox', { name: en.enabled })
    fireEvent.click(checkbox)
    expect(bound.toggleSkill).toHaveBeenCalledWith('deploy', false)

    fireEvent.click(screen.getByRole('button', { name: en.remove }))
    expect(bound.removeSkill).toHaveBeenCalledWith('deploy')

    fireEvent.click(screen.getByRole('button', { name: en.edit }))
    const skillNameInput = screen.getByLabelText(en.name) as HTMLInputElement
    expect(skillNameInput.value).toBe('deploy')
    fireEvent.change(screen.getByLabelText(en.content), { target: { value: 'Run the new deploy.' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    expect(bound.saveSkill).toHaveBeenCalledWith(expect.objectContaining({
      name: 'deploy', content: 'Run the new deploy.',
    }))
    // The edit form stays open after saving; the row toggle reads Cancel
    // while editing, so close it through the first Cancel button.
    fireEvent.click(screen.getAllByRole('button', { name: en.cancel })[0]!)

    fireEvent.click(screen.getByRole('button', { name: en.addSkill }))
    fireEvent.change(screen.getByLabelText(en.name), { target: { value: 'archive' } })
    fireEvent.change(screen.getByLabelText(en.description), { target: { value: 'Archive the workspace' } })
    fireEvent.change(screen.getByLabelText(en.whenToUse), { target: { value: 'when asked' } })
    fireEvent.change(screen.getByLabelText(en.content), { target: { value: 'Zip it.' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    expect(bound.saveSkill).toHaveBeenCalledWith(expect.objectContaining({
      name: 'archive', description: 'Archive the workspace', whenToUse: 'when asked', content: 'Zip it.',
    }))
  })

  it('clears a blank whenToUse on save', () => {
    const bound = renderTab()
    fireEvent.click(screen.getByRole('button', { name: en.addSkill }))
    fireEvent.change(screen.getByLabelText(en.name), { target: { value: 'plain' } })
    fireEvent.change(screen.getByLabelText(en.description), { target: { value: 'Plain' } })
    fireEvent.change(screen.getByLabelText(en.whenToUse), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText(en.content), { target: { value: 'Body' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    expect(bound.saveSkill).toHaveBeenCalledWith(expect.objectContaining({ name: 'plain', description: 'Plain', content: 'Body' }))
    expect(bound.saveSkill.mock.calls[0]?.[0]).not.toHaveProperty('whenToUse')
  })

  it('disables the controls while a save is in flight', () => {
    renderTab({ servers: [server()], skills: [skill()], saving: true })

    expect(screen.getAllByRole('checkbox', { name: en.enabled })[0]).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.addServer })).toHaveProperty('disabled', true)
  })
})
