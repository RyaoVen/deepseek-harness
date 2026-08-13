/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-desktop-decoration`.
 * @module @deepseek-ai/dsh-client-ui-desktop-decoration/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-desktop-decoration'

/** Cordis companion plugin name. */
export const name = 'ui-desktop-decoration-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the row is a single settings-slot registration whose
 * disposal is proven by the slot machinery; the shell bridge is a pure
 * availability probe pinned by unit tests.
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
