/**
 * The mode fold: latest `mode/set` wins, unknown values are skipped, and the
 * default is `standard`.
 */

import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { modeOf } from '../src/fold.ts'

function modeEvent(mode: unknown, seq: number): SessionEvent {
  return { seq, time: 1, type: 'mode/set', data: { mode } } as unknown as SessionEvent
}

describe('modeOf', () => {
  it('defaults to standard without any mode event', () => {
    expect(modeOf([])).toBe('standard')
    expect(modeOf([{ seq: 1, time: 1, type: 'turn/start', data: { turn: 1 } } as unknown as SessionEvent])).toBe('standard')
  })

  it('returns the latest valid mode', () => {
    const events = [modeEvent('creative', 1), modeEvent('standard', 2), modeEvent('creative', 3)]
    expect(modeOf(events)).toBe('creative')
  })

  it('skips unknown mode values and keeps the last valid one', () => {
    const events = [modeEvent('creative', 1), modeEvent('vibe', 2), modeEvent('unknown', 3)]
    expect(modeOf(events)).toBe('creative')
  })
})
