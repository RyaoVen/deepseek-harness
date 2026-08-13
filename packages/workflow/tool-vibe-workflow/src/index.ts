/**
 * The model-facing `vibe` tool: run the fixed agent-cluster workflow (the
 * vibe mode's default process) over `ctx.workflowEngine`. The canned script
 * orchestrates the product manager, the parallel UI designer and architect,
 * the per-module frontend/backend engineers, and the test engineer, with
 * issue escalation back up the chain. The tool owns the model-facing schema
 * and run lifecycle; parsing, execution, caps, and cancellation live behind
 * the engine seam.
 *
 * Render intent (decided up front): a `generic` card titled `vibe`, with the
 * request text riding as raw input; the result keeps the generic card.
 *
 * @module @deepseek-ai/dsh-tool-vibe-workflow
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallView, ToolResultView } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type { WorkflowResult } from '@deepseek-ai/dsh-workflow'
// Declaration merge only: makes ctx.systemPrompt visible for the section registration.
import type {} from '@deepseek-ai/dsh-system-prompt'
import { VIBE_WORKFLOW_SCRIPT } from './script.ts'

export { VIBE_WORKFLOW_SCRIPT } from './script.ts'

export const name = 'tool-vibe-workflow'
export const inject = ['tools', 'workflowEngine', 'systemPrompt']

/** Config: the model-facing tool name plus result rendering caps. */
export interface Config {
  /** The model-facing tool name to register (default `vibe`). */
  toolName?: string
  /** Rendered-result ceiling, in characters: a longer JSON value is truncated with a notice (default 50000). */
  maxResultChars?: number
}

export const Config: z<Config> = z.object({
  toolName: z.string().default('vibe'),
  maxResultChars: z.natural().min(1).default(50_000),
})

type ResolvedConfig = Required<Config>

type VibeCallArgs = {
  request: string
  answers?: Record<string, JsonValue>
  /** Spec-mode prefill: a confirmed requirements archive (skips the product manager). */
  requirements?: Record<string, JsonValue>
  /** Spec-mode prefill: a confirmed module-level technical design (skips the architect). */
  design?: Record<string, JsonValue>
  /** Spec-mode prefill: a confirmed style guide (skips the UI designer). */
  styleGuide?: Record<string, JsonValue>
}

/** The workflow identity: the fixed cluster's progress vocabulary. */
const VIBE_META = {
  name: 'vibe-cluster',
  description: 'Fixed agent-cluster workflow: product manager, parallel UI designer and architect, per-module engineers, test engineer, issue escalation.',
  whenToUse: 'The vibe session mode defaults to this cluster for implementation work.',
  phases: [
    { title: 'product', detail: 'Product manager clarifies and archives requirements' },
    { title: 'design', detail: 'UI designer and architect work in parallel' },
    { title: 'implement', detail: 'Frontend and backend engineers implement per module' },
    { title: 'test', detail: 'Test engineer reviews the whole delivery' },
    { title: 'escalate', detail: 'Architect assigns fixes for reported issues' },
    { title: 'fix', detail: 'Engineers apply the assigned fixes' },
    { title: 'verify', detail: 'Test engineer verifies the fixes' },
  ],
}

/** The model-facing contract: what the vibe tool does and what the run returns. */
const DESCRIPTION = `Run the fixed agent-cluster workflow (the vibe mode default): the product manager clarifies the request and archives requirements, the UI designer and the architect work in parallel, frontend and backend engineers implement the architect's modules in small parts with per-part unit tests (the architect can spawn multiple engineer instances per module), and the test engineer reviews the whole delivery and runs the tests. Issues reported by the test engineer escalate back up: the architect assigns fixes, the engineers apply them, and the test engineer verifies.

When the run returns "needs-input", ask the user the listed openQuestions, then re-run the vibe tool with those answers in the "answers" parameter instead of starting over.

Spec mode prefill: after a user-led design discussion, pass the confirmed artifacts so the cluster skips the matching phases and executes in one pass — "requirements" (a requirements archive: title, goal, requirements, assumptions) skips the product manager, "design" (a technical design whose modules each carry id, title, layer, tasks, acceptance) skips the architect, and "styleGuide" skips the UI designer. The engineers, test engineer, and escalation still run.`

/** A non-`completed` stop reason means the run did not finish cleanly. */
function stopReasonError(result: WorkflowResult): string | undefined {
  switch (result.stopReason) {
    case 'completed':
      return undefined
    case 'cancelled':
      return `vibe run was cancelled${result.error !== undefined ? ` (${result.error})` : ''}`
    case 'error':
      return `vibe run failed: ${result.error ?? 'unknown error'}`
    /* v8 ignore start -- defensive: WorkflowStopReason is a closed union, exhaustive by construction; a future variant fails here loudly */
    default:
      return `vibe run ended abnormally (${String(result.stopReason satisfies never)})`
    /* v8 ignore stop */
  }
}

