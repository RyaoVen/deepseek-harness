/**
 * Agent plane of the agent-modes package — retired entry.
 *
 * The mode guidance section used to ship as a preset row under this subpath,
 * but a preset row runs in the preset's shared standing scope, where
 * `ctx.agent` is absent and the section has no session to fold. The guidance
 * now installs from the host plane on `agent/created` (see index.ts), so this
 * entry keeps its exports subpath only as a stable address; nothing mounts it.
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: keeps the dsh-agent module (and through it the dsh-session
// module) in this program so the types subpath's SessionEventMap merge lands.
import type {} from '@deepseek-ai/dsh-agent'

export { modeGuidance } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'agent-modes-section'

/** Retired entry: the guidance is installed per agent from the host plane. */
export function apply(_ctx: Context): void {}
