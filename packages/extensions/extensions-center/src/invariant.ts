/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-extensions-center`.
 * @module @deepseek-ai/dsh-extensions-center/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-extensions-center'

/** Cordis companion plugin name. */
export const name = 'extensions-center-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the node half owns no event stream of its own — the
 * mcp-client fibers and the skill files it drives are covered by the owning
 * packages' invariants, and the browser half is a settings surface whose
 * layering and write refusals are Host contracts.
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
