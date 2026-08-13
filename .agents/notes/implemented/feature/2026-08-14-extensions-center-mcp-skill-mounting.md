# Agent Note: Extensions center — settings-driven MCP and skill mounting

Status: implemented

English | [中文](2026-08-14-extensions-center-mcp-skill-mounting.zh.md)

## Problem

MCP servers and skills were composition-time only: adding one meant editing `cordis.yml` (or a preset), and a person running the Web GUI had no surface to mount an MCP server or a skill at runtime. The requested "MCP 与 skill 插入式系统" therefore had no product home — every mounting path was a config file edit.

## Decision

A new dual-half package, `@deepseek-ai/dsh-extensions-center`, owns one durable settings namespace (`extensions-center`, `live` applies) whose section is a schema-validated list of MCP server entries and skill entries, and re-syncs the runtime against that section on every committed change.

The node half registers the namespace through the standard `installSettingsSection` seam (composition base empty, so the section resolves to schema defaults until the user adds entries) and keeps two reconcilers: `ServerMountManager` mounts each enabled server entry as its own mcp-client fiber through `ctx.plugin`, mapping the entry's transport fields onto the mcp-client config, and disposes the fiber when the entry is disabled, removed, or connection-relevant-changed (config fingerprint compare); a failed mount is logged, dropped, and retried on the next settings change, and `failOnStartupError` defaults off so a bad entry never takes the app down. `SkillWriter` renders each enabled skill entry as `<name>/SKILL.md` under the configured skills root (default `$DSH_HOME/skills`, the user-dsh root every default skill-filesystem provider already scans and watches), so a write invalidates every session's catalog without reconfiguration; disabled or removed entries delete their directories, and files the center does not own are never touched. A `validate` hook on the namespace refuses sections the center could not act on — duplicate ids or skill names, ids outside the mcp-client namespace budget, a transport field the chosen kind does not use, invalid skill names, empty skill bodies.

The browser half contributes one `extensions` tab into the Plugins settings section's `settings.plugins.tab` slot (order 20, after the shipped configuration tab). The page reads the same namespace through the settings scope and renders two groups (MCP servers, skills) with per-entry toggle, edit, and remove, plus collapsed add forms; entries are edited as whole drafts, each gesture recomputes the full array and writes it back in one path op, and the Host's read-back is the only authority — a write that did not land leaves the view honest and flags the save (the same read-back contract as the plugin cards' CardForm, applied to array-valued entries). The controller keeps a local cache of the last accepted section so rapid sequential gestures compose correctly regardless of wire latency, refreshed only by snapshot publications and write read-backs.

The Web composition mounts the node half as a host row (`extensions-center`) and the browser half in the `dsh.client` roster; the package is referenced from both typecheck aggregates through split `tsconfig.host.json`/`tsconfig.client.json` projects (node and browser halves compile in their own programs), and the settings surface the tab edits is registered by the host half.

## Alternatives considered

- **Per-server `cordis.yml` rows generated on save** — write the composition file from the settings section. Rejected: it edits deployment config behind the user's back, requires a loader re-read, and the settings seam already provides validated, revision-fenced durable state with a live-change notification the composition file has no equivalent of.
- **A custom skill provider registering catalog entries in-process** — register skills directly on `ctx.skills` instead of writing files. Rejected: the skills registry is per-scope layered and presets own their providers; writing files into the watched user root reuses the existing discovery and invalidation paths exactly, and keeps the entries visible to every session and to a restart.
- **One mcp-client instance with a hot-swappable config** — mutate a single connection instead of mounting per entry. Rejected: mcp-client's contract is one server per plugin instance with effect-scoped disposal; per-entry fibers give each server its own reconnect loop and namespace, and disposal semantics for free.

## Consequences

- MCP servers and skills are now runtime data: adding, editing, enabling, or removing one is a settings write, durable in the user's settings file and live for every session.
- Skill entries land as ordinary files in the shared skills root, so a hand-created directory of the same name outranks the center's entry by the same rank the filesystem provider assigns; the center's sync only removes directories it previously created.
- Editing an enabled server's connection-relevant fields disposes and re-mounts that server, so a transient disconnect is the visible cost of editing a live entry.
- The package ships no bundled extensions: the section is empty until the user adds entries, keeping the default deployment unchanged.
- The Web bundle grew one host row and one client row; both halves are covered by unit tests (settings validation, mount lifecycle, skill rendering, controller projections, tab interactions).
