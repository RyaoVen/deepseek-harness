/**
 * Settings document of the extensions center: the MCP servers and skills the
 * center mounts live, plus the validation that refuses a write the center
 * could not act on.
 *
 * The schema is also what the configuration surface renders, so the section
 * keeps every editable field here; the mcp-client mapping happens at mount
 * time in `server-mounts.ts`, and the filesystem rendering of a skill happens
 * in `skill-writer.ts`.
 */

import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { isSkillName } from '@deepseek-ai/dsh-skill'

/** Settings namespace owned by this plugin. */
export const EXTENSIONS_CENTER_NAMESPACE = 'extensions-center'

/** Transport selected for one MCP server entry. */
export type ServerTransport = 'stdio' | 'streamable-http'

/** One settings entry describing an MCP server to mount on `ctx.tools`. */
export interface McpServerEntry {
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

/** One settings entry describing a skill to write under the skills root. */
export interface SkillEntry {
  /** Skill name; also the directory name, and must satisfy `isSkillName`. */
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

/** Resolved settings section of the extensions center. */
export interface ExtensionsCenterSettings {
  /** MCP servers to mount, in document order. */
  servers: McpServerEntry[]
  /** Skills to write under the skills root, in document order. */
  skills: SkillEntry[]
}

/** Stable identity pattern for one server entry; mirrors the mcp-client budget. */
export const SERVER_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

const McpServerEntrySchema = z.object({
  id: z.string().required().pattern(SERVER_ID_PATTERN),
  name: z.string().required(),
  enabled: z.boolean().default(true),
  transport: z.union([z.const('stdio'), z.const('streamable-http')]).default('stdio'),
  command: z.string().default(''),
  args: z.array(String).default([]),
  env: z.dict(String).default({}),
  cwd: z.string().default(''),
  url: z.string().default(''),
  headers: z.dict(String).default({}),
  toolCallTimeoutMs: z.number().default(60_000),
  failOnStartupError: z.boolean().default(false),
})

const SkillEntrySchema = z.object({
  name: z.string().required(),
  description: z.string().required(),
  whenToUse: z.string(),
  enabled: z.boolean().default(true),
  content: z.string().required(),
})

/** Schema of the extensions-center settings section. */
export const ExtensionsCenterSettingsSchema: Schema<ExtensionsCenterSettings> = z.object({
  servers: z.array(McpServerEntrySchema).default([]),
  skills: z.array(SkillEntrySchema).default([]),
})

/**
 * Reject a resolved section the center could not act on: duplicate or invalid
 * server ids, a transport field the chosen kind does not use, duplicate or
 * invalid skill names, and empty skill bodies.
 * @param value - the resolved section, schema-valid by construction.
 */
export function validateExtensionsCenterSettings(value: ExtensionsCenterSettings): void {
  const serverIds = new Set<string>()
  for (const server of value.servers) {
    if (serverIds.has(server.id)) {
      throw new TypeError(`extensions-center: duplicate server id "${server.id}"`)
    }
    serverIds.add(server.id)
    if (server.transport === 'stdio' && server.command.length === 0) {
      throw new TypeError(`extensions-center: server "${server.id}" needs a command for stdio transport`)
    }
    if (server.transport === 'streamable-http' && server.url.length === 0) {
      throw new TypeError(`extensions-center: server "${server.id}" needs a url for streamable-http transport`)
    }
  }
  const skillNames = new Set<string>()
  for (const skill of value.skills) {
    if (skillNames.has(skill.name)) {
      throw new TypeError(`extensions-center: duplicate skill name "${skill.name}"`)
    }
    skillNames.add(skill.name)
    if (!isSkillName(skill.name)) {
      throw new TypeError(`extensions-center: invalid skill name "${skill.name}"`)
    }
    if (skill.description.length === 0 || skill.content.length === 0) {
      throw new TypeError(`extensions-center: skill "${skill.name}" needs a description and a body`)
    }
  }
}
