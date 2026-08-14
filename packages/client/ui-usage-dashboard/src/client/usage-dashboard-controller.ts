/**
 * Controller of the usage dashboard section: loads the Remote summary,
 * owns the loading/ready/failed states, and exposes the refresh action.
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { UsageSummary } from '@deepseek-ai/dsh-host-usage-dashboard/types'

/** What the usage section renders. */
export interface UsageDashboardState {
  /** Whether the first load is still in flight. */
  loading: boolean
  /** Whether the last load failed; the section shows the retry affordance. */
  failed: boolean
  /** The last accepted summary; undefined before the first success. */
  summary: UsageSummary | undefined
}

/** The registration-side face the section's slot entry injects. */
export interface UsageDashboardInjected {
  hooks: {
    /** Section snapshot bound by the renderer as useUsage. */
    usage: SnapshotStore<UsageDashboardState>
  }
  /** Re-read the summary from the Host. */
  refresh: () => void
}

/** Bridges the usage Remote onto the section's state store. */
export class UsageDashboardController {
  private readonly store: SnapshotStore<UsageDashboardState>
  private loading = false
  private failed = false
  private summary: UsageSummary | undefined

  /** @param list - loads one usage summary from the Host Remote. */
  constructor(private readonly list: () => Promise<UsageSummary>) {
    this.store = createSnapshotStore(this.projection())
    void this.load()
  }

  /**
   * Build the face the section's slot registration injects.
   * @returns the section's snapshot and its refresh action.
   */
  inject(): UsageDashboardInjected {
    return {
      hooks: { usage: this.store },
      refresh: () => { void this.refresh() },
    }
  }

  /**
   * Re-read the summary from the Host. Exposed separately from the injected
   * face so the forwarded `usage/updated` event can refresh without a slot
   * consumer.
   */
  refresh(): Promise<void> {
    return this.load()
  }

  private projection(): UsageDashboardState {
    return { loading: this.loading, failed: this.failed, summary: this.summary }
  }

  private async load(): Promise<void> {
    if (this.loading) return
    this.loading = true
    this.failed = false
    this.publish()
    try {
      this.summary = await this.list()
    } catch (_readFailure) {
      this.failed = true
    }
    this.loading = false
    this.publish()
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