/** Render the run's outcome text: the request, agent count, and the JSON value (capped). */
function renderResult(request: string, agentsStarted: number, value: JsonValue, maxChars: number): string {
  const rendered = JSON.stringify(value, null, 2)
  const clipped = rendered.length > maxChars
    ? `${rendered.slice(0, maxChars)}\n… [truncated: ${rendered.length - maxChars} more characters]`
    : rendered
  return `vibe cluster completed (${agentsStarted} agent${agentsStarted === 1 ? '' : 's'}) for: ${request}\nReturn value:\n${clipped}`
}

/** The pending-state card: a generic card titled `vibe`, request as raw input. */
function presentVibeCall(args: VibeCallArgs): ToolCallView {
  return {
    card: 'generic',
    title: 'vibe',
    rawInput: args.request,
  }
}

/** The completed-state card: keep the generic card; render the result content as-is. */
function presentVibeResult(_args: VibeCallArgs, _result: { content: ContentBlock[]; isError: boolean }): ToolResultView {
  return { card: 'generic' }
}

/** Register the vibe tool and its usage guidance section. */
export function apply(ctx: Context, config: Config): void {
  // schemastery (the exported Config schema) has already filled the defaulted
  // fields; the assertion records that resolution, not a hidden fallback.
  const { toolName, maxResultChars } = config as ResolvedConfig
  ctx.systemPrompt.section({
    name: `tool:${toolName}`,
    order: 116,
    text: `Use the ${toolName} tool when the session is in vibe mode or the user asks for the fixed agent-cluster workflow. It runs the whole cluster in one call; when it returns "needs-input", ask the user the open questions and re-run with the answers.`,
  })
  ctx.tools.register(defineTool({
    name: toolName,
    description: DESCRIPTION,
    parameters: {
      request: {
        type: 'string',
        required: true,
        description: 'The user request or implementation goal the cluster works on.',
      },
      answers: {
        type: 'object',
        additionalProperties: true,
        description: 'Optional user decisions answering a previous run\'s openQuestions; re-run with them instead of starting over.',
      },
      requirements: {
        type: 'object',
        additionalProperties: true,
        description: 'Spec-mode prefill: a confirmed requirements archive; skips the product manager phase.',
      },
      design: {
        type: 'object',
        additionalProperties: true,
        description: 'Spec-mode prefill: a confirmed module-level technical design; skips the architect phase.',
      },
      styleGuide: {
        type: 'object',
        additionalProperties: true,
        description: 'Spec-mode prefill: a confirmed style guide; skips the UI designer phase.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          runId: { type: 'string', required: true },
          agentsStarted: { type: 'integer', required: true },
          result: { type: 'json', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: renderResult(args.request, value.agentsStarted, value.result, maxResultChars),
      }],
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (!parent) {
        // The loop sets `exec.agent` for every model-driven call; its absence
        // means a non-agent caller invoked the tool directly, which has no
        // parent to attribute the children to. Fail loud rather than guess.
        throw new Error('vibe tool requires a calling agent (exec.agent was undefined)')
      }
      const run = ctx.workflowEngine.start({
        script: VIBE_WORKFLOW_SCRIPT,
        meta: VIBE_META,
        args: {
          request: args.request,
          ...args.answers !== undefined ? { answers: args.answers } : {},
          ...args.requirements !== undefined ? { requirements: args.requirements } : {},
          ...args.design !== undefined ? { design: args.design } : {},
          ...args.styleGuide !== undefined ? { styleGuide: args.styleGuide } : {},
        },
        parent,
        signal: exec.signal,
      })
      const onAbort = (): void => { run.cancel('parent step aborted') }
      exec.signal.addEventListener('abort', onAbort, { once: true })
      let result: WorkflowResult | undefined
      try {
        result = await run.result
        const error = stopReasonError(result)
        if (error !== undefined) {
          // Map a non-clean finish to an isError result (the registry turns a
          // throw into an isError). Report the reason, not partial output.
          throw new Error(error)
        }
        return {
          runId: run.id,
          agentsStarted: result.agentsStarted,
          result: result.value as JsonValue,
        }
      } finally {
        exec.signal.removeEventListener('abort', onAbort)
        try {
          // Keep member listeners alive through disposal: an engine may
          // synthesize cancelled member endings while reaching quiescence.
          await run.dispose()
        } finally {
          /* v8 ignore start -- WorkflowRun.result never rejects by contract, so result is assigned before finally */
          if (result === undefined) throw new Error('vibe run settled without a result')
          /* v8 ignore stop */
        }
      }
    },
    presentCall: args => presentVibeCall(args),
    presentResult: (args, result) => presentVibeResult(args, result),
  }))
}
