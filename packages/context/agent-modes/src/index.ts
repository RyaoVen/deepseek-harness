/**
 * Host plane of the agent-modes package: the durable per-session mode
 * service and the Remote the browser switches through.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
// Type-only: pulls the sessionPersistence Context merge.
import type {} from '@deepseek-ai/dsh-session-persistence'
// Type-only: pulls the agent association and the agent/created lifecycle event.
import type {} from '@deepseek-ai/dsh-agent'
// Type-only: pulls the systemPrompt Context merge.
import type {} from '@deepseek-ai/dsh-system-prompt'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import { modeOf } from './fold.ts'
import { MODE_SET_EVENT, modeGuidance, type AgentMode } from './types.ts'
import * as designModeGuard from './guard.ts'

export type * from './types.ts'
export { DESIGN_BLOCKED_TOOLS, designModeDenial } from './guard.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Durable per-session agent mode state. */
    sessionModes: SessionModes
  }
}

/** Reads and switches one session's durable mode. */
export class SessionModes extends Service {
  constructor(ctx: Context) {
    super(ctx, 'sessionModes')
  }

  /**
   * Fold the current mode from a session's log.
   * @param session - the session to read.
   * @returns the latest valid mode, defaulting to `standard`.
   */
  get(session: Session): AgentMode {
    return modeOf(session.events)
  }

  /**
   * Switch a session's mode by appending a durable `mode/set` event.
   * @param session - the session to switch.
   * @param mode - the mode to enter.
   * @returns the logged event's seq.
   */
  set(session: Session, mode: AgentMode): number {
    return session.append(MODE_SET_EVENT, { mode }).seq
  }
}

/** Remote-only service exposing mode reads and switches by session id. */
export class SessionModesGateway extends TypertRemoteService {
  static inject = ['sessions', 'sessionPersistence', 'sessionModes']

  constructor(ctx: Context) {
    super(ctx, 'sessionModesRemote')
  }

  /**
   * Read one session's current mode. Live sessions read from the store;
   * cold sessions fold from persistence so a restart never loses the mode.
   * @param payload - the session to read.
   * @returns the session's current mode.
   */
  @Remote('get')
  async get(payload: { sessionId: SessionId }): Promise<{ mode: AgentMode }> {
    const live = this.ctx.sessions.get(payload.sessionId)
    if (live !== undefined) return { mode: this.ctx.sessionModes.get(live) }
    const inspection = await this.ctx.sessionPersistence.inspect(payload.sessionId)
    return { mode: modeOf(inspection.events) }
  }

  /**
   * Switch a live session's mode. Cold sessions are refused: the browser
   * switches the session it is looking at, which is live.
   * @param payload - the session and the mode to enter.
   * @returns the logged event's seq.
   */
  @Remote('set')
  set(payload: { sessionId: SessionId; mode: AgentMode }): { seq: number } {
    const live = this.ctx.sessions.get(payload.sessionId)
    if (live === undefined) {
      throw new Error(`session ${String(payload.sessionId)} is not live; open it before switching its mode`)
    }
    return { seq: this.ctx.sessionModes.set(live, payload.mode) }
  }
}

/** Cordis plugin body: register the mode service, its Remote, the design-mode tool guard, and the per-agent guidance section. */
export function apply(ctx: Context): void {
  ctx.plugin(SessionModes)
  ctx.plugin(SessionModesGateway)
  ctx.plugin(designModeGuard)
  // The mode guidance is per-agent: a preset row would run in the preset's
  // shared standing scope with no `ctx.agent` to fold. Agents publish through
  // `agent/created` before their first turn, so install the section on each
  // agent's own context here on the host plane instead.
  ctx.on('agent/created', ({ agent }) => {
    agent.ctx.systemPrompt.section({
      name: 'agent-mode',
      order: 30,
      text: () => {
        const mode = modeOf(agent.session.events)
        return `Current session mode: ${mode}\n${modeGuidance(mode)}`
      },
    })
  })
}
