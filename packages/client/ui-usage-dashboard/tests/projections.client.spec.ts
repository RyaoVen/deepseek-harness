/**
 * Chart projections: heatmap bucketing and alignment, radar normalization,
 * line windowing, and pie slices.
 */

import { describe, expect, it } from 'vitest'
import type { UsageSummary } from '@deepseek-ai/dsh-host-usage-dashboard/types'
import {
  HEATMAP_WEEKS, RADAR_DIMENSIONS, TOP_MODELS,
  heatmapCells, lineShape, pieSlices, radarShape,
} from '../src/client/projections.ts'

function summary(overrides: Partial<UsageSummary> = {}): UsageSummary {
  return {
    totalCalls: 0,
    totalTokens: 0,
    byModel: [],
    byDay: [],
    byHour: [],
    ...overrides,
  }
}

const modelRow = (model: string, tokens: number, overrides: Partial<UsageSummary['byModel'][number]> = {}) => ({
  model,
  calls: 1,
  inputTokens: tokens,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: tokens,
  ...overrides,
})

describe('heatmapCells', () => {
  it('spans HEATMAP_WEEKS weeks of Monday-first columns ending with the current week', () => {
    const cells = heatmapCells([])
    expect(cells).toHaveLength(HEATMAP_WEEKS * 7)
    const todayKey = new Date().toISOString().slice(0, 10)
    expect(cells.some(cell => cell.day === todayKey)).toBe(true)
    // Every column starts on a Monday and the last cell is that week's Sunday.
    for (let week = 0; week < HEATMAP_WEEKS; week += 1) {
      const monday = new Date(`${cells[week * 7]!.day}T00:00:00Z`)
      expect(monday.getUTCDay()).toBe(1)
    }
    expect(new Date(`${cells[cells.length - 1]!.day}T00:00:00Z`).getUTCDay()).toBe(0)
  })

  it('buckets calls into fixed intensity levels', () => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const cells = heatmapCells([
      { day: todayKey, calls: 30, totalTokens: 0 },
    ])
    const todayCell = cells.find(cell => cell.day === todayKey)!
    expect(todayCell.level).toBe(4)
    expect(cells.filter(cell => cell.calls > 0)).toHaveLength(1)
  })

  it('reports zero calls for days outside the summary', () => {
    const cells = heatmapCells([])
    expect(cells.every(cell => cell.level === 0 && cell.calls === 0)).toBe(true)
  })
})

describe('radarShape', () => {
  it('normalizes each dimension to the kept models and caps at TOP_MODELS', () => {
    const shape = radarShape(summary({
      byModel: [
        modelRow('a', 100, { calls: 4, outputTokens: 40, cacheReadTokens: 10 }),
        modelRow('b', 50, { calls: 2 }),
        modelRow('c', 25),
        modelRow('d', 10),
        modelRow('e', 1),
      ],
    }))

    expect(shape.dimensions).toEqual([...RADAR_DIMENSIONS])
    expect(shape.series).toHaveLength(TOP_MODELS)
    expect(shape.series[0]).toMatchObject({ model: 'a', values: [1, 1, 1, 1, 0] })
    expect(shape.series[1]).toMatchObject({ model: 'b', values: [0.5, 0.5, 0, 0, 0] })
    expect(shape.series.map(row => row.model)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns empty series without models', () => {
    expect(radarShape(summary()).series).toEqual([])
  })
})

describe('lineShape', () => {
  it('keeps the last N days in chronological order with a scale ceiling', () => {
    const shape = lineShape([
      { day: '2026-08-01', calls: 1, totalTokens: 10 },
      { day: '2026-08-02', calls: 1, totalTokens: 40 },
      { day: '2026-08-03', calls: 1, totalTokens: 20 },
    ], 2)

    expect(shape.points).toEqual([
      { label: '08-02', totalTokens: 40 },
      { label: '08-03', totalTokens: 20 },
    ])
    expect(shape.maxTokens).toBe(40)
  })

  it('keeps the ceiling at 1 for an empty series', () => {
    expect(lineShape([])).toEqual({ points: [], maxTokens: 1 })
  })
})

describe('pieSlices', () => {
  it('builds clockwise slices covering 2π, largest model first', () => {
    const slices = pieSlices([
      modelRow('a', 100),
      modelRow('b', 300),
    ])

    expect(slices.map(slice => slice.model)).toEqual(['b', 'a'])
    expect(slices[0]?.start).toBe(0)
    expect(slices[1]?.end).toBeCloseTo(Math.PI * 2)
    expect(slices[0]?.fraction).toBeCloseTo(0.75)
    expect(slices[1]?.fraction).toBeCloseTo(0.25)
  })

  it('omits zero-token models and caps at TOP_MODELS', () => {
    const slices = pieSlices([
      modelRow('zero', 0),
      modelRow('a', 10),
      modelRow('b', 20),
      modelRow('c', 30),
      modelRow('d', 40),
    ])
    expect(slices.map(slice => slice.model)).toEqual(['d', 'c', 'b', 'a'])
    expect(slices.some(slice => slice.model === 'zero')).toBe(false)
  })

  it('returns no slices without positive totals', () => {
    expect(pieSlices([])).toEqual([])
    expect(pieSlices([modelRow('zero', 0)])).toEqual([])
  })
})
