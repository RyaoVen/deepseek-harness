/**
 * Agent plane of the agent-modes package: the per-agent prompt section that
 * renders the session's current mode guidance. Mounted as a preset row so it
 * runs inside the agent's scoped world, where `ctx.agent` names the session.
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the agent-association Context merge (ctx.agent).
import type {} from '@deepseek-ai/dsh-agent'
// Type-only: pulls the systemPrompt Context merge.
import type {} from '@deepseek-ai/dsh-system-prompt'
import { modeOf } from './fold.ts'
import { modeGuidance } from './types.ts'

// The agent entry ships only the runtime plugin; AgentMode stays on the
// package types subpath so the typert remote-client references it there.
export { modeGuidance } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'agent-modes-section'

/** Services required by this plugin. */
export const inject = ['systemPrompt']

/**
 * Register the live mode guidance section for the agent this plugin runs in.
 * The section text folds the mode from the agent's own session at every
 * assembly, so a switch is visible to the very next model request.
 * @param ctx - the agent-scoped context carrying the agent association.
 */
export function apply(ctx: Context): void {
  const agent = ctx.agent
  if (agent === undefined) {
    // A host-plane mount of this entry would have no session to fold; the
    // preset rows mount it in the agent realm, so this is a wiring error.
    throw new Error('agent-modes section must be mounted inside an agent realm')
  }
  ctx.systemPrompt.section({
    name: 'agent-mode',
    order: 30,
    text: () => {
      const mode = modeOf(agent.session.events)
      return `Current session mode: ${mode}\n${modeGuidance(mode)}`
    },
  })
}
