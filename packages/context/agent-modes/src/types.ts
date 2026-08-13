/**
 * The durable session-mode vocabulary: the mode enum, the `mode/set` log
 * event, and the per-mode guidance text the prompt section renders.
 */

// Type-only: pulls the SessionEventMap interface into programs that read the
// mode/set event. The types subpath keeps the host SessionStore Context merge
// (dsh-session root) out of client-plane programs.
import type {} from '@deepseek-ai/dsh-session/types'

/** One selectable agent mode. */
export type AgentMode = 'standard' | 'creative' | 'design'

/** The known mode values, in UI order. */
export const AGENT_MODES: readonly AgentMode[] = ['standard', 'creative', 'design']

/** The mode a session runs under before any `mode/set` event. */
export const DEFAULT_AGENT_MODE: AgentMode = 'standard'

/** The design mode value: think and produce designs only, no I/O. */
export const DESIGN_MODE: AgentMode = 'design'

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    /**
     * The session's current mode, appended on every switch. Latest write wins
     * on replay; purely advisory for future turns, so readers that do not know
     * the type may safely skip it.
     */
    'mode/set': { mode: AgentMode }
  }
}

/**
 * Whether a value names a known mode.
 * @param value - the candidate value.
 * @returns true when the value is one of the known modes.
 */
export function isAgentMode(value: unknown): value is AgentMode {
  return AGENT_MODES.includes(value as AgentMode)
}

/** Mode guidance text for the prompt section. */
const MODE_GUIDANCE: Record<AgentMode, string> = {
  standard: 'You are in standard mode: follow the request directly with the default working style.',
  creative: 'You are in creative mode: prefer novel approaches, explore alternatives before committing, and say so when a more conventional path would be safer.',
  design: 'You are in design mode: think and produce designs only. Filesystem and command tools are blocked and will be denied, so do not attempt read, write, edit, glob, grep, bash, or pwsh. Default to delegating research and argumentation to subagents, then summarize their findings into the design.',
}

/**
 * The guidance paragraph for one mode.
 * @param mode - the mode to describe.
 * @returns the mode's prompt-section text.
 */
export function modeGuidance(mode: AgentMode): string {
  return MODE_GUIDANCE[mode]
}

/** The `mode/set` event type name. */
export const MODE_SET_EVENT = 'mode/set'
