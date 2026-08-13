/** The package's invariant companion reserves package ownership. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as AgentModesInvariant from '@deepseek-ai/dsh-agent-modes/invariant'

describe('invariant companion', () => {
  it('reserves package ownership with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })

    await expect(ctx.plugin(AgentModesInvariant).await()).resolves.toBeDefined()
  })

  it('names itself for loader diagnostics', () => {
    expect(AgentModesInvariant.name).toBe('agent-modes-invariant')
    expect(AgentModesInvariant.inject).toEqual(['invariants'])
  })
})
