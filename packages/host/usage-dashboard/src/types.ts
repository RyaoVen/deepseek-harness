/**
 * Wire vocabulary of the usage dashboard Remote: model usage folded from the
 * durable session logs, bucketed by model, calendar day (UTC), and hour of
 * day (UTC).
 */

/** One model's folded usage across every session. */
export interface UsageModelRow {
  /** Model id as recorded in assistant message sources. */
  model: string
  /** Number of completed assistant messages from this model. */
  calls: number
  /** Sum of reported input tokens (cache reads excluded). */
  inputTokens: number
  /** Sum of reported output tokens. */
  outputTokens: number
  /** Sum of reported cache-read tokens. */
  cacheReadTokens: number
  /** Sum of reported cache-write tokens. */
  cacheWriteTokens: number
  /** input + output + cache-read + cache-write. */
  totalTokens: number
}

/** One UTC calendar day's folded usage. */
export interface UsageDayRow {
  /** `YYYY-MM-DD` in UTC. */
  day: string
  /** Assistant messages recorded that day. */
  calls: number
  /** Total tokens recorded that day. */
  totalTokens: number
}

/** One UTC hour-of-day bucket's folded usage. */
export interface UsageHourRow {
  /** Hour of day, 0–23 in UTC. */
  hour: number
  /** Assistant messages recorded in that hour. */
  calls: number
  /** Total tokens recorded in that hour. */
  totalTokens: number
}

/** Complete fold of every durable session log. */
export interface UsageSummary {
  /** Assistant messages with reported usage across all sessions. */
  totalCalls: number
  /** Total tokens across all sessions. */
  totalTokens: number
  /** Per-model rows in first-seen order. */
  byModel: UsageModelRow[]
  /** Per-day rows in chronological order. */
  byDay: UsageDayRow[]
  /** Per-hour rows in hour order. */
  byHour: UsageHourRow[]
}
