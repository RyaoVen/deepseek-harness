/**
 * Replay-stable fold of a session's mode: the latest `mode/set` event wins,
 * the default is `standard`.
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { DEFAULT_AGENT_MODE, isAgentMode, MODE_SET_EVENT, type AgentMode } from './types.ts'

/**
 * Fold the current mode from a session's durable events.
 * @param events - the session's events, in append order.
 * @returns the latest valid `mode/set` value, or the default.
 */
export function modeOf(events: readonly SessionEvent[]): AgentMode {
  let mode: AgentMode = DEFAULT_AGENT_MODE
  for (const event of events) {
    // The mode/set key extends the merge-extensible SessionEventMap; programs
    // that do not know the key narrow event.type to their own key union, so
    // compare through the widened string before reading the payload.
    const type: string = event.type
    if (type !== MODE_SET_EVENT) continue
    const candidate = event.data as { mode: unknown }
    if (isAgentMode(candidate.mode)) mode = candidate.mode
  }
  return mode
}
