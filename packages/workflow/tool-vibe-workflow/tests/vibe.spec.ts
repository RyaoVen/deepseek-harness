/**
 * The vibe tool: canned-script handoff to the workflow engine, result
 * rendering, stop-reason mapping, and the no-agent guard. The engine is
 * stubbed behind the tool's only seam; the canned script gets a syntax
 * smoke test and a phase/role sanity pass.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { WorkflowRunId, WorkflowEngine } from '@deepseek-ai/dsh-workflow'
import type { WorkflowResult, WorkflowRun, WorkflowStartRequest } from '@deepseek-ai/dsh-workflow'
import { CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import * as vibeTool from '../src/index.ts'
import { VIBE_WORKFLOW_SCRIPT } from '../src/script.ts'

const testToolSignal = new AbortController().signal

/** A controllable engine standing in behind ctx.workflowEngine (the tool's only seam). */
class StubEngine extends WorkflowEngine {
  requests: WorkflowStartRequest[] = []
  cancels: string[] = []
  disposed = 0
  readonly settlements = new Map<string, (result: WorkflowResult) => void>()

  start(request: WorkflowStartRequest): WorkflowRun {
    this.requests.push(request)
    const id = WorkflowRunId(`run-${this.requests.length}`)
    const result = new Promise<WorkflowResult>((resolve) => {
      this.settlements.set(String(id), resolve)
    })
    request.signal?.addEventListener('abort', () => {
      this.settleRun(String(id), { value: null, stopReason: 'cancelled', error: 'signal', agentsStarted: 0 })
    }, { once: true })
    return {
      id,
      meta: request.meta,
      result,
      cancel: (reason?: string) => {
        this.cancels.push(reason ?? 'cancelled')
        this.settleRun(String(id), {
          value: null, stopReason: 'cancelled', ...reason !== undefined ? { error: reason } : {}, agentsStarted: 0,
        })
      },
      dispose: async () => {
        this.disposed += 1
        this.settlements.delete(String(id))
      },
    }
  }

  settleRun(id: string, result: WorkflowResult): void {
    const settle = this.settlements.get(id)
    if (settle === undefined) throw new Error(`unknown stub workflow ${id}`)
    settle(result)
  }
}

async function setup(config?: { toolName?: string; maxResultChars?: number }) {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(StubEngine)
  await ctx.plugin(vibeTool, config ?? {})
  const engine = ctx.workflowEngine as StubEngine
  const session = Session.create(SessionId('caller'))
  const parent = { id: session.id, options: {}, session } as unknown as Agent
  return { ctx, engine, parent, session }
}

function execute(ctx: Context, args: unknown, agent?: Agent): Promise<ToolExecutionResult> {
  return ctx.tools.execute({
    signal: testToolSignal,
    callId: CallId('call-1'),
    name: 'vibe',
    arguments: args,
    ...agent === undefined ? {} : { agent },
  })
}

const DONE_VALUE = {
  stage: 'done',
  requirements: { title: 't', goal: 'g', requirements: [], assumptions: [], openQuestions: [] },
  styleGuide: { stylePrinciples: [] },
  architecture: { modules: [] },
  engineers: [],
  testReport: { passed: true, issues: [], report: 'ok' },
  escalated: null,
}

describe('dsh-tool-vibe-workflow', () => {
  it('registers the vibe tool with a required request parameter', async () => {
    const { ctx } = await setup()
    const tool = ctx.tools.get('vibe', undefined)
    expect(tool).toBeDefined()
    const schema = JSON.stringify(ctx.tools.schemas())
    expect(schema).toContain('"request"')
    expect(schema).toContain('"required"')
  })

  it('starts a run with the canned script, meta, args, parent, and signal, and renders the completed value', async () => {
    const { ctx, engine, parent } = await setup()
    const pending = execute(ctx, { request: 'build a todo app' }, parent)

    await vi.waitFor(() => { expect(engine.requests).toHaveLength(1) })
    const request = engine.requests[0]!
    expect(request.script).toBe(VIBE_WORKFLOW_SCRIPT)
    expect(request.meta.name).toBe('vibe-cluster')
    expect(request.args).toEqual({ request: 'build a todo app' })
    expect(request.parent).toBe(parent)
    expect(request.signal).toBeDefined()

    engine.settleRun('run-1', { value: DONE_VALUE, stopReason: 'completed', agentsStarted: 4 })
    const result = await pending
    expect(result.isError).toBe(false)
    expect(result.value).toMatchObject({ runId: 'run-1', agentsStarted: 4 })
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('vibe cluster completed (4 agents) for: build a todo app')
    expect(text).toContain('"stage": "done"')
  })

  it('forwards user answers to the script args', async () => {
    const { ctx, engine, parent } = await setup()
    const pending = execute(ctx, { request: 'build a todo app', answers: { theme: 'dark' } }, parent)
    await vi.waitFor(() => { expect(engine.requests).toHaveLength(1) })
    expect(engine.requests[0]!.args).toEqual({ request: 'build a todo app', answers: { theme: 'dark' } })
    engine.settleRun('run-1', { value: DONE_VALUE, stopReason: 'completed', agentsStarted: 4 })
    await pending
  })

  it('maps a non-completed stop reason to an isError result', async () => {
    const { ctx, engine, parent } = await setup()
    const pending = execute(ctx, { request: 'build a todo app' }, parent)
    await vi.waitFor(() => { expect(engine.requests).toHaveLength(1) })
    engine.settleRun('run-1', { value: null, stopReason: 'error', error: 'boom', agentsStarted: 0 })
    const result = await pending
    expect(result.isError).toBe(true)
    expect((result.content[0] as { text: string }).text).toContain('vibe run failed: boom')
  })

  it('rejects a call without an owning agent', async () => {
    const { ctx } = await setup()
    const result = await execute(ctx, { request: 'build a todo app' })
    expect(result.isError).toBe(true)
    expect((result.content[0] as { text: string }).text).toContain('requires a calling agent')
  })

  it('honors a configured tool name', async () => {
    const { ctx } = await setup({ toolName: 'vibe-cluster' })
    expect(ctx.tools.get('vibe-cluster', undefined)).toBeDefined()
    expect(ctx.tools.get('vibe', undefined)).toBeUndefined()
  })

  it('canned script is syntactically valid and covers every cluster phase', () => {
    // Constructing (not invoking) the async wrapper validates syntax; the
    // engine provides the hooks at runtime. The wrapper is never executed,
    // so the Function constructor only proves the grammar the engine parses.
    // oxlint-disable-next-line typescript/no-implied-eval
    expect(() => new Function(`return (async () => {\n${VIBE_WORKFLOW_SCRIPT}\n})()`)).not.toThrow()
    for (const phase of ['product', 'design', 'implement', 'test', 'escalate', 'fix', 'verify']) {
      expect(VIBE_WORKFLOW_SCRIPT).toContain(`phase("${phase}")`)
    }
    for (const role of ['PRODUCT MANAGER', 'UI DESIGNER', 'ARCHITECT', 'ENGINEER', 'TEST ENGINEER']) {
      expect(VIBE_WORKFLOW_SCRIPT).toContain(role)
    }
    expect(VIBE_WORKFLOW_SCRIPT).not.toContain('${')
    expect(VIBE_WORKFLOW_SCRIPT).not.toContain('`')
  })
})
