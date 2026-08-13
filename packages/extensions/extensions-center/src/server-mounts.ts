/**
 * Live MCP server mounting for the extensions center: keeps one mcp-client
 * fiber per enabled server entry and disposes it when the entry disappears,
 * is disabled, or its connection-relevant fields change. The factory seam
 * keeps the fiber lifecycle testable without spawning real MCP servers;
 * production wires it to `ctx.plugin`.
 */

import type { Context } from '@deepseek-ai/cordis'
import { apply as mountMcpClient, type Config as McpClientConfig } from '@deepseek-ai/dsh-mcp-client'
import type { McpServerEntry } from './settings.ts'

/** A mounted mcp-client fiber plus its teardown. */
export interface MountedServer {
  /** Activation promise; rejections are contained by the manager. */
  fiber: PromiseLike<unknown>
  /** Dispose the fiber and unregister its tools. */
  dispose(): Promise<void>
}

/** Creates one mounted server from an mcp-client config. */
export type MountFactory = (config: McpClientConfig) => MountedServer

/**
 * The production factory: mounts mcp-client into the caller's context.
 * @param ctx - context the mcp-client fiber mounts under.
 * @returns a mount factory creating mcp-client fibers on demand.
 */
export function pluginMountFactory(ctx: Context): MountFactory {
  return (config) => {
    const fiber = ctx.plugin(mountMcpClient, config)
    return {
      fiber,
      dispose: () => fiber.dispose(),
    }
  }
}

/**
 * Maps one settings entry onto the mcp-client config for its transport.
 * @param entry - the settings entry to map.
 * @returns the mcp-client config for the entry's transport.
 */
export function toMcpClientConfig(entry: McpServerEntry): McpClientConfig {
  const shared = {
    serverName: entry.id,
    toolCallTimeoutMs: entry.toolCallTimeoutMs,
    failOnStartupError: entry.failOnStartupError,
  }
  if (entry.transport === 'stdio') {
    return {
      ...shared,
      transport: 'stdio',
      command: entry.command,
      args: entry.args,
      env: entry.env,
      cwd: entry.cwd,
    }
  }
  return {
    ...shared,
    transport: 'streamable-http',
    url: entry.url,
    headers: entry.headers,
  }
}

/** One live mount plus the config it was created from. */
interface LiveMount {
  mounted: MountedServer
  config: McpClientConfig
}

/** Whether two mcp-client configs produce the same connection. */
function sameConfig(left: McpClientConfig, right: McpClientConfig): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Keeps mounted fibers equal to one settings list of enabled servers. */
export class ServerMountManager {
  private readonly mounts = new Map<string, LiveMount>()

  /**
   * @param mount - creates one mounted server from an mcp-client config.
   */
  constructor(private readonly mount: MountFactory) {}

  /**
   * Bring the live mounts in line with one settings list: mount every enabled
   * server that is not mounted yet, dispose and re-mount every enabled server
   * whose config changed, and dispose every mount whose entry vanished or was
   * disabled. A mount failure is logged and leaves the entry unmounted so a
   * later settings change retries it.
   * @param ctx - context used for diagnostics.
   * @param servers - the current enabled/disabled server entries.
   * @returns settlement after every mount and disposal settles.
   */
  async sync(ctx: Context, servers: readonly McpServerEntry[]): Promise<void> {
    const enabled = servers.filter(server => server.enabled)
    for (const server of enabled) {
      const config = toMcpClientConfig(server)
      const existing = this.mounts.get(server.id)
      if (existing !== undefined && sameConfig(existing.config, config)) continue
      if (existing !== undefined) {
        this.mounts.delete(server.id)
        await existing.mounted.dispose()
      }
      const mounted = this.mount(config)
      this.mounts.set(server.id, { mounted, config })
      try {
        await mounted.fiber
      } catch (error) {
        ctx.logger.warn(`extensions-center: mcp server "${server.id}" failed to start`)
        ctx.logger.warn(error)
        this.mounts.delete(server.id)
      }
    }
    const liveIds = new Set(enabled.map(server => server.id))
    await Promise.all([...this.mounts]
      .filter(([id]) => !liveIds.has(id))
      .map(async ([id, live]) => {
        this.mounts.delete(id)
        await live.mounted.dispose()
      }))
  }

  /**
   * Dispose every live mount.
   * @returns settlement after every disposal settles.
   */
  async dispose(): Promise<void> {
    const mounts = [...this.mounts.values()]
    this.mounts.clear()
    await Promise.all(mounts.map(live => live.mounted.dispose()))
  }
}
