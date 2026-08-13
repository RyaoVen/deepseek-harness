/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-mode-switcher`.
 * @module @deepseek-ai/dsh-client-ui-mode-switcher/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-mode-switcher'

/** Cordis companion plugin name. */
export const name = 'client-ui-mode-switcher-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this is a browser-side command surface whose node
 * half owns no event stream or mutable runtime data; the durable mode state
 * is dsh-agent-modes' contract, covered by that package's tests.
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
