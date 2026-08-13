# Agent Note: Design mode with hard tool blocking

Status: implemented

English | [中文](2026-08-15-design-mode.zh.md)

## Problem

The mode system shipped with advisory modes only: a mode changed the prompt section, never the tool set, so a design session could still read files and run commands — exactly what "设计模式 — 仅思考与出方案，禁读写与命令" (design mode: think and produce designs only, no reads/writes and no commands) must forbid. Enforcement belongs to the mode package, not the loop.

## Decision

`design` joins the `AgentMode` union (`standard`/`creative`/`design`), and the host plane of `@deepseek-ai/dsh-agent-modes` gains a tool guard mounted inside the same `apply()` as the mode service, so the existing Web host row activates it with no new wiring.

The guard listens on the `tools/pre-execute` waterfall — the same seam the approval gate uses, so a denial materializes as a normal tool error before any capability runs. It folds the calling agent's mode from `exec.agent.session.events` and, in design mode, denies the filesystem read/write family (`read`, `write`, `edit`, `read_image`, `glob`, `grep`) and the command executors (`bash`, `pwsh`) with a model-facing reason; every other call delegates. Calls without an agent are never blocked, and modes other than design never block.

The design-mode guidance text (prompt section) tells the agent to default to delegating research and argumentation to subagents and to summarize their findings — the "主 agent 汇总" loop — while the guard keeps research tools (web search, subagents, skills) available, because design mode delegates research by construction.

## Alternatives considered

- **Prompt-only guidance** — the section text alone says "do not read or run commands". Rejected: advisory text leaks on prompt drift, retries, and multi-turn pressure; the issue explicitly asks for a ban (禁), and the pre-execute waterfall enforces it with no loop changes.
- **Guard in the agent plane** — each agent realm registers its own listener. Rejected: the tools registry is host-plane and the waterfall already routes per-agent through the carrier scope; one host-plane listener covers every session with the same fold.
- **Tool-kind registry field** — add a `category` to tool definitions and block by category. Rejected: the tool schema has no kind field and adding one touches every registration; the blocklist is the mode's own policy constant, kept next to the mode vocabulary.

## Consequences

- A design-mode session cannot read, write, or run commands through the standard tool surface, even if the model attempts it; the denial is a normal `isError` tool result the model can route on.
- Research tools stay available, so the design workflow (delegate research to subagents, summarize into a design) works inside the mode.
- The mode union, the command popup, the mode guidance, the tool-catalog type declaration, and the package READMEs all grow the third mode; fold and switch tests cover it, and the guard has its own unit tests (deny in design mode, delegate otherwise, no-agent calls never block).
