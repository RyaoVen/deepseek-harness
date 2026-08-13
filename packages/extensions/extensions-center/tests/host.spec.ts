/**
 * Node-half behaviors of the extensions center: the settings namespace and
 * its validation, the live MCP mount lifecycle, and the skill file rendering.
 */

import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply } from '@deepseek-ai/dsh-extensions-center'
import type { McpServerEntry, SkillEntry } from '../src/settings.ts'
import { validateExtensionsCenterSettings } from '../src/settings.ts'
import { ServerMountManager } from '../src/server-mounts.ts'
import { SkillWriter } from '../src/skill-writer.ts'

/** One mounted server recorded by the factory mock. */
interface FakeMount {
  config: unknown
  fiber: PromiseLike<unknown>
  dispose: ReturnType<typeof vi.fn>
}

const { pluginMountFactory, mountedServers } = vi.hoisted(() => {
  const mountedServers: FakeMount[] = []
  const pluginMountFactory = vi.fn((_ctx: unknown) => (config: unknown): FakeMount => {
    const mounted: FakeMount = { config, fiber: Promise.resolve(), dispose: vi.fn(async () => {}) }
    mountedServers.push(mounted)
    return mounted
  })
  return { pluginMountFactory, mountedServers }
})
vi.mock('../src/server-mounts.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/server-mounts.ts')>()
  return { ...actual, pluginMountFactory }
})

class MemorySettings extends SettingsProvider {
  readonly writable = true
  private readonly doc: Record<string, unknown>
  constructor(ctx: ConstructorParameters<typeof SettingsProvider>[0], options: { doc?: Record<string, unknown> } = {}) {
    super(ctx)
    this.doc = structuredClone(options.doc ?? {})
  }
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve(structuredClone(this.doc)) }
  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
    return Promise.resolve()
  }
  pushExternal(doc: Record<string, unknown>): void {
    this.publish(structuredClone(doc))
  }
}

const server = (overrides: Partial<McpServerEntry> = {}): McpServerEntry => ({
  id: 'files',
  name: 'Files',
  enabled: true,
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
  env: {},
  cwd: '',
  url: '',
  headers: {},
  toolCallTimeoutMs: 60_000,
  failOnStartupError: false,
  ...overrides,
})

const skill = (overrides: Partial<SkillEntry> = {}): SkillEntry => ({
  name: 'deploy-blog',
  description: 'Deploy the blog',
  whenToUse: 'when the user asks',
  enabled: true,
  content: 'Run the deploy.',
  ...overrides,
})

const temps: string[] = []
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-extensions-'))
  temps.push(dir)
  return dir
}

