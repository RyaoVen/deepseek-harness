/** What the browser half registers, and that it all leaves with the fiber. */

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import type { UsageDashboardInjected } from '../src/client/index.ts'

// The service reads its initial locale from the browser; these specs assert
// the shipped Chinese copy, so they state the browser they assume.
usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
    $on(): () => void { return () => {} }
  }
  new RemoteService(ctx)
  const summarize = vi.fn(() => Promise.resolve({
    ok: true,
    value: { totalCalls: 0, totalTokens: 0, byModel: [], byDay: [], byHour: [] },
  }))
  ctx.provide('remote.usageDashboard', { summarize })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, summarize }
}

function declareRoot(slots: SlotRegistry): void {
  slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-usage-dashboard apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.usageDashboard'])
  })

  it('registers one Usage section inside the settings shell', async () => {
    const { ctx, slots } = await bench()
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()

    const section = slots.entries('settings.section')[0]!
    expect(section.options).toMatchObject({ id: 'usage', order: 10 })
    expect(resolveSlotLabel(section.options.label)).toBe('用量')
  })

  it('injects a snapshot store and the list-backed controller', async () => {
    const { ctx, slots, summarize } = await bench()
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()

    const section = slots.entries('settings.section')[0]!
    const face = (section.inject as unknown as () => UsageDashboardInjected)()
    expect(Object.keys(face.hooks)).toEqual(['usage'])
    await vi.waitFor(() => { expect(summarize).toHaveBeenCalled() })
    await vi.waitFor(() => {
      expect(face.hooks.usage.getSnapshot()).toMatchObject({ loading: false, failed: false })
    })
    expect(face.hooks.usage.getSnapshot().summary).toMatchObject({ totalCalls: 0 })
    expect(typeof face.refresh).toBe('function')
  })

  it('collapses every contribution on teardown', async () => {
    const { ctx, slots } = await bench()
    declareRoot(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('settings.section')).toHaveLength(1)

    await fiber.dispose()

    expect(slots.entries('settings.section')).toHaveLength(0)
  })
})
