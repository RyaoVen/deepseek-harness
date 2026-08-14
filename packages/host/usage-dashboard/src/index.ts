/**
 * Usage dashboard Remote: folds every durable session log into model-usage
 * summaries, cached per session revision so repeated reads only re-fold
 * sessions whose logs changed.
 */

import { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import { emptyFold, foldSession, mergeFold, type SessionUsageFold } from './fold.ts'
import type { UsageDayRow, UsageHourRow, UsageSummary } from './types.ts'

export type * from './types.ts'

/** One cached session fold plus the revision it was folded from. */
interface CachedSessionFold {
  revision: SessionPersistenceRevision
  fold: SessionUsageFold
}

/** Read-only Remote service exposing model usage folded from durable logs. */
export class UsageDashboardGateway extends TypertRemoteService {
  static inject = ['sessionPersistence']

  private readonly cache = new Map<SessionId, CachedSessionFold>()

  constructor(ctx: Context) {
    super(ctx, 'usageDashboard')
    // Fold input arrives as durable assistant/message events; drop the
    // session's cached fold and tell the browser the summary changed. The
    // emit is unconditional (the next summarize re-reads the revision and
    // skips unchanged sessions), so a dropped cache never blocks a refresh.
    ctx.on('session/event', (session, event) => {
      if (event.type !== 'assistant/message') return
      if (event.data.usage === undefined) return
      this.cache.delete(session.id)
      ctx.emit('usage/updated')
    })
  }

  /**
   * Fold every durable session log into one summary. Sessions whose stored
   * revision is unchanged since the last call reuse their cached fold; new
   * and changed sessions are re-read. A session that fails to load is skipped
   * and logged, so one corrupt log never takes the dashboard down.
   * @returns the merged usage summary.
   */
  @Remote('summarize')
  async summarize(): Promise<UsageSummary> {
    const persistence = this.ctx.sessionPersistence
    const snapshots = await persistence.listSnapshots()
    const seen = new Set<SessionId>()
    const folds: SessionUsageFold[] = []
    for (const snapshot of snapshots) {
      const id = snapshot.header.id
      seen.add(id)
      const cached = this.cache.get(id)
      if (cached !== undefined && cached.revision === snapshot.revision) {
        folds.push(cached.fold)
        continue
      }
      try {
        const inspection = await persistence.load(id)
        const fold = foldSession(emptyFold(), inspection.events)
        this.cache.set(id, { revision: snapshot.revision, fold })
        folds.push(fold)
      } catch (error) {
        this.ctx.logger.warn(`usage-dashboard: session ${String(id)} could not be folded`)
        this.ctx.logger.warn(error)
      }
    }
    for (const id of this.cache.keys()) {
      if (!seen.has(id)) this.cache.delete(id)
    }
    const global = folds.reduce((acc, fold) => mergeFold(acc, fold), emptyFold())
    return {
      totalCalls: global.calls,
      totalTokens: global.totalTokens,
      byModel: [...global.byModel.values()],
      byDay: [...global.byDay.entries()]
        .map(([day, row]): UsageDayRow => ({ day, calls: row.calls, totalTokens: row.totalTokens }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      byHour: [...global.byHour.entries()]
        .map(([hour, row]): UsageHourRow => ({ hour, calls: row.calls, totalTokens: row.totalTokens }))
        .sort((a, b) => a.hour - b.hour),
    }
  }
}

export default UsageDashboardGateway
