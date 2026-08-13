# @deepseek-ai/dsh-extensions-center

English | [中文](README.zh.md)

The extensions center: a settings-driven mounting surface for MCP servers and skills, with a management tab inside the Plugins settings page.

**The node half is a live re-syncer, not a static reader.** It registers the `extensions-center` settings namespace (schema-owned defaults, `live` applies, and a validator that refuses a section it could not act on — duplicate ids, an id that breaks the mcp-client namespace budget, a transport field the chosen kind does not use, invalid or duplicate skill names, empty skill bodies) and re-syncs on every committed change. Each enabled server entry is mounted as its own mcp-client fiber through `ctx.plugin` with the entry's transport fields mapped onto the mcp-client config; a disabled, removed, or connection-relevant-changed entry disposes its fiber, and a changed enabled entry is re-mounted. Each enabled skill entry is rendered as `<name>/SKILL.md` under the configured skills root (default `$DSH_HOME/skills`, the user-dsh root every default skill-filesystem provider scans and watches), so a write here invalidates every session's catalog without reconfiguration; a disabled or removed entry deletes its directory. The center never edits files it does not own. A mount that fails to start is logged and dropped, and the next settings change retries it; `failOnStartupError` stays off by default so a bad server entry never takes the app down.

**The browser half is one tab in the Plugins settings page.** It contributes an `extensions` tab into `settings.plugins.tab` (order 20, after the shipped configuration tab) whose page reads the same namespace through the settings scope and offers two groups: MCP servers and skills. Each group lists its entries with an enabled toggle, an expandable edit form, and a remove action, plus a collapsed add form; entries are edited as whole drafts, and each gesture recomputes the full array and writes it back in one path op, with the Host's read-back as the only authority — a write that did not land leaves the view honest and flags the save.

## Model Experience

Indirectly, through the MCP servers it mounts (each enabled entry becomes an mcp-client fiber whose tools register on `ctx.tools`) and the skill files it writes under the skills root (the skill-filesystem providers own the catalog and its model-facing entries) — so every model-visible effect belongs to those providers, while this package itself registers no prompt, tool schema, or session event.

#### KV Cache effect

None: the center writes no prompt input of its own, and mounting or unmounting an extension neither extends nor rewrites the history tail.

## Known Limitations and Deferred Work

- **Skills land as files, so an externally written directory can outrank them** — the center writes into the shared `$DSH_HOME/skills` root, where a same-named directory created by hand wins by the same rank the filesystem provider assigns; the center's own sync only removes directories it previously created.
- **A restart re-reads the settings file, not the skill directories** — a skill file deleted behind the center's back reappears on the next settings commit, because the center reconciles against its own document, not against the directory state.
- **Server edits take effect on save, not per field** — entries are written back as whole arrays, so two browser tabs editing the same section race per write; the settings revision fence keeps the loser from silently overwriting the winner, and the loser's view re-reads and shows the refusal. A saved change to an enabled server's fields disposes and re-mounts that server, so a transient disconnect is the visible cost of editing a live entry.
- **A stdio server entry mounts a real child process** — the center passes the entry through to mcp-client unchanged, so the usual care about which command a settings file may name applies; the entry is user-authored data in the user's own settings document.
