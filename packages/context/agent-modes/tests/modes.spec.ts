/**
 * The mode service and Remote: durable reads and switches, live-vs-cold
 * resolution, and the refusal of switches on cold sessions.
 */

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { SessionStore } from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { apply, SessionModes, SessionModesGateway } from '@deepseek-ai/dsh-agent-modes'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

/** One stored session as a persistence backend would hold it. */
interface StoredSession {
  header: SessionHeader
  events: SessionEvent[]
}

class MemoryPersistence extends SessionPersistence {
  readonly sessions = new Map<string, StoredSession>()

  constructor(ctx: Context, options: { seed?: StoredSession[] } = {}) {
    super(ctx)
    for (const session of options.seed ?? []) {
      this.sessions.set(String(session.header.id), session)
    }
  }

  override async listSnapshots(): Promise<Array<{ header: SessionHeader; revision: SessionPersistenceRevision }>> {
    return [...this.sessions.values()].map(session => ({
      header: session.header,
      revision: SessionPersistenceRevision(String(session.events.length)),
    }))
  }

  override async load(id: SessionId): Promise<{ meta: SessionHeader; events: SessionEvent[] }> {
    const session = this.sessions.get(String(id))
    if (session === undefined) throw new Error('missing')
    return { meta: session.header, events: session.events }
  }

  override async inspect(id: SessionId): Promise<{ meta: SessionHeader; events: SessionEvent[] }> {
    return this.load(id)
  }

  override async list(): Promise<SessionHeader[]> {
    return [...this.sessions.values()].map(session => session.header)
  }

  override locate(): undefined { return undefined }
  override get supportsRawArtifacts(): boolean { return false }
  override async create(): Promise<void> {}
  override async append(): Promise<void> {}
  override async readFrom(): Promise<{ meta: SessionHeader; events: SessionEvent[] }> {
    throw new Error('not implemented')
  }
}

function storedSession(id: string, mode?: string): StoredSession {
  return {
    header: { version: 0, id: id as SessionId, createdAt: 1 },
    events: mode === undefined
      ? []
      : [{ seq: 1, time: 1, type: 'mode/set', data: { mode } } as unknown as SessionEvent],
  }
}

async function boot(options?: { seed?: StoredSession[] }): Promise<{
  ctx: Context
  modes: SessionModes
  gateway: SessionModesGateway
}> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(MemoryPersistence, options)
  await ctx.plugin(SessionStore)
  await ctx.plugin(apply)
  return {
    ctx,
    modes: ctx.get('sessionModes') as SessionModes,
    gateway: ctx.get('sessionModesRemote') as SessionModesGateway,
  }
}

describe('SessionModes', () => {
  it('reads the default mode and appends durable switches', async () => {
    const { ctx, modes } = await boot()
    const session = ctx.sessions.create()

    expect(modes.get(session)).toBe('standard')
    const seq = modes.set(session, 'creative')
    expect(typeof seq).toBe('number')
    expect(modes.get(session)).toBe('creative')
    expect(session.events.at(-1)).toMatchObject({ type: 'mode/set', data: { mode: 'creative' } })
  })

  it('switches into design mode and folds it back', async () => {
    const { ctx, modes } = await boot()
    const session = ctx.sessions.create()

    modes.set(session, 'design')
    expect(modes.get(session)).toBe('design')
    expect(session.events.at(-1)).toMatchObject({ type: 'mode/set', data: { mode: 'design' } })
  })

  it('switches into vibe mode and folds it back', async () => {
    const { ctx, modes } = await boot()
    const session = ctx.sessions.create()

    modes.set(session, 'vibe')
    expect(modes.get(session)).toBe('vibe')
    expect(session.events.at(-1)).toMatchObject({ type: 'mode/set', data: { mode: 'vibe' } })
  })
})

describe('SessionModesGateway', () => {
  it('publishes get and set methods under the sessionModesRemote namespace', async () => {
    const { gateway } = await boot()
    expect(gateway.typertRemote).toMatchObject({ serviceKey: 'sessionModesRemote' })
    expect(remoteMethods(gateway).map(row => row.method)).toEqual(['get', 'set'])
  })

  it('reads and switches a live session', async () => {
    const { ctx, gateway } = await boot()
    const session = ctx.sessions.create()

    const before = await gateway.get({ sessionId: session.id })
    expect(before.mode).toBe('standard')

    const switched = gateway.set({ sessionId: session.id, mode: 'creative' })
    expect(typeof switched.seq).toBe('number')
    const after = await gateway.get({ sessionId: session.id })
    expect(after.mode).toBe('creative')
  })

  it('reads a cold session from persistence', async () => {
    const { gateway } = await boot({ seed: [storedSession('cold', 'creative')] })
    const result = await gateway.get({ sessionId: 'cold' as SessionId })
    expect(result.mode).toBe('creative')
  })

  it('refuses to switch a cold session', async () => {
    const { gateway } = await boot({ seed: [storedSession('cold')] })
    expect(() => gateway.set({ sessionId: 'cold' as SessionId, mode: 'creative' })).toThrow(/not live/)
  })
})