afterEach(async () => {
  vi.unstubAllEnvs()
  pluginMountFactory.mockClear()
  mountedServers.splice(0)
  await Promise.all(temps.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('extensions-center apply', () => {
  it('mounts enabled servers and writes enabled skills from the stored section', async () => {
    const dir = await tempDir()
    const ctx = new Context()
    await ctx.plugin(MemorySettings, {
      doc: {
        'extensions-center': {
          servers: [
            server({ id: 'files' }),
            server({
              id: 'web', transport: 'streamable-http', url: 'https://example.com/mcp',
              headers: { Authorization: 'Bearer x' }, toolCallTimeoutMs: 30_000, failOnStartupError: true,
            }),
          ],
          skills: [skill()],
        },
      },
    }).await()
    const fiber = ctx.plugin({ apply }, { skillsDir: dir })
    await fiber.await()

    await vi.waitFor(() => { expect(mountedServers).toHaveLength(2) })
    expect(mountedServers[0]?.config).toMatchObject({
      serverName: 'files', transport: 'stdio', command: 'node', args: ['server.js'],
    })
    expect(mountedServers[1]?.config).toMatchObject({
      serverName: 'web', transport: 'streamable-http', url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer x' }, toolCallTimeoutMs: 30_000, failOnStartupError: true,
    })
    await vi.waitFor(async () => {
      const rendered = await readFile(join(dir, 'deploy-blog', 'SKILL.md'), 'utf8')
      expect(rendered).toContain('name: deploy-blog')
      expect(rendered).toContain('description: Deploy the blog')
      expect(rendered).toContain('whenToUse: when the user asks')
      expect(rendered).toContain('Run the deploy.')
    })

    await fiber.dispose()
  })

  it('re-syncs mounts and skill files after a stored change', async () => {
    const dir = await tempDir()
    const ctx = new Context()
    await ctx.plugin(MemorySettings, {
      doc: { 'extensions-center': { servers: [server({ id: 'files' })], skills: [skill()] } },
    }).await()
    const settings = ctx.get('settings') as MemorySettings
    const fiber = ctx.plugin({ apply }, { skillsDir: dir })
    await fiber.await()
    await vi.waitFor(() => { expect(mountedServers).toHaveLength(1) })
    const mounted = mountedServers[0]!
    await vi.waitFor(async () => {
      expect(await readdir(join(dir, 'deploy-blog'))).toEqual(['SKILL.md'])
    })

    settings.pushExternal({
      'extensions-center': {
        servers: [server({ id: 'files', enabled: false }), server({ id: 'new', command: 'npx' })],
        skills: [],
      },
    })

    await vi.waitFor(() => { expect(mounted.dispose).toHaveBeenCalled() })
    await vi.waitFor(() => { expect(mountedServers.map(mount => (mount.config as { serverName?: string }).serverName)).toContain('new') })
    await vi.waitFor(async () => {
      await expect(readdir(join(dir, 'deploy-blog'))).rejects.toThrow()
    })

    await fiber.dispose()
  })

  it('defaults the skills root to $DSH_HOME/skills', async () => {
    const home = await tempDir()
    vi.stubEnv('DSH_HOME', home)
    const ctx = new Context()
    await ctx.plugin(MemorySettings, {
      doc: { 'extensions-center': { servers: [], skills: [skill()] } },
    }).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await vi.waitFor(async () => {
      expect(await readFile(join(home, 'skills', 'deploy-blog', 'SKILL.md'), 'utf8')).toContain('Run the deploy.')
    })
    await fiber.dispose()
  })

  it('refuses a stored section it cannot act on', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply }, { skillsDir: await tempDir() })
    await fiber.await()
    const ns = settingsNamespace('extensions-center')

    await expect(ctx.settings.update(ns, {
      servers: [server({ id: 'a' }), server({ id: 'a' })],
    })).rejects.toThrow(/duplicate server id/)
    await expect(ctx.settings.update(ns, {
      servers: [server({ transport: 'stdio', command: '' })],
    })).rejects.toThrow(/needs a command/)
    await expect(ctx.settings.update(ns, {
      servers: [server({ transport: 'streamable-http', url: '' })],
    })).rejects.toThrow(/needs a url/)
    await expect(ctx.settings.update(ns, {
      skills: [skill({ name: 'a' }), skill({ name: 'a' })],
    })).rejects.toThrow(/duplicate skill name/)
    await expect(ctx.settings.update(ns, {
      skills: [skill({ name: 'Bad Name' })],
    })).rejects.toThrow(/invalid skill name/)
    await expect(ctx.settings.update(ns, {
      skills: [skill({ description: '' })],
    })).rejects.toThrow(/needs a description and a body/)

    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })
})

describe('validateExtensionsCenterSettings', () => {
  it('accepts a well-formed section', () => {
    expect(() => { validateExtensionsCenterSettings({ servers: [server()], skills: [skill()] }) }).not.toThrow()
  })

  it('rejects each constraint it owns', () => {
    expect(() => { validateExtensionsCenterSettings({ servers: [server({ id: 'a' }), server({ id: 'a' })], skills: [] }) })
      .toThrow(/duplicate server id/)
    expect(() => { validateExtensionsCenterSettings({ servers: [server({ transport: 'stdio', command: '' })], skills: [] }) })
      .toThrow(/needs a command/)
    expect(() => { validateExtensionsCenterSettings({ servers: [server({ transport: 'streamable-http', url: '' })], skills: [] }) })
      .toThrow(/needs a url/)
    expect(() => { validateExtensionsCenterSettings({ servers: [], skills: [skill(), skill()] }) })
      .toThrow(/duplicate skill name/)
    expect(() => { validateExtensionsCenterSettings({ servers: [], skills: [skill({ name: 'Bad Name' })] }) })
      .toThrow(/invalid skill name/)
    expect(() => { validateExtensionsCenterSettings({ servers: [], skills: [skill({ content: '' })] }) })
      .toThrow(/needs a description and a body/)
  })
})

