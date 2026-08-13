/**
 * Extensions center, node half: mounts MCP servers and skills live from the
 * `extensions-center` settings section. The browser half edits the same
 * section through the settings surface; every committed change re-syncs the
 * mcp-client fibers and the skill files under the configured skills root,
 * which the skill-filesystem provider already watches.
 *
 * The namespace stays empty by composition: this deployment ships no bundled
 * servers or skills, so the section resolves to schema defaults until the
 * user adds entries.
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { pluginMountFactory, ServerMountManager } from './server-mounts.ts'
import {
  EXTENSIONS_CENTER_NAMESPACE,
  ExtensionsCenterSettings,
  ExtensionsCenterSettingsSchema,
  validateExtensionsCenterSettings,
} from './settings.ts'
import { SkillWriter } from './skill-writer.ts'

/** Composition entry: no bundled extensions. */
const EMPTY_SECTION: ExtensionsCenterSettings = { servers: [], skills: [] }

/** Local filesystem skill provider configuration. */
export interface Config {
  /**
   * Directory rendered skill files land in. Defaults to `$DSH_HOME/skills`,
   * the user-dsh root every default skill-filesystem provider scans.
   */
  skillsDir?: string
}

export const Config: Schema<Config> = z.object({
  skillsDir: z.string(),
})

/** Resolve the skills root, honoring the default home root. */
function resolveSkillsDir(config: Config): string {
  return config.skillsDir ?? join(resolveDshHome(undefined), 'skills')
}

/**
 * Mount the extensions center on this context.
 * @param ctx - plugin context carrying the tools and settings registries.
 * @param config - skills root selection.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const mounts = new ServerMountManager(pluginMountFactory(ctx))
  const skills = new SkillWriter(resolveSkillsDir(config))
  ctx.effect(() => () => { void mounts.dispose() }, 'extensions-center server mounts')

  let source: () => ExtensionsCenterSettings = () => EMPTY_SECTION
  installSettingsSection(ctx, settingsNamespace(EXTENSIONS_CENTER_NAMESPACE), ExtensionsCenterSettingsSchema, EMPTY_SECTION, {
    setSource: (current) => { source = current },
    // The settings watcher serializes invocations, so two settings commits
    // can never run two conflicting syncs at once.
    onChange: () => { void sync() },
    validate: validateExtensionsCenterSettings,
  })

  async function sync(): Promise<void> {
    const section = source()
    await Promise.all([
      mounts.sync(ctx, section.servers),
      skills.sync(section.skills),
    ])
  }
}
