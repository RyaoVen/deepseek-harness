/**
 * Renders the extensions center's skill entries as files under one skills
 * root, the exact layout the skill-filesystem provider discovers: one
 * directory per skill carrying `SKILL.md` with YAML frontmatter. The provider
 * watches host roots, so a write here invalidates every session's catalog
 * without any reconfiguration.
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'
import type { SkillEntry } from './settings.ts'

/** File name the skill-filesystem provider reads inside each skill directory. */
const SKILL_FILE = 'SKILL.md'

/** One skill entry as it lands on disk, ready for `stringify`. */
interface Frontmatter {
  name: string
  description: string
  whenToUse?: string
}

/** Renders skill files under one root and keeps it equal to a settings list. */
export class SkillWriter {
  /**
   * @param dir - absolute skills root the filesystem provider already scans.
   */
  constructor(private readonly dir: string) {}

  /**
   * Bring the root in line with one settings list: write or refresh every
   * enabled skill, remove the directory of every entry that vanished or was
   * disabled, and leave files the center does not own untouched.
   * @param skills - the current enabled/disabled skill entries.
   * @returns settlement after every filesystem operation settles.
   */
  async sync(skills: readonly SkillEntry[]): Promise<void> {
    await Promise.all(skills
      .filter(skill => skill.enabled)
      .map(skill => this.writeSkill(skill)))
    const enabled = new Set(skills.filter(skill => skill.enabled).map(skill => skill.name))
    for (const name of await this.listSkillDirs()) {
      if (enabled.has(name)) continue
      await rm(join(this.dir, name), { recursive: true, force: true })
    }
  }

  /**
   * Write one skill's `SKILL.md` under its own directory.
   * @param skill - the skill entry to render.
   * @returns settlement after the directory and file are written.
   */
  async writeSkill(skill: SkillEntry): Promise<void> {
    const directory = join(this.dir, skill.name)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, SKILL_FILE), renderSkillFile(skill), 'utf8')
  }

  private async listSkillDirs(): Promise<string[]> {
    let entries
    try {
      entries = await readdir(this.dir, { withFileTypes: true })
    } catch (error) {
      // A missing or unreadable root is not a sync failure: the watcher sees
      // the root appear later and re-reads the catalog on its own.
      if ((error as { code?: unknown } | null)?.code === 'ENOENT' || (error as { code?: unknown } | null)?.code === 'ENOTDIR') {
        return []
      }
      throw error
    }
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
  }
}

/** Render one skill file: YAML frontmatter plus the body. */
function renderSkillFile(skill: SkillEntry): string {
  const frontmatter: Frontmatter = {
    name: skill.name,
    description: skill.description,
    ...skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse },
  }
  return `---\n${stringify(frontmatter)}---\n\n${skill.content.trim()}\n`
}
