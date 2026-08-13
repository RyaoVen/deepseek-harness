# Agent Note: Model usage dashboard — four charts over the durable session logs

Status: implemented

English | [中文](2026-08-14-model-usage-dashboard.zh.md)

## Problem

Model consumption was invisible in the Web GUI: no surface answered "how many calls and tokens did my models use, and when". Session logs already carry the adapter-reported usage, but nothing folded them into a dashboard, and the requested "模型消耗仪表盘（热力图/星图/折线图/扇形图）" had no home.

## Decision

Two new packages implement a read-only usage dashboard.

`@deepseek-ai/dsh-host-usage-dashboard` is a Remote-only service (`UsageDashboardGateway`, namespace `usageDashboard`, method `summarize`) that folds every durable session log: it enumerates materialized sessions through `sessionPersistence.listSnapshots`, folds each `assistant/message` event that carries adapter-reported usage (non-model sources and usage-less events are skipped) into per-model, per-UTC-day, and per-UTC-hour buckets, and merges them into one `UsageSummary`. Sessions are cached per persistence revision, so a second call only re-reads sessions whose stored logs changed; removed sessions are evicted; a session that fails to load is skipped and logged. The fold is a pure sum (`fold.ts`), so replay and compaction cannot change it.

`@deepseek-ai/dsh-client-ui-usage-dashboard` registers one settings section (`settings.section` id `usage`, order 10, before the Plugins section) whose page renders the summary as four hand-rolled SVG charts: a 12-week Monday-anchored calendar heatmap with 0–4 call-intensity levels, a radar "star" chart of the top four models across five normalized dimensions (calls, input, output, cache read, cache write), a 30-day total-token trend line, and a per-model share donut with a legend. All chart shapes are pure projections (`projections.ts`); styling uses theme tokens only, so the charts follow accent and dark mode. A controller owns the load lifecycle: first read on mount, refresh refused while one is in flight, failed reads flagged until the next refresh.

Wiring follows the established Remote pattern: the host package ships the generated `./remote`/`./typert` artifacts, the api-remotes client assembly mounts the namespace, the Web composition gains one host row and one client row, and both typecheck aggregates reference the new projects.

## Alternatives considered

- **A live in-process accumulator fed by `session/event`** — count usage as events arrive instead of folding logs on read. Rejected: it duplicates the durable log as a second source of truth, misses everything before the process start, and must persist to survive restarts; folding the durable log on read is the same work with one source of truth.
- **Client-side aggregation** — ship all session logs to the browser and fold there. Rejected: it moves potentially large log volumes over the wire for charts the Host can compute once and cache.
- **The token-meter's estimates** — use `ctx.tokenMeter` pressure numbers as the dashboard data. Rejected: the meter prices the current context surface, not durable consumption; the dashboard's contract is per-model/per-day accounting from the log.

## Consequences

- Consumption is now a durable, replay-stable read of the session log: the numbers answer "what the adapter reported", not estimates.
- The fold cost is bounded by caching per revision; the first read after a restart folds everything once.
- UTC bucketing keeps the Host deterministic; local-time axes are a client-side follow-up.
- The Web bundle grew one host Remote and one settings section; both packages are covered by unit tests (fold, cache/eviction/failure, projections, controller, section, registrations).
