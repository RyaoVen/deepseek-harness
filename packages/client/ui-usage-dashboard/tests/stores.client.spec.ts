/**
 * Controller behavior: initial load, refresh, the in-flight guard, and the
 * failure flag.
 */

import { describe, expect, it, vi } from 'vitest'
import type { UsageSummary } from '@deepseek-ai/dsh-host-usage-dashboard/types'
import { UsageDashboardController } from '../src/client/usage-dashboard-controller.ts'

const summary = (overrides: Partial<UsageSummary> = {}): UsageSummary => ({
  totalCalls: 1,
  totalTokens: 10,
  byModel: [],
  byDay: [],
  byHour: [],
  ...overrides,
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('UsageDashboardController', () => {
  it('loads the summary on construction and exposes it', async () => {
    const list = vi.fn(async () => summary())
    const controller = new UsageDashboardController(list)
    expect(controller.inject().hooks.usage.getSnapshot()).toMatchObject({ loading: true })
    await flush()
    expect(controller.inject().hooks.usage.getSnapshot()).toMatchObject({
      loading: false, failed: false, summary: { totalTokens: 10 },
    })
  })

  it('flags a failed load and retries on refresh', async () => {
    const list = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(summary())
    const controller = new UsageDashboardController(list)
    await flush()
    expect(controller.inject().hooks.usage.getSnapshot()).toMatchObject({ failed: true, summary: undefined })

    controller.inject().refresh()
    await flush()
    expect(controller.inject().hooks.usage.getSnapshot()).toMatchObject({ failed: false, summary: { totalTokens: 10 } })
  })

  it('refuses a second load while one is in flight', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const list = vi.fn(async () => { await gate; return summary() })
    const controller = new UsageDashboardController(list)
    controller.inject().refresh()
    expect(list).toHaveBeenCalledTimes(1)
    release()
    await flush()
    expect(list).toHaveBeenCalledTimes(1)
  })
})
