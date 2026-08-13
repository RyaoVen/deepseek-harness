/** The package's invariant companion reserves package ownership. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as UsageDashboardInvariant from '@deepseek-ai/dsh-client-ui-usage-dashboard/invariant'

describe('invariant companion', () => {
  it('reserves package ownership with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })

    await expect(ctx.plugin(UsageDashboardInvariant).await()).resolves.toBeDefined()
  })

  it('names itself for loader diagnostics', () => {
    expect(UsageDashboardInvariant.name).toBe('client-ui-usage-dashboard-invariant')
    expect(UsageDashboardInvariant.inject).toEqual(['invariants'])
  })
})
