# @deepseek-ai/dsh-agent-modes

English | [中文](README.zh.md)

Durable per-session agent modes. The host plane registers the `sessionModes` service (fold the latest `mode/set` event from a session's log; append a `mode/set` event to switch) and the `sessionModesRemote` Typert Remote (`get`/`set` by session id — live sessions read from the store, cold sessions fold from persistence, switches require a live session). The agent plane (`./agent`, mounted as a preset row) registers one live prompt section that renders the session's current mode and its guidance at every assembly, so a switch is visible to the very next model request.

Modes are advisory: the `mode/set` event is `ignorable` for readers that do not know it, and a mode changes future behavior through the prompt section only. The shipped modes are `standard`, `creative`, and `design`; vibe and spec modes arrive with their own issues.

Design mode is enforced, not just advisory: while a session is in design mode the host plane denies the filesystem read/write tools (`read`, `write`, `edit`, `read_image`, `glob`, `grep`) and the command executors (`bash`, `pwsh`) at the `tools/pre-execute` waterfall. Research tools (web search, subagents, skills) stay available, because design mode delegates research and argumentation to subagents by default.

## Model Experience

Indirectly, through the per-agent prompt section it registers — the section text is the mode's guidance, folded from the session's durable mode events at assembly time, so the mode is model-visible exactly like any other prompt section.

#### KV Cache effect

None: the section text is a few lines per assembly and the mode fold is a tail scan of the session log.

## Known Limitations and Deferred Work

- **Switches require a live session** — the Remote refuses to switch a cold session; the browser switches the session it is looking at, which is live, and a cold session keeps its last durable mode on resume.
- **Guidance is advisory outside design mode** — other modes change the prompt, not the tool set; only design mode hard-blocks the filesystem and command tools.
- **The prompt section ships in the `standard` preset only** — other shipped presets (minimal, code, cordis) do not mount the agent row yet.
