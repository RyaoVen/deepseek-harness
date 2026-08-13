/**
 * Gateway behavior: the fold is served from every durable session, unchanged
 * sessions reuse their cached fold, changed sessions re-fold, removed
 * sessions leave the cache, and a failing session never takes the summary
 * down.
 */

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionPersistence, SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import UsageDashboardGateway from '@deepseek-ai/dsh-host-usage-dashboard'

/** One in-memory stored session. */
interface StoredSession {
  header: SessionHeader
  events: SessionEvent[]
  revision: SessionPersistenceRevision
}

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

class MemoryPersistence extends SessionPersistence {
  readonly sessions = new Map<string, StoredSession>()
  readonly loads: string[] = []
  readonly failing = new Set<string>()

  override async listSnapshots(): Promise<Array<{ header: SessionHeader; revision: SessionPersistenceRevision }>> {
    return [...this.sessions.values()].map(session => ({ header: session.header, revision: session.revision }))
  }

  override async load(id: SessionId): Promise<{ meta: SessionHeader; events: SessionEvent[] }> {
    this.loads.push(String(id))
    if (this.failing.has(String(id))) throw new Error('torn log')
    const session = this.sessions.get(String(id))
    if (session === undefined) throw new Error('missing')
    return { meta: session.header, events: session.events }
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
  override async inspect(): Promise<{ meta: SessionHeader; events: SessionEvent[] }> {
    throw new Error('not implemented')
  }
}

function sessionEvent(time: number, model: string, tokens: number): SessionEvent {
  return {
    seq: 1,
    time,
    type: 'assistant/message',
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'assistant',
        source: { kind: 'model', provider: 'p', model },
        content: [{ type: 'text', text: 'x' }],
      },
      usage: { inputTokens: tokens, outputTokens: 0 },
    },
  } as SessionEvent
}

function header(id: string): SessionHeader {
  return { version: 0, id: id as SessionId, createdAt: Date.UTC(2026, 7, 1) }
}

const revision = (n: number): SessionPersistenceRevision => SessionPersistenceRevision(`rev-${n}`)

type InstallResult = { ctx: Context; persistence: MemoryPersistence; gateway: UsageDashboardGateway }

async function install(sessions: StoredSession[]): Promise<InstallResult> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(MemoryPersistence)
  const persistence = ctx.get('sessionPersistence') as MemoryPersistence
  for (const session of sessions) persistence.sessions.set(String(session.header.id), session)
  await ctx.plugin(UsageDashboardGateway)
  return { ctx, persistence, gateway: ctx.get('usageDashboard') as UsageDashboardGateway }
}

describe('UsageDashboardGateway', () => {
  it('publishes one summarize method under the usageDashboard namespace', async () => {
    const { gateway } = await install([])
    expect(gateway.typertRemote).toMatchObject({
      serviceKey: 'usageDashboard',
      namespace: 'usageDashboard',
    })
    expect(remoteMethods(gateway)).toEqual([
      { method: 'summarize', invocation: { kind: 'direct' } },
    ])
  })

  it('folds every stored session into one summary', async () => {
    const { gateway } = await install([
      {
        header: header('a'),
        events: [
          sessionEvent(Date.UTC(2026, 7, 14, 1, 0), 'm1', 10),
          sessionEvent(Date.UTC(2026, 7, 14, 2, 0), 'm2', 20),
        ],
        revision: revision(1),
      },
      {
        header: header('b'),
        events: [sessionEvent(Date.UTC(2026, 7, 15, 3, 0), 'm1', 30)],
        revision: revision(1),
      },
    ])

    const summary = await gateway.summarize()
    expect(summary.totalCalls).toBe(3)
    expect(summary.totalTokens).toBe(60)
    expect(summary.byModel).toEqual([
      expect.objectContaining({ model: 'm1', calls: 2, totalTokens: 40 }),
      expect.objectContaining({ model: 'm2', calls: 1, totalTokens: 20 }),
    ])
    expect(summary.byDay.map(row => row.day)).toEqual(['2026-08-14', '2026-08-15'])
    expect(summary.byHour.map(row => row.hour)).toEqual([1, 2, 3])
  })

  it('reuses cached folds for unchanged sessions and re-folds changed ones', async () => {
    const { gateway, persistence } = await install([{
      header: header('a'),
      events: [sessionEvent(Date.UTC(2026, 7, 14, 1, 0), 'm1', 10)],
      revision: revision(1),
    }])

    const first = await gateway.summarize()
    expect(first.totalTokens).toBe(10)
    expect(persistence.loads).toEqual(['a'])

    const second = await gateway.summarize()
    expect(second.totalTokens).toBe(10)
    expect(persistence.loads).toEqual(['a'])

    const session = persistence.sessions.get('a')!
    persistence.sessions.set('a', {
      ...session,
      revision: revision(2),
      events: [...session.events, sessionEvent(Date.UTC(2026, 7, 15, 1, 0), 'm1', 5)],
    })
    const third = await gateway.summarize()
    expect(third.totalTokens).toBe(15)
    expect(persistence.loads).toEqual(['a', 'a'])
  })

  it('evicts removed sessions from the cache', async () => {
    const { gateway, persistence } = await install([{
      header: header('a'),
      events: [sessionEvent(Date.UTC(2026, 7, 14, 1, 0), 'm1', 10)],
      revision: revision(1),
    }])

    await gateway.summarize()
    persistence.sessions.delete('a')
    const summary = await gateway.summarize()
    expect(summary.totalCalls).toBe(0)
    expect(summary.byModel).toEqual([])
  })

  it('skips and logs a session that fails to load', async () => {
    const { ctx, gateway, persistence } = await install([
      {
        header: header('broken'),
        events: [],
        revision: revision(1),
      },
      {
        header: header('ok'),
        events: [sessionEvent(Date.UTC(2026, 7, 14, 1, 0), 'm1', 10)],
        revision: revision(1),
      },
    ])
    persistence.failing.add('broken')
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => {})

    const summary = await gateway.summarize()
    expect(summary.totalCalls).toBe(1)
    expect(summary.byModel[0]).toMatchObject({ model: 'm1' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
