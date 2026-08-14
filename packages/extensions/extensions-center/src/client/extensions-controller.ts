/**
 * Browser half of the extensions center: bridges the `extensions-center`
 * settings scope onto the tab's projection and actions. Entries are edited as
 * whole drafts — the center's arrays have no scalar field to stage — so every
 * action recomputes the full array from the last accepted section and writes
 * it back in one path op, exactly like the CardForm's read-back contract: the
 * Host is the only authority, and a write that did not land keeps the view
 * honest by re-reading from the snapshot.
 */

import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Namespace of the extensions center. Spelled here rather than imported: a
 * client package must not depend on a Host package, and the host plugin that
 * owns the namespace spells the same value.
 */
export const EXTENSIONS_CENTER_NS = 'extensions-center'

/** Transport selected for one MCP server entry. */
export type ServerTransport = 'stdio' | 'streamable-http'

/** One MCP server entry as the tab edits it. */
export interface McpServerDraft {
  /** Stable identity; also the mcp-client `serverName` namespace. */
  id: string
  /** Human-readable name shown in the extensions center. */
  name: string
  /** Whether this server is currently mounted. */
  enabled: boolean
  /** Transport kind; selects which connection fields apply. */
  transport: ServerTransport
  /** Stdio transport: executable used to start the server. */
  command: string
  /** Stdio transport: arguments passed directly, without shell interpolation. */
  args: string[]
  /** Stdio transport: extra env vars merged on top of the scrubbed ambient env. */
  env: Record<string, string>
  /** Stdio transport: working directory for the child process. */
  cwd: string
  /** Streamable HTTP transport: MCP endpoint URL. */
  url: string
  /** Streamable HTTP transport: additional headers attached to MCP requests. */
  headers: Record<string, string>
  /** Per-tool-call timeout in milliseconds. */
  toolCallTimeoutMs: number
  /** Fail the mount when the initial connection or tool synchronization fails. */
  failOnStartupError: boolean
}

/** One skill entry as the tab edits it. */
export interface SkillDraft {
  /** Skill name; also the directory name under the skills root. */
  name: string
  /** Skill description shown in the catalog. */
  description: string
  /** Optional guidance for when the model should load this skill. */
  whenToUse?: string
  /** Whether this skill is currently mounted. */
  enabled: boolean
  /** Skill body after the YAML frontmatter. */
  content: string
}

/** What the extensions tab renders. */
export interface ExtensionsCenterView {
  /** False while the namespace is not served to this client; the tab renders nothing. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** MCP servers in document order. */
  servers: McpServerDraft[]
  /** Skills in document order. */
  skills: SkillDraft[]
  /** Whether an entry write is crossing the wire. */
  saving: boolean
  /** Whether the last write did not land as sent; cleared by the next write. */
  failed: boolean
}

/** The write actions the tab's slot entry injects. */
export interface ExtensionsCenterActions {
  /** Upsert one server entry by id, keeping its position. */
  saveServer: (draft: McpServerDraft) => void
  /** Remove one server entry by id. */
  removeServer: (id: string) => void
  /** Flip one server entry's enabled flag. */
  toggleServer: (id: string, enabled: boolean) => void
  /** Upsert one skill entry by name, keeping its position. */
  saveSkill: (draft: SkillDraft) => void
  /** Remove one skill entry by name. */
  removeSkill: (name: string) => void
  /** Flip one skill entry's enabled flag. */
  toggleSkill: (name: string, enabled: boolean) => void
}

/** Section shape the scope resolves; mirrors the Host schema, spelled here. */
export interface ExtensionsCenterSection {
  servers: McpServerDraft[]
  skills: SkillDraft[]
}

/** The registration-side face the tab's slot entry injects. */
export interface ExtensionsTabFace extends ExtensionsCenterActions {
  hooks: {
    /** Tab snapshot bound by the renderer as useExtensions. */
    extensions: SnapshotStore<ExtensionsCenterView>
  }
}

const EMPTY_SECTION: ExtensionsCenterSection = { servers: [], skills: [] }

/** Deep equality over the JSON-shaped entries this controller writes. */
function sameEntry(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Bridges the `extensions-center` scope onto the tab's projection and actions. */
export class ExtensionsCenterController {
  private readonly store: SnapshotStore<ExtensionsCenterView>
  private saving = false
  private failed = false
  /** Last accepted section, refreshed by scope publications and write read-backs. */
  private cached: ExtensionsCenterSection = EMPTY_SECTION

  /** @param scope - the bound settings scope for the `extensions-center` namespace. */
  constructor(private readonly scope: SettingsScope<ExtensionsCenterSection>) {
    this.refreshCache()
    this.store = createSnapshotStore(this.projection())
    scope.subscribe(() => {
      // Only snapshot REPLACEMENTS land here, so the cache can never regress
      // to a stale value while a write of this controller is in flight.
      this.refreshCache()
      this.publish()
    })
  }

  /**
   * Build the face the tab's slot registration injects.
   * @returns the tab's snapshot and its entry actions.
   */
  inject(): ExtensionsTabFace {
    return {
      hooks: { extensions: this.store },
      saveServer: (draft) => { void this.write('servers', upsert(this.cached.servers, draft, server => server.id)) },
      removeServer: (id) => { void this.write('servers', this.cached.servers.filter(server => server.id !== id)) },
      toggleServer: (id, enabled) => {
        void this.write('servers', this.cached.servers.map(server => server.id === id ? { ...server, enabled } : server))
      },
      saveSkill: (draft) => { void this.write('skills', upsert(this.cached.skills, draft, skill => skill.name)) },
      removeSkill: (name) => { void this.write('skills', this.cached.skills.filter(skill => skill.name !== name)) },
      toggleSkill: (name, enabled) => {
        void this.write('skills', this.cached.skills.map(skill => skill.name === name ? { ...skill, enabled } : skill))
      },
    }
  }

  private projection(): ExtensionsCenterView {
    const snapshot = this.scope.getSnapshot()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      servers: snapshot.status === 'ready' ? this.cached.servers : [],
      skills: snapshot.status === 'ready' ? this.cached.skills : [],
      saving: this.saving,
      failed: this.failed,
    }
  }

  private refreshCache(): void {
    const value = this.scope.getSnapshot().value
    if (value !== undefined) this.cached = value
  }

  private async write(field: 'servers' | 'skills', next: McpServerDraft[] | SkillDraft[]): Promise<void> {
    const snapshot = this.scope.getSnapshot()
    if (this.saving) return
    if (snapshot.status !== 'ready' || !snapshot.writable) {
      // The Host refused before any write: surface it instead of silently
      // dropping the gesture, so the tab can say the document is read-only.
      this.failed = true
      this.publish()
      return
    }
    this.saving = true
    this.failed = false
    this.cached = { ...this.cached, [field]: next }
    this.publish()
    await this.scope.set(field, next)
    this.saving = false
    // The scope publishes the Host's read-back before the write settles, so a
    // write that did not land leaves the array unchanged and the tab says so.
    this.refreshCache()
    this.failed = !sameEntry(this.cached[field], next)
    this.publish()
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}

/** Insert or replace one entry by key, keeping its position. */
function upsert<T>(entries: readonly T[], entry: T, key: (candidate: T) => string): T[] {
  const value = key(entry)
  const index = entries.findIndex(candidate => key(candidate) === value)
  if (index < 0) return [...entries, entry]
  const next = [...entries]
  next[index] = entry
  return next
}
