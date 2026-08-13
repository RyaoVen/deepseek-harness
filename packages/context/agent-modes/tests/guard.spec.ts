/**
 * The design-mode tool guard: blocked filesystem/command tools are denied
 * before dispatch for a design-mode session, everything else delegates, and
 * calls without an agent (or outside design mode) are untouched.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import { SessionStore } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { apply, DESIGN_BLOCKED_TOOLS, designModeDenial, SessionModes } from '@deepseek-ai/dsh-agent-modes'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

/** A blocked filesystem tool (tool-fs registers `read`). */
const readTool = defineContentToolFixture({
  name: 'read',
  description: 'reads a file',
  parameters: {},
  async execute() {
    return [{ type: 'text' as const, text: 'file content' }]
  },
})

/** A tool design mode must still allow (research/delegation surface). */
const probeTool = defineContentToolFixture({
  name: 'probe',
  description: 'probes something',
  parameters: {},
  async execute() {
    return [{ type: 'text' as const, text: 'ok' }]
  },
})

async function boot(): Promise<{ ctx: Context; modes: SessionModes }> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(apply)
  ctx.tools.register(readTool)
  ctx.tools.register(probeTool)
  return { ctx, modes: ctx.get('sessionModes') as SessionModes }
}

/** A minimal agent handle; the guard reads only `agent.session.events`. */
function agentOf(session: Session): Agent {
  return { session } as unknown as Agent
}

function run(ctx: Context, name: string, agent?: Agent) {
  return ctx.tools.execute({
    callId: CallId('c1'),
    name,
    arguments: {},
    signal: new AbortController().signal,
    ...(agent === undefined ? {} : { agent }),
  })
}

describe('design-mode tool guard', () => {
  it('denies a blocked tool for a design-mode session with the model-facing reason', async () => {
    const { ctx, modes } = await boot()
    const session = ctx.sessions.create()
    modes.set(session, 'design')

    const result = await run(ctx, 'read', agentOf(session))
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: `Error: ${designModeDenial('read')}` }])
  })

  it('delegates a non-blocked tool in design mode', async () => {
    const { ctx, modes } = await boot()
    const session = ctx.sessions.create()
    modes.set(session, 'design')

    const result = await run(ctx, 'probe', agentOf(session))
    expect(result.isError).toBe(false)
    expect(result.content).toEqual([{ type: 'text', text: 'ok' }])
  })

  it('delegates blocked tools outside design mode', async () => {
    const { ctx } = await boot()
    const session = ctx.sessions.create()

    const result = await run(ctx, 'read', agentOf(session))
    expect(result.isError).toBe(false)
  })

  it('delegates calls without an agent even in design mode', async () => {
    const { ctx, modes } = await boot()
    const session = ctx.sessions.create()
    modes.set(session, 'design')

    const result = await run(ctx, 'read')
    expect(result.isError).toBe(false)
  })

  it('covers the filesystem read/write family and the command executors', () => {
    expect(DESIGN_BLOCKED_TOOLS).toEqual([
      'read', 'write', 'edit', 'read_image', 'glob', 'grep', 'bash', 'pwsh',
    ])
  })
})
