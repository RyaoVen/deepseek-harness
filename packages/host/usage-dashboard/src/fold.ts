/**
 * Pure fold of one session's durable events into usage accumulators.
 * `assistant/message` events carry the adapter-reported usage and the model
 * identity of the message source; everything else is ignored, so the fold is
 * a plain sum that replay and compaction cannot change.
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { UsageModelRow } from './types.ts'

/** One session's fold, keyed for merging into a global summary. */
export interface SessionUsageFold {
  /** Per-model rows keyed by model id. */
  byModel: Map<string, UsageModelRow>
  /** Per-day rows keyed by `YYYY-MM-DD`. */
  byDay: Map<string, { calls: number; totalTokens: number }>
  /** Per-hour rows keyed by hour. */
  byHour: Map<number, { calls: number; totalTokens: number }>
  /** Assistant messages with reported usage. */
  calls: number
  /** Total tokens across all models. */
  totalTokens: number
}

/**
 * An empty fold.
 * @returns a fold with no events folded into it.
 */
export function emptyFold(): SessionUsageFold {
  return { byModel: new Map(), byDay: new Map(), byHour: new Map(), calls: 0, totalTokens: 0 }
}

/**
 * Sum the disjoint provider usage buckets without double-counting reasoning output.
 * @param usage - the adapter-reported usage to sum.
 * @returns input + cache-read + cache-write + output tokens.
 */
export function usageTokens(usage: TokenUsage): number {
  return usage.inputTokens
    + (usage.cacheReadTokens ?? 0)
    + (usage.cacheWriteTokens ?? 0)
    + usage.outputTokens
}

/**
 * `YYYY-MM-DD` of an epoch-millisecond timestamp in UTC.
 * @param time - Unix epoch milliseconds.
 * @returns the UTC calendar day key.
 */
export function utcDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/**
 * Fold one session's events into the accumulator.
 * @param fold - accumulator to merge into.
 * @param events - the session's durable events, in append order.
 * @returns the same accumulator, mutated in place.
 */
export function foldSession(fold: SessionUsageFold, events: readonly SessionEvent[]): SessionUsageFold {
  for (const event of events) {
    if (event.type !== 'assistant/message') continue
    const usage = event.data.usage
    if (usage === undefined) continue
    // Assistant messages are model-sourced by construction; the adapter's
    // model identity is the dashboard's model key.
    const model = event.data.message.source.model
    const total = usageTokens(usage)
    const day = utcDay(event.time)
    const hour = new Date(event.time).getUTCHours()

    const row = fold.byModel.get(model) ?? {
      model,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
    }
    row.calls += 1
    row.inputTokens += usage.inputTokens
    row.outputTokens += usage.outputTokens
    row.cacheReadTokens += usage.cacheReadTokens ?? 0
    row.cacheWriteTokens += usage.cacheWriteTokens ?? 0
    row.totalTokens += total
    fold.byModel.set(model, row)

    const dayRow = fold.byDay.get(day) ?? { calls: 0, totalTokens: 0 }
    dayRow.calls += 1
    dayRow.totalTokens += total
    fold.byDay.set(day, dayRow)

    const hourRow = fold.byHour.get(hour) ?? { calls: 0, totalTokens: 0 }
    hourRow.calls += 1
    hourRow.totalTokens += total
    fold.byHour.set(hour, hourRow)

    fold.calls += 1
    fold.totalTokens += total
  }
  return fold
}

/**
 * Merge one session fold into a global accumulator.
 * @param global - accumulator to merge into.
 * @param session - the session fold to add.
 * @returns the same global accumulator, mutated in place.
 */
export function mergeFold(global: SessionUsageFold, session: SessionUsageFold): SessionUsageFold {
  global.calls += session.calls
  global.totalTokens += session.totalTokens
  for (const [model, row] of session.byModel) {
    const existing = global.byModel.get(model)
    if (existing === undefined) {
      global.byModel.set(model, { ...row })
      continue
    }
    existing.calls += row.calls
    existing.inputTokens += row.inputTokens
    existing.outputTokens += row.outputTokens
    existing.cacheReadTokens += row.cacheReadTokens
    existing.cacheWriteTokens += row.cacheWriteTokens
    existing.totalTokens += row.totalTokens
  }
  for (const [day, row] of session.byDay) {
    const existing = global.byDay.get(day)
    if (existing === undefined) {
      global.byDay.set(day, { ...row })
      continue
    }
    existing.calls += row.calls
    existing.totalTokens += row.totalTokens
  }
  for (const [hour, row] of session.byHour) {
    const existing = global.byHour.get(hour)
    if (existing === undefined) {
      global.byHour.set(hour, { ...row })
      continue
    }
    existing.calls += row.calls
    existing.totalTokens += row.totalTokens
  }
  return global
}
