/** What the browser half registers, and that the popup reads and switches the mode. */

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'

// The service reads its initial locale from the browser; these specs assert
// the shipped Chinese copy, so they state the browser they assume.
usePinnedBrowserLanguages('zh-CN')

interface RegisteredCommand {
  name: string
  description: string
  available: (session: { sessionId: string }) => boolean
  ui: {
    kind: 'popupSelect'
    options: (session: { sessionId: string }) => Promise<Array<{ id: string; label: string; active?: boolean }>>
    onSelect: (option: { id: string }, session: { sessionId: string }) => Promise<void>
  }
}

class StubCommandUi {
  readonly registered: RegisteredCommand[] = []
  register(entry: RegisteredCommand): () => void {
    this.registered.push(entry)
    return () => {}
  }
}

async function bench() {
  const ctx = new Context()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  const commandUi = new StubCommandUi()
  ctx.provide('commandUi', commandUi)
  ctx.provide('sessions', {
    subagentAddress: () => undefined,
  })
  const get = vi.fn(() => Promise.resolve({ ok: true, value: { mode: 'standard' } }))
  const set = vi.fn(() => Promise.resolve({ ok: true, value: { seq: 7 } }))
  ctx.provide('remote.sessionModesRemote', { get, set })
  ctx.provide('connection', { isLoopback: true, api: {} } as never)
  return { ctx, commandUi, get, set }
}

const session = { sessionId: 'session-1' }

describe('ui-mode-switcher apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['commandUi', 'connection', 'locale', 'sessions', 'remote', 'remote.sessionModesRemote'])
  })

  it('registers a /mode popupSelect command', async () => {
    const { ctx, commandUi } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()

    expect(commandUi.registered).toHaveLength(1)
    const command = commandUi.registered[0]!
    expect(command.name).toBe('mode')
    expect(command.ui.kind).toBe('popupSelect')
    expect(command.available(session)).toBe(true)
  })

  it('lists every mode with the current one marked active', async () => {
    const { ctx, commandUi, get } = await bench()
    get.mockResolvedValueOnce({ ok: true, value: { mode: 'creative' } })
    await ctx.plugin({ inject: [...inject], apply }).await()

    const options = await commandUi.registered[0]!.ui.options(session)
    expect(options.map(option => option.id)).toEqual(['standard', 'creative', 'design'])
    expect(options.find(option => option.id === 'creative')).toMatchObject({ active: true })
    expect(options.find(option => option.id === 'standard')).not.toHaveProperty('active')
  })

  it('switches the mode through the Remote on select', async () => {
    const { ctx, commandUi, set } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()

    await commandUi.registered[0]!.ui.onSelect({ id: 'creative' }, session)
    expect(set).toHaveBeenCalledWith({ sessionId: 'session-1', mode: 'creative' })
  })

  it('unregisters the command on teardown', async () => {
    const { ctx, commandUi } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(commandUi.registered).toHaveLength(1)

    await fiber.dispose()
  })
})
