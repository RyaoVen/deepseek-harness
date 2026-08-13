/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-usage-dashboard`.
 * @module @deepseek-ai/dsh-host-usage-dashboard/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-usage-dashboard'

/** Cordis companion plugin name. */
export const name = 'host-usage-dashboard-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the gateway folds durable session logs, and the
 * session-persistence package owns the log invariants; the fold itself is a
 * pure sum pinned by the package's own unit tests.
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