describe('ServerMountManager', () => {
  it('mounts enabled servers and disposes them on disable or removal', async () => {
    const ctx = new Context()
    const mount = vi.fn(() => ({ fiber: Promise.resolve(), dispose: vi.fn(async () => {}) }))
    const manager = new ServerMountManager(mount)
    await manager.sync(ctx, [server({ id: 'a' }), server({ id: 'b', enabled: false })])
    expect(mount).toHaveBeenCalledTimes(1)

    await manager.sync(ctx, [server({ id: 'a', enabled: false })])
    const disposed = mount.mock.results[0]?.value as { dispose: ReturnType<typeof vi.fn> }
    expect(disposed.dispose).toHaveBeenCalled()

    await manager.dispose()
  })

  it('re-mounts an enabled server whose config changed', async () => {
    const ctx = new Context()
    const mount = vi.fn(() => ({ fiber: Promise.resolve(), dispose: vi.fn(async () => {}) }))
    const manager = new ServerMountManager(mount)
    await manager.sync(ctx, [server({ id: 'a', command: 'node' })])
    expect(mount).toHaveBeenCalledTimes(1)

    await manager.sync(ctx, [server({ id: 'a', command: 'npx' })])
    expect(mount).toHaveBeenCalledTimes(2)
    const disposed = mount.mock.results[0]?.value as { dispose: ReturnType<typeof vi.fn> }
    expect(disposed.dispose).toHaveBeenCalled()

    await manager.dispose()
  })

  it('keeps an unchanged enabled server mounted', async () => {
    const ctx = new Context()
    const mount = vi.fn(() => ({ fiber: Promise.resolve(), dispose: vi.fn(async () => {}) }))
    const manager = new ServerMountManager(mount)
    await manager.sync(ctx, [server({ id: 'a' })])
    await manager.sync(ctx, [server({ id: 'a' })])
    expect(mount).toHaveBeenCalledTimes(1)

    await manager.dispose()
  })

  it('drops a failed mount and retries it on the next sync', async () => {
    const ctx = new Context()
    const mount = vi.fn()
      .mockReturnValueOnce({ fiber: Promise.reject(new Error('boom')), dispose: vi.fn(async () => {}) })
      .mockReturnValue({ fiber: Promise.resolve(), dispose: vi.fn(async () => {}) })
    const manager = new ServerMountManager(mount)
    await manager.sync(ctx, [server({ id: 'a' })])
    expect(mount).toHaveBeenCalledTimes(1)

    await manager.sync(ctx, [server({ id: 'a' })])
    expect(mount).toHaveBeenCalledTimes(2)

    await manager.dispose()
  })

  it('disposes every live mount on teardown', async () => {
    const ctx = new Context()
    const mount = vi.fn(() => ({ fiber: Promise.resolve(), dispose: vi.fn(async () => {}) }))
    const manager = new ServerMountManager(mount)
    await manager.sync(ctx, [server({ id: 'a' }), server({ id: 'b' })])
    await manager.dispose()
    for (const result of mount.mock.results) {
      expect((result.value as { dispose: ReturnType<typeof vi.fn> }).dispose).toHaveBeenCalled()
    }
  })
})

describe('SkillWriter', () => {
  it('creates a missing root when writing an enabled skill', async () => {
    const dir = await tempDir()
    const writer = new SkillWriter(join(dir, 'absent'))
    await expect(writer.sync([skill()])).resolves.toBeUndefined()
    expect(await readFile(join(dir, 'absent', 'deploy-blog', 'SKILL.md'), 'utf8')).toContain('Run the deploy.')
  })

  it('leaves files it does not own alone and renders an entry without whenToUse', async () => {
    const dir = await tempDir()
    const writer = new SkillWriter(dir)
    const plain = { name: 'plain', description: 'Plain', enabled: true, content: 'Body.' }
    await writer.writeSkill(plain)
    const rendered = await readFile(join(dir, 'plain', 'SKILL.md'), 'utf8')
    expect(rendered).not.toContain('whenToUse')
    await writer.sync([plain])
    expect(await readdir(dir)).toEqual(['plain'])
  })
})
