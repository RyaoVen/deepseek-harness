/** The package's invariant companion reserves package ownership. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as ExtensionsCenterInvariant from '@deepseek-ai/dsh-extensions-center/invariant'

describe('invariant companion', () => {
  it('reserves package ownership with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })

    await expect(ctx.plugin(ExtensionsCenterInvariant).await()).resolves.toBeDefined()
  })

  it('names itself for loader diagnostics', () => {
    expect(ExtensionsCenterInvariant.name).toBe('extensions-center-invariant')
    expect(ExtensionsCenterInvariant.inject).toEqual(['invariants'])
  })
})
