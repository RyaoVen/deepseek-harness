// @vitest-environment jsdom
/**
 * What the usage section shows: loading, failure, empty, and the four chart
 * cards once a summary stands.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { UsageSummary } from '@deepseek-ai/dsh-host-usage-dashboard/types'
import { UsageDashboardSection } from '../src/client/UsageDashboardSection.tsx'
import type { UsageDashboardSectionProps } from '../src/client/UsageDashboardSection.tsx'
import type { UsageDashboardState } from '../src/client/usage-dashboard-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

const summary: UsageSummary = {
  totalCalls: 3,
  totalTokens: 150,
  byModel: [
    { model: 'm-a', calls: 2, inputTokens: 100, outputTokens: 40, cacheReadTokens: 10, cacheWriteTokens: 0, totalTokens: 150 },
  ],
  byDay: [
    { day: '2026-08-01', calls: 1, totalTokens: 50 },
    { day: '2026-08-02', calls: 2, totalTokens: 100 },
  ],
  byHour: [{ hour: 10, calls: 3, totalTokens: 150 }],
}

function renderSection(state: Partial<UsageDashboardState> = {}, refresh = vi.fn()) {
  const store = createSnapshotStore<UsageDashboardState>({
    loading: false, failed: false, summary: undefined, ...state,
  })
  const props = {
    t,
    refresh,
    useUsage: bindSnapshotSelector(store),
  } as unknown as UsageDashboardSectionProps
  render(<UsageDashboardSection {...props} />)
  return refresh
}

describe('UsageDashboardSection', () => {
  it('leads with the heading and a refresh button', () => {
    renderSection()
    expect(screen.getByRole('heading', { name: en.title })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.refresh })).toBeTruthy()
  })

  it('shows the folding state while the first load is in flight', () => {
    renderSection({ loading: true })
    expect(screen.getByText(en.loading)).toBeTruthy()
  })

  it('reports a failed load and retries through refresh', () => {
    const refresh = renderSection({ failed: true })
    expect(screen.getByRole('alert')).toHaveProperty('textContent', en.failed)
    fireEvent.click(screen.getByRole('button', { name: en.refresh }))
    expect(refresh).toHaveBeenCalled()
  })

  it('says so when there is no usage yet', () => {
    renderSection({ summary: { ...summary, totalCalls: 0, byModel: [], byDay: [], byHour: [] } })
    expect(screen.getByText(en.empty)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders the four charts from a summary', () => {
    renderSection({ summary })

    expect(screen.getByRole('heading', { name: en.heatmapHeading })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'heatmap' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.radarHeading })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'radar' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.lineHeading })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'line' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.pieHeading })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'pie' })).toBeTruthy()
  })

  it('keeps the refresh button disabled while a refresh is in flight', () => {
    renderSection({ summary, loading: true })
    expect(screen.getByRole('button', { name: en.refresh })).toHaveProperty('disabled', true)
  })
})
