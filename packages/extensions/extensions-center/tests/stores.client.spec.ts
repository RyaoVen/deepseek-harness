/**
 * The controller's projection and actions over a fake scope: what the tab
 * sees while the namespace loads or is missing, and how each gesture rewrites
 * the section arrays.
 */

import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  ExtensionsCenterController, EXTENSIONS_CENTER_NS,
  type McpServerDraft, type SkillDraft,
} from '../src/client/extensions-controller.ts'

interface Section {
  servers: McpServerDraft[]
  skills: SkillDraft[]
}

class FakeScope implements SettingsScope<Section> {
  snapshot: SettingsScopeSnapshot<Section>
  readonly listeners = new Set<() => void>()
  readonly writes: Array<{ field: string; value: unknown }> = []
  private applyWrite: boolean
  private gate: Promise<void> | undefined
  private releaseGate: (() => void) | undefined

  constructor(value: Section | undefined, options: { writable?: boolean; applyWrite?: boolean } = {}) {
    this.applyWrite = options.applyWrite ?? true
    this.snapshot = {
      status: value === undefined ? 'unavailable' : 'ready',
      value,
      base: undefined,
      user: value,
      revision: value === undefined ? undefined : 1,
      writable: options.writable ?? value !== undefined,
      mode: 'host',
    }
  }

  getSnapshot(): SettingsScopeSnapshot<Section> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set(field: string, value: unknown): Promise<void> {
    this.writes.push({ field, value })
    if (this.gate !== undefined) await this.gate
    if (!this.applyWrite) return
    const next = { ...this.snapshot.value } as Section
    next[field as 'servers' | 'skills'] = value as McpServerDraft[] & SkillDraft[]
    this.snapshot = { ...this.snapshot, value: next }
    for (const listener of this.listeners) listener()
  }

  async unset(): Promise<void> {}

  /** Hold the next write until {@link releaseWrite} resolves it. */
  holdNextWrite(): void {
    this.gate = new Promise((resolve) => { this.releaseGate = resolve })
  }

  /** Release a held write. */
  releaseWrite(): void {
    this.releaseGate?.()
    this.gate = undefined
  }
}

const server = (overrides: Partial<McpServerDraft> = {}): McpServerDraft => ({
  id: 'files', name: 'Files', enabled: true, transport: 'stdio', command: 'node',
  args: [], env: {}, cwd: '', url: '', headers: {}, toolCallTimeoutMs: 60_000,
  failOnStartupError: false, ...overrides,
})

const skill = (overrides: Partial<SkillDraft> = {}): SkillDraft => ({
  name: 'deploy', description: 'Deploy', enabled: true, content: 'Run.', ...overrides,
})

function controller(scope: FakeScope): ExtensionsCenterController {
  return new ExtensionsCenterController(scope)
}

describe('ExtensionsCenterController projection', () => {
  it('reports unavailable until the namespace is served', () => {
    const face = controller(new FakeScope(undefined)).inject()
    expect(face.hooks.extensions.getSnapshot()).toMatchObject({
      available: false, writable: false, servers: [], skills: [],
    })
  })

  it('projects the served section', () => {
    const face = controller(new FakeScope({ servers: [server()], skills: [skill()] })).inject()
    expect(face.hooks.extensions.getSnapshot()).toMatchObject({
      available: true, writable: true,
      servers: [{ id: 'files' }], skills: [{ name: 'deploy' }],
    })
  })

  it('re-publishes when the scope changes', () => {
    const scope = new FakeScope({ servers: [], skills: [] })
    const face = controller(scope).inject()
    expect(face.hooks.extensions.getSnapshot().servers).toEqual([])
    void scope.set('servers', [server()])
    expect(face.hooks.extensions.getSnapshot().servers).toEqual([server()])
  })
})

