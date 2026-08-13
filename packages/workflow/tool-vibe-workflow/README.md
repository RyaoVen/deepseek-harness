# @deepseek-ai/dsh-tool-vibe-workflow

English | [中文](README.zh.md)

The model-facing **`vibe` tool**: run the fixed agent-cluster workflow — the vibe mode's default process — over [`ctx.workflowEngine`](../workflow/README.md). One call runs the whole cluster: the product manager clarifies the request and archives requirements, the UI designer and the architect work in parallel, frontend and backend engineers implement the architect's modules in small parts with per-part unit tests (the architect's modules spawn one engineer instance per layer, so multiple instances run concurrently), and the test engineer reviews the whole delivery. Issues escalate back up: the architect assigns fixes, engineers apply them, and the test engineer verifies. The canned script is a package constant; this package owns the model-facing schema and run lifecycle, while parsing, execution, caps, and cancellation live behind the engine seam.

## What the model sees

Five parameters: `request` (required — the user request or implementation goal the cluster works on), `answers` (optional — user decisions answering a previous run's `openQuestions`, so a needs-input run can resume instead of starting over), and the spec-mode prefills `requirements` (a confirmed requirements archive that skips the product manager), `design` (a confirmed module-level technical design that skips the architect), and `styleGuide` (a confirmed style guide that skips the UI designer) — after a user-led design discussion, prefilling all three makes the cluster execute the whole delivery in one pass. The plugin also contributes a `tool:<toolName>` system-prompt section carrying the usage policy — use the `vibe` tool in vibe mode or when the user asks for the fixed agent-cluster workflow; when the run returns "needs-input", ask the user and re-run with the answers — per the convention that tool guidance ships with the tool plugin, never in the deployment persona.

The run's canonical value is the cluster summary: `stage` (`done`, `needs-input`, or `failed`), the requirements archive, the style guide, the architecture, the per-module engineer reports, the test report, and the escalation record when the test engineer found issues.

## Lifecycle

Collection is synchronous (like [`dsh-tool-workflow`](../tool-workflow/README.md)): `execute` starts a run and awaits `run.result` inside a `try/finally` that always disposes the run, so the script and its children reach quiescence on every path. `exec.signal` is bridged to `run.cancel()` (including the already-aborted-before-start case). A non-`completed` stop reason maps to an `isError` result reporting the reason — never partial output as success. Completion returns canonical `{ runId, agentsStarted, result }`; the Native renderer preserves the request, agent count, and JSON value, truncating only that projection at `maxResultChars`.

## Render intent

Decided up front (per the [render-intent Agent Note](../../../.agents/notes/implemented/architecture/2026-07-02-tool-render-intent-union.md)): a `generic` card titled `vibe`, with the request text riding as `rawInput` (presentation is a pure function of args). The result keeps the generic card.

## Config

| Key | Default | Meaning |
|---|---|---|
| `toolName` | `vibe` | The model-facing tool name to register. |
| `maxResultChars` | `50000` | Rendered-result ceiling; longer JSON is truncated with a notice. |

## Model Experience

### System prompt

#### What the model sees

Every parent request in this plugin's registration scope receives the vibe guidance below. A scoped tool restriction can hide the schema without removing this independently registered guidance.

##### Vibe guidance

```markdown
Use the <toolName> tool when the session is in vibe mode or the user asks for the fixed agent-cluster workflow. It runs the whole cluster in one call; when it returns "needs-input", ask the user the open questions and re-run with the answers.
```

#### Token effect

Small fixed guidance cost per request while the plugin is active.

#### KV Cache effect

Prefix-stable while the plugin scope and guidance text are unchanged. Activation or disposal may invalidate reuse from this prompt section.

### Tool schema

#### What the model sees

The generated default [`vibe` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-vibe-workflow) carries the `request` and `answers` parameters; `toolName` can rename the definition, and the model submits the request (and optional answers from a previous run).

#### Token effect

Small fixed schema cost on each request where the tool is visible.

#### KV Cache effect

Prefix-stable while `toolName`, definition, and visibility are unchanged. Renaming, plugin lifecycle, or scoped restrictions may invalidate reuse from this schema.

### Tool-call history and result

#### What the model sees

The request and answers remain in the assistant tool call. Success is exactly `vibe cluster completed (<count> agent<optional-s>) for: <request>.`, newline, `Return value:`, newline, and pretty-printed data-dependent JSON; a cap adds `… [truncated: <omitted> more characters]` on a new line. Failures are exactly `Error: vibe run was cancelled`, optionally suffixed ` (<error>)`, `Error: vibe run failed: <error-or-unknown error>`, or defensively `Error: vibe run ended abnormally (<reason>)`; a call without an owning agent becomes `Error: vibe tool requires a calling agent (exec.agent was undefined)`. Intermediate child messages are omitted.

#### Token effect

Call tokens can be large and remain until compaction. Result rendering is capped by `maxResultChars`; child-model tokens are separate from the parent's retained context.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

- **The parent turn blocks until the whole cluster settles** — there is no background start/poll API, and cancellation discards partial output as an error.
- **One escalation round** — the cluster fixes and re-verifies once; a second round of issues remains in the verification report for the calling agent to act on.
- **Children may not reach the user** — the cluster routes user decisions through the calling agent: open questions surface as `needs-input` and the caller re-runs with answers; a child that has the `ask_user` tool may ask directly.
- **Prefills are trusted, not re-validated** — a spec-mode `design` prefill must carry the module shape (`modules` with `id`/`title`/`layer`/`tasks`/`acceptance`); the script fails loud when the modules array is missing.
- **Engine and provider caps apply** — module fan-out is bounded by the workflow engine's concurrency and total-agent caps.
