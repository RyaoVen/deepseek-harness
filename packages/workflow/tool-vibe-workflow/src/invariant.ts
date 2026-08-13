/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-tool-vibe-workflow`.
 * @module @deepseek-ai/dsh-tool-vibe-workflow/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-tool-vibe-workflow'

/** Cordis companion plugin name. */
export const name = 'tool-vibe-workflow-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the canned script and the tool's engine handoff are
 * pinned by the package's own unit tests, and workflow-run invariants belong
 * to dsh-workflow.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
