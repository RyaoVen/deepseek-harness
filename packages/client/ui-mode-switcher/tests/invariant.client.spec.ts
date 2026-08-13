/** The package's invariant companion reserves package ownership. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as ModeSwitcherInvariant from '@deepseek-ai/dsh-client-ui-mode-switcher/invariant'

describe('invariant companion', () => {
  it('reserves package ownership with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })

    await expect(ctx.plugin(ModeSwitcherInvariant).await()).resolves.toBeDefined()
  })

  it('names itself for loader diagnostics', () => {
    expect(ModeSwitcherInvariant.name).toBe('client-ui-mode-switcher-invariant')
    expect(ModeSwitcherInvariant.inject).toEqual(['invariants'])
  })
})