describe('ExtensionsCenterController actions', () => {
  it('appends a new server and replaces an existing one by id', async () => {
    const scope = new FakeScope({ servers: [server({ id: 'files' })], skills: [] })
    const face = controller(scope).inject()
    face.saveServer(server({ id: 'web', transport: 'streamable-http', url: 'https://x' }))
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(1) })
    expect(scope.writes[0]).toMatchObject({ field: 'servers' })

    face.saveServer(server({ id: 'files', command: 'npx' }))
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(2) })
    const saved = (scope.writes[1]?.value as McpServerDraft[])
    expect(saved.map(entry => entry.id)).toEqual(['files', 'web'])
    expect(saved[0]).toMatchObject({ command: 'npx' })
  })

  it('toggles and removes servers', async () => {
    const scope = new FakeScope({ servers: [server()], skills: [] })
    const face = controller(scope).inject()
    face.toggleServer('files', false)
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(1) })
    expect((scope.writes[0]?.value as McpServerDraft[])[0]).toMatchObject({ enabled: false })

    face.removeServer('files')
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(2) })
    expect(scope.writes[1]?.value).toEqual([])
  })

  it('appends, replaces, toggles, and removes skills by name', async () => {
    const scope = new FakeScope({ servers: [], skills: [skill()] })
    const face = controller(scope).inject()
    face.saveSkill(skill({ name: 'other' }))
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(1) })
    expect((scope.writes[0]?.value as SkillDraft[]).map(entry => entry.name)).toEqual(['deploy', 'other'])

    face.saveSkill(skill({ name: 'deploy', description: 'New' }))
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(2) })
    expect((scope.writes[1]?.value as SkillDraft[])[0]).toMatchObject({ description: 'New' })

    face.toggleSkill('deploy', false)
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(3) })
    expect((scope.writes[2]?.value as SkillDraft[])[0]).toMatchObject({ enabled: false })

    face.removeSkill('deploy')
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(4) })
    expect(scope.writes[3]?.value).toEqual([skill({ name: 'other' })])
  })

  it('flags a gesture the host refused', async () => {
    const scope = new FakeScope({ servers: [], skills: [] }, { writable: false, applyWrite: false })
    const face = controller(scope).inject()
    face.saveServer(server())
    expect(scope.writes).toHaveLength(0)
    expect(face.hooks.extensions.getSnapshot()).toMatchObject({ failed: true })

    // The next gesture clears the flag before it is judged again.
    const writable = new FakeScope({ servers: [], skills: [] })
    const next = controller(writable).inject()
    next.saveServer(server())
    await vi.waitFor(() => { expect(next.hooks.extensions.getSnapshot().saving).toBe(false) })
    expect(next.hooks.extensions.getSnapshot()).toMatchObject({ failed: false })
  })

  it('keeps saving true while a write is in flight and refuses a second', async () => {
    const scope = new FakeScope({ servers: [], skills: [] })
    const face = controller(scope).inject()
    scope.holdNextWrite()
    face.saveServer(server())
    await vi.waitFor(() => { expect(scope.writes).toHaveLength(1) })
    expect(face.hooks.extensions.getSnapshot().saving).toBe(true)

    face.saveServer(server({ id: 'web' }))
    expect(scope.writes).toHaveLength(1)

    scope.releaseWrite()
    await vi.waitFor(() => { expect(face.hooks.extensions.getSnapshot().saving).toBe(false) })
    expect(scope.writes).toHaveLength(1)
  })

  it('reports a write that did not land', async () => {
    const scope = new FakeScope({ servers: [], skills: [] }, { applyWrite: false })
    const face = controller(scope).inject()
    face.saveServer(server())
    await vi.waitFor(() => { expect(face.hooks.extensions.getSnapshot().saving).toBe(false) })
    expect(face.hooks.extensions.getSnapshot()).toMatchObject({ failed: true })
  })
})

describe('ExtensionsCenterController namespace', () => {
  it('spells the host-owned namespace', () => {
    expect(EXTENSIONS_CENTER_NS).toBe('extensions-center')
  })
})
