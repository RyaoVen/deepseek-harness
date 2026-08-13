# Agent Note: Durable session modes with live switching

Status: implemented

English | [中文](2026-08-14-durable-session-modes.zh.md)

## Problem

A session's working style was fixed at composition time: plan mode was the only mode-like state, and it was a per-agent plugin with no durable per-session value, no switch surface, and no way to change how the agent works mid-conversation. The requested "模式切换" (mode switching) needed a durable, switchable, per-session mode that reaches the next model request.

## Decision

Two new packages implement durable session modes.

`@deepseek-ai/dsh-agent-modes` owns the mode vocabulary (`standard`/`creative`, with the event type designed so later modes extend the union), the durable per-session state, and both planes. The host plane registers the `sessionModes` service — `get(session)` folds the latest `mode/set` event from the session's own durable log (replay-stable, default `standard`), `set(session, mode)` appends a `mode/set` event — and the `sessionModesRemote` Typert Remote (`get`/`set` by session id): live sessions read from the session store, cold sessions fold from persistence so a restart never loses the mode, and switches require a live session. The agent plane (`./agent`, mounted as a preset row) registers one live prompt section that folds the agent's own session at every assembly and renders the current mode and its guidance, so a switch is visible to the very next model request. The `mode/set` event is `ignorable`, so readers that do not know it safely skip it.

`@deepseek-ai/dsh-client-ui-mode-switcher` is the surface: a `/mode` popupSelect command listing every known mode with the session's current one marked active, reading through `sessionModesRemote/get` and switching through `sessionModesRemote/set`.

Wiring follows the established seams: the api-remotes client assembly mounts the new Remote, the Web composition gains one host row and one client row, the `standard` preset mounts the agent-plane row, and both typecheck aggregates reference the new projects.

## Alternatives considered

- **Mode in the session header** — a header field written once at creation. Rejected: the header is immutable and written at creation, so mid-session switches would need a new header; the log event keeps the switch history and replay semantics with the rest of the log.
- **Mode as a settings namespace** — a global settings value like the theme. Rejected: settings are global and process-live, while the mode is per-session and must survive restarts with the session's own log; the log event is the session-scoped durable home.
- **Mode enforcement in the loop** — the agent loop reads the mode and gates tools directly. Rejected for this issue: the loop is a core seam with architecture-doc ownership; advisory prompt-level modes deliver the switch first, and behavioral enforcement (design mode's bans) lands with the design-mode issue.

## Consequences

- Every session now has a durable, switchable mode that survives restarts and reaches the next request.
- The fold is a pure latest-wins scan; the event is ignorable for older readers.
- The `standard` preset gains one prompt section; other presets can mount the agent row to opt in.
- The Web bundle gains one host Remote and one command surface; both packages are covered by unit tests (fold, service, Remote live/cold paths, command registration and selection).
