/**
 * Pure fold behavior: which events contribute usage, how models, days, and
 * hours accumulate, and how session folds merge into a global one.
 */

import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { emptyFold, foldSession, mergeFold, usageTokens, utcDay } from '../src/fold.ts'

/** Build one assistant-message event; overrides stay loose so any event shape is expressible. */
function event(overrides: Record<string, unknown> = {}): SessionEvent {
  return {
    seq: 1,
    time: Date.UTC(2026, 7, 14, 12, 30),
    type: 'assistant/message',
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'assistant',
        source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' },
        content: [{ type: 'text', text: 'hi' }],
      },
      usage: { inputTokens: 10, outputTokens: 5 },
    },
    ...overrides,
  } as unknown as SessionEvent
}

describe('usageTokens', () => {
  it('sums the disjoint provider buckets', () => {
    expect(usageTokens({ inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 })).toBe(10)
    expect(usageTokens({ inputTokens: 1, outputTokens: 2 })).toBe(3)
  })
})

describe('utcDay', () => {
  it('formats an epoch timestamp as YYYY-MM-DD in UTC', () => {
    expect(utcDay(Date.UTC(2026, 7, 14, 23, 59))).toBe('2026-08-14')
  })
})

describe('foldSession', () => {
  it('accumulates model calls with reported usage into every bucket', () => {
    const fold = foldSession(emptyFold(), [
      event({ seq: 1, time: Date.UTC(2026, 7, 14, 1, 0) }),
      event({
        seq: 2,
        time: Date.UTC(2026, 7, 14, 2, 0),
        data: {
          turn: 2, step: 1,
          message: {
            role: 'assistant',
            source: { kind: 'model', provider: 'opencode-go', model: 'deepseek-v4-pro' },
            content: [{ type: 'text', text: 'x' }],
          },
          usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 25 },
        },
      }),
      event({ seq: 3, time: Date.UTC(2026, 7, 15, 1, 0) }),
    ])

    expect(fold.calls).toBe(3)
    expect(fold.totalTokens).toBe(15 + 175 + 15)
    expect(fold.byModel.get('deepseek-v4-flash')).toMatchObject({ calls: 2, inputTokens: 20, outputTokens: 10, totalTokens: 30 })
    expect(fold.byModel.get('deepseek-v4-pro')).toMatchObject({ calls: 1, inputTokens: 100, outputTokens: 50, cacheReadTokens: 25 })
    expect(fold.byDay.get('2026-08-14')).toMatchObject({ calls: 2, totalTokens: 190 })
    expect(fold.byDay.get('2026-08-15')).toMatchObject({ calls: 1, totalTokens: 15 })
    expect(fold.byHour.get(1)).toMatchObject({ calls: 2, totalTokens: 30 })
    expect(fold.byHour.get(2)).toMatchObject({ calls: 1, totalTokens: 175 })
  })

  it('ignores events without usage and other event types', () => {
    const fold = foldSession(emptyFold(), [
      event({
        seq: 1,
        data: {
          turn: 1, step: 1,
          message: { role: 'assistant', source: { kind: 'model', provider: 'p', model: 'm' }, content: [] },
        },
      }),
      event({ seq: 2, type: 'turn/start', data: { turn: 1 } }),
      event({ seq: 3, type: 'user/message', data: { role: 'user', source: { kind: 'direct' }, content: 'hi' } }),
    ])

    expect(fold.calls).toBe(0)
    expect(fold.totalTokens).toBe(0)
    expect(fold.byModel.size).toBe(0)
  })
})

describe('mergeFold', () => {
  it('sums two session folds into one global fold', () => {
    const left = foldSession(emptyFold(), [event({ seq: 1 })])
    const right = foldSession(emptyFold(), [event({ seq: 1, time: Date.UTC(2026, 7, 14, 3, 0) })])
    const global = mergeFold(emptyFold(), mergeFold(emptyFold(), left))

    expect(global.calls).toBe(1)
    const merged = mergeFold(global, right)
    expect(merged.calls).toBe(2)
    expect(merged.totalTokens).toBe(30)
    expect(merged.byModel.get('deepseek-v4-flash')).toMatchObject({ calls: 2 })
    expect(merged.byDay.get('2026-08-14')).toMatchObject({ calls: 2 })
    expect(merged.byHour.get(12)).toMatchObject({ calls: 1 })
    expect(merged.byHour.get(3)).toMatchObject({ calls: 1 })
  })
})
