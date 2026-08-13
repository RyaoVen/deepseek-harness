/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-agent-modes`.
 * @module @deepseek-ai/dsh-agent-modes/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-agent-modes'

/** Cordis companion plugin name. */
export const name = 'agent-modes-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the mode fold is a pure latest-wins sum pinned by
 * the package's own unit tests, and the session log invariants belong to
 * dsh-session.
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
