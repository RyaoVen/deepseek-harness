# Agent Note: Per-model wire-protocol selection in llm-pi-ai

Status: implemented

English | [中文](2026-08-13-pi-ai-per-model-protocol-selection.zh.md)

## Problem

A provider route's `api` was a route-level fact: every model on the route spoke one protocol. Multi-protocol gateways — OpenCode, GitHub Copilot, and hand-declared aggregators — serve models across `openai-completions`, `openai-responses`, and `anthropic-messages` behind one endpoint and one key, and a deployment using such a gateway wants one route whose models each speak their own protocol. The configuration could only repoint the whole route, which forced one route per protocol and restating the endpoint, key, and capacities for each.

## Decision

Model entries — `models` items and `modelOverrides` values — may name `api`, and resolution goes entry `api` → route `api` → installed catalog entry → the protocol the route's shipped models agree on. Only two spellings are accepted: a protocol in `supportedProtocols()`, or the installed catalog model's own api, which restates the default and repoints nothing; anything else fails resolution naming the route and model. A route on which any model's api diverges from the route-level answer is **repointed**, and resolution then requires every model on it to speak a `supportedProtocols()` protocol — a catalog-only sibling (for example `bedrock-converse-stream`) fails resolution rather than being served by a provider that cannot be built beside the repoint. Provider construction gains a third shape for such routes: a dispatching provider whose `stream`/`streamSimple` resolve the protocol implementation per request from `model.api` through the same protocol table, which moved to `protocols.ts` so resolution and construction share it without a module cycle.

## Alternatives considered

- **Keep the route-level protocol alone** — one route per protocol, restating endpoint and credential for each. Rejected: that is exactly the configuration tax the feature removes, and the settings surface already edits model entries one by one.
- **Dispatch with a catalog-provider fallback for catalog-only apis** — a repointed route keeps models the table cannot build by delegating those requests to the reused catalog provider's stream. Rejected: a mixed catalog-plus-table route is speculative rather than asked-for, the fallback's semantics depend on which catalog provider implements which api, and requiring a repointed route to be fully table-served fails at resolution — where the offending model is named — instead of at request time.
- **Schema-validate the model api against `supportedProtocols()`** — reject wrong spellings at the settings boundary. Rejected: the no-op spelling — the catalog model's own api, possibly a catalog-only protocol like Bedrock's — is only knowable next to the catalog entry, so the schema stays shape-only and precise validation lives in resolution, the same split `reasoningEfforts` already uses.

## Consequences

- One gateway route can mix OpenAI, Anthropic, and Responses models, each picked per model in settings.
- A repointed route loses catalog-provider reuse; the protocol table becomes the ceiling for every model on it. A Bedrock-class route that repoints one model must also repoint or re-declare its exotic siblings, and resolution names each one that stays behind.
- `supportedProtocols()` keeps its public meaning while its home moves to `protocols.ts`; the package root re-export is unchanged.
- Per-model `compat` switches keep applying only where the resolved api is `openai-completions`, unchanged from the [declared-provider-catalog decision](../architecture/2026-08-03-pi-ai-declared-provider-catalog.md), which now names the dispatching provider as its third construction.
