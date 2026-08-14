/**
 * Hero mode-chip controller: which session mode the NEXT session starts in.
 *
 * The new-session screen has no session, so a pick is staged rather than
 * applied. It reaches a session when one becomes current and is still blank —
 * the same flow the agent-preset chip uses, because a mode chosen for the
 * session about to start is consumed by that session and forgotten.
 */

import { createSnapshotStore, type SessionId, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { AgentMode } from '@deepseek-ai/dsh-agent-modes/types'

/** The known mode values, in UI order. Spelled here: a client bundle must not value-import a Host package. */
export const AGENT_MODES: readonly AgentMode[] = ['standard', 'creative', 'design', 'vibe', 'spec']

/** Hero mode-chip snapshot. */
export interface ModeSeatState {
  /** The modes the host knows, in UI order. */
  options: readonly AgentMode[]
  /** The staged choice, falling back to the current session's mode or `standard`. */
  current: AgentMode
  /** A rejected apply's message, cleared by the next attempt. */
  error: string | null
  busy: boolean
}

const INITIAL: ModeSeatState = { options: AGENT_MODES, current: 'standard', error: null, busy: false }

/** One session the hero is about to hand over to. */
export interface ModeSeatSessionSummary {
  id: SessionId
  /** False once a turn has run — a mode staged for the fresh session is then meaningless. */
  blank: boolean
}

/** Stages the next session's mode and applies it when a blank one appears. */
export class ModeSeatController {
  /** Chip snapshot the renderer subscribes to. */
  readonly store: SnapshotStore<ModeSeatState> = createSnapshotStore(INITIAL)

  /** Set while a pick is waiting for a session; cleared once applied. */
  private staged: AgentMode | undefined

  constructor(
    /** Read one session's current mode. */
    private readonly getMode: (sessionId: SessionId) => Promise<AgentMode>,
    /** Switch one session's mode. */
    private readonly setMode: (sessionId: SessionId, mode: AgentMode) => Promise<boolean>,
    /** The session the hero is about to hand over to, when there is one. */
    private readonly currentSession: () => ModeSeatSessionSummary | undefined,
  ) {}

  private set(patch: Partial<ModeSeatState>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch })
  }

  /**
   * Open the chip on the current session's mode (or `standard` when none is
   * current); a staged pick wins over both.
   */
  async load(): Promise<void> {
    const session = this.currentSession()
    if (session === undefined) return
    try {
      const mode = await this.getMode(session.id)
      this.set({ current: this.staged ?? mode, error: null })
    } catch {
      this.set({ current: this.staged ?? 'standard', error: null })
    }
  }

  /**
   * Stage one mode for the next session, applying it immediately when a blank
   * session is already current.
   * @param mode - the mode to stage.
   */
  async select(mode: AgentMode): Promise<void> {
    if (this.store.getSnapshot().busy) return
    this.staged = mode
    this.set({ current: mode, error: null })
    await this.apply()
  }

  /**
   * Hand the staged mode to the current session, if there is a blank one to
   * take it. Called both by `select()` and by whoever observes the current
   * session changing, because the session may appear either before or after
   * the pick.
   */
  async apply(): Promise<void> {
    const staged = this.staged
    const session = this.currentSession()
    if (staged === undefined || session === undefined) return
    if (!session.blank) {
      this.staged = undefined
      this.set({ current: 'standard', error: null })
      return
    }
    this.set({ busy: true, error: null })
    try {
      const applied = await this.setMode(session.id, staged)
      this.staged = undefined
      this.set({ busy: false, current: applied ? staged : 'standard', error: applied ? null : 'mode switch was rejected' })
    } catch (error) {
      this.staged = undefined
      this.set({ busy: false, current: 'standard', error: error instanceof Error ? error.message : String(error) })
    }
  }
}
