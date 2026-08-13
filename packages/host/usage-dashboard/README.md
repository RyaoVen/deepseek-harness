# @deepseek-ai/dsh-host-usage-dashboard

English | [中文](README.zh.md)

Read-only Host projection of model usage folded from every durable session log. `UsageDashboardGateway` registers the `usageDashboard` service and publishes one generated direct Remote, `usageDashboard/summarize`. Each call enumerates the materialized sessions, folds every `assistant/message` event that carries adapter-reported usage (skipping non-model sources and events without usage), and returns per-model, per-UTC-day, and per-UTC-hour buckets plus totals.

Sessions are cached per persistence revision: a second call re-reads only sessions whose stored logs changed, and sessions that disappeared are evicted from the cache. A session that fails to load is skipped and logged, so one corrupt log never takes the dashboard down. The fold itself is a pure sum over the durable log — replay and compaction cannot change it.

The service is Remote-only and deliberately declares no same-process Cordis `Context` merge. Client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

## Model Experience

None, as this Host-only usage projection registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **UTC bucketing only** — days and hours are bucketed in UTC, so a deployment far from UTC sees its calendar shift; local-time bucketing belongs to the client and is deferred.
- **Calls count assistant messages, not provider requests** — an adapter-reported `assistant/message` is the unit, so a request retried or split by the provider still counts once per assembled message.
- **Cache is process-local** — the per-revision fold cache lives in the running Host; a restart re-folds every session on the first dashboard read.
