/**
 * Design-mode tool guard, host plane: while a session runs in design mode,
 * filesystem read/write and command tools are denied before dispatch. The
 * mode guidance tells the model not to call them; this waterfall enforces
 * it, so the block holds even when a prompt leaks or a caller retries.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { modeOf } from './fold.ts'
import { DESIGN_MODE } from './types.ts'

/**
 * Tool names blocked in design mode: the filesystem read/write family
 * (`read`, `write`, `edit`, `read_image` from dsh-tool-fs; `glob`, `grep`
 * from dsh-tool-fs-search) and the command executors (`bash` from
 * dsh-tool-bash, `pwsh` from dsh-tool-pwsh). Research tools (web search,
 * subagents, skills) stay available: design mode delegates research.
 */
export const DESIGN_BLOCKED_TOOLS: readonly string[] = [
  'read', 'write', 'edit', 'read_image', 'glob', 'grep', 'bash', 'pwsh',
]

/** Cordis plugin name used by loader diagnostics. */
export const name = 'design-mode-guard'

/**
 * The deny reason the model sees when a blocked tool fires in design mode.
 * @param toolName - the blocked tool the model attempted.
 * @returns the model-facing denial message.
 */
export function designModeDenial(toolName: string): string {
  return `tool "${toolName}" is disabled in design mode: the session only produces designs, and filesystem/command tools are blocked`
}

/**
 * The pre-execute decision for one call: deny blocked tools when the calling
 * agent's session is in design mode, delegate everything else.
 * @param exec - the pending tool execution carrying the calling agent.
 * @param next - the waterfall continuation.
 * @returns the deny decision, or the delegated continuation result.
 */
export function designModePreExecute(
  exec: ToolExecution,
  next: () => Promise<PreToolDecision>,
): Promise<PreToolDecision> {
  const agent = exec.agent
  if (agent === undefined) return next()
  if (modeOf(agent.session.events) !== DESIGN_MODE) return next()
  if (!DESIGN_BLOCKED_TOOLS.includes(exec.name)) return next()
  return Promise.resolve({ kind: 'deny', reason: designModeDenial(exec.name) })
}

/**
 * Register the design-mode guard on the tools pre-execute waterfall.
 * @param ctx - the host context carrying the tools registry.
 */
export function apply(ctx: Context): void {
  ctx.on('tools/pre-execute', designModePreExecute)
}
