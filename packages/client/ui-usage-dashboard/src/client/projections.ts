/**
 * Pure data projections from a usage summary onto the four chart shapes.
 * Everything here is a deterministic function of the summary, so the charts
 * stay dumb renderers and the shapes stay unit-testable.
 */

import type { UsageDayRow, UsageModelRow, UsageSummary } from '@deepseek-ai/dsh-host-usage-dashboard/types'

/** One heatmap cell: a calendar day with a 0–4 intensity level. */
export interface HeatmapCell {
  /** `YYYY-MM-DD`. */
  day: string
  /** Calls recorded that day. */
  calls: number
  /** 0 (no calls) to 4 (top bucket). */
  level: number
}

/** One radar series: one model's normalized dimension values. */
export interface RadarSeries {
  model: string
  /** One normalized 0–1 value per dimension, in dimension order. */
  values: number[]
}

/** Radar shape: the shared dimension names and per-model series. */
export interface RadarShape {
  dimensions: string[]
  series: RadarSeries[]
}

/** One line chart point. */
export interface LinePoint {
  /** `MM-DD` label. */
  label: string
  /** Total tokens that day. */
  totalTokens: number
}

/** Line shape: points plus the scale ceiling. */
export interface LineShape {
  points: LinePoint[]
  /** Ceiling for the value axis (max totalTokens, at least 1). */
  maxTokens: number
}

/** One pie segment: a model's share of total tokens. */
export interface PieSlice {
  model: string
  /** Total tokens for the model. */
  totalTokens: number
  /** 0–1 fraction of the whole. */
  fraction: number
  /** Start angle in radians, 0 at 12 o'clock, clockwise. */
  start: number
  /** End angle in radians. */
  end: number
}

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Number of consecutive weeks the heatmap spans. */
export const HEATMAP_WEEKS = 12

/** Number of dimensions the radar draws per model. */
export const RADAR_DIMENSIONS = ['calls', 'input', 'output', 'cache read', 'cache write'] as const

/** Number of models the radar and pie keep (largest by total tokens first). */
export const TOP_MODELS = 4

/** Bucket a day's calls into a 0–4 intensity level by fixed thresholds. */
function intensity(calls: number): number {
  if (calls <= 0) return 0
  if (calls <= 2) return 1
  if (calls <= 5) return 2
  if (calls <= 12) return 3
  return 4
}

/**
 * Project the last `HEATMAP_WEEKS` weeks of calendar days ending today.
 * Weeks run Monday to Sunday; days outside the summary fold as level 0.
 * @param byDay - per-day usage rows.
 * @returns one cell per day, in week-major, day-of-week-minor order.
 */
export function heatmapCells(byDay: readonly UsageDayRow[]): HeatmapCell[] {
  const callsByDay = new Map(byDay.map(row => [row.day, row.calls]))
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  // Monday of today's week, then back one week per column minus one.
  const mondayOfTodayWeek = todayUtc - ((today.getUTCDay() + 6) % 7) * 86_400_000
  const firstMonday = mondayOfTodayWeek - (HEATMAP_WEEKS - 1) * 7 * 86_400_000
  const cells: HeatmapCell[] = []
  for (let week = 0; week < HEATMAP_WEEKS; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const time = firstMonday + (week * 7 + day) * 86_400_000
      const dayKey = new Date(time).toISOString().slice(0, 10)
      const calls = callsByDay.get(dayKey) ?? 0
      cells.push({ day: dayKey, calls, level: intensity(calls) })
    }
  }
  return cells
}

/**
 * Human labels for the heatmap's weekday rows.
 * @returns the seven weekday labels, Monday first.
 */
export function heatmapWeekdays(): readonly string[] {
  return WEEKDAY
}

/**
 * Project per-model radar series over the five dimensions. Each dimension is
 * normalized to the model maximum (1 = the largest value among kept models);
 * a model with no usage in a dimension scores 0.
 * @param summary - the usage summary.
 * @returns the shared dimensions and the top models' normalized series.
 */
export function radarShape(summary: UsageSummary): RadarShape {
  const models = [...summary.byModel]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, TOP_MODELS)
  const dimensions = [...RADAR_DIMENSIONS]
  const maxima: number[] = dimensions.map((dimension) => {
    let max = 0
    for (const model of models) max = Math.max(max, dimensionValue(model, dimension))
    return max
  })
  return {
    dimensions,
    series: models.map(model => ({
      model: model.model,
      values: dimensions.map((dimension, index) => {
        const max = maxima[index] as number
        return max <= 0 ? 0 : dimensionValue(model, dimension) / max
      }),
    })),
  }
}

/** One model row's raw value for a radar dimension name. */
function dimensionValue(model: UsageModelRow, dimension: string): number {
  switch (dimension) {
    case 'calls': return model.calls
    case 'input': return model.inputTokens
    case 'output': return model.outputTokens
    case 'cache read': return model.cacheReadTokens
    case 'cache write': return model.cacheWriteTokens
    /* v8 ignore next -- dimension names are a closed const list. */
    default: return 0
  }
}

/**
 * Project the daily token line. The last `days` calendar days with usage are
 * kept, in chronological order; days without usage are omitted so the line
 * stays readable.
 * @param byDay - per-day usage rows.
 * @param days - maximum number of kept days.
 * @returns points and the value-axis ceiling.
 */
export function lineShape(byDay: readonly UsageDayRow[], days = 30): LineShape {
  const points = byDay
    .slice(-days)
    .map(row => ({ label: row.day.slice(5), totalTokens: row.totalTokens }))
  const maxTokens = points.reduce((max, point) => Math.max(max, point.totalTokens), 0)
  return { points, maxTokens: Math.max(1, maxTokens) }
}

/**
 * Project the per-model donut slices. Models with zero total tokens are
 * omitted; the angles sum to 2π.
 * @param byDay - per-model usage rows.
 * @returns slices in first-seen order, largest model first.
 */
export function pieSlices(byDay: readonly UsageModelRow[]): PieSlice[] {
  const models = [...byDay]
    .filter(row => row.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, TOP_MODELS)
  const total = models.reduce((sum, row) => sum + row.totalTokens, 0)
  let angle = 0
  return models.map((row) => {
    const fraction = total <= 0 ? 0 : row.totalTokens / total
    const start = angle
    const end = angle + fraction * Math.PI * 2
    angle = end
    return { model: row.model, totalTokens: row.totalTokens, fraction, start, end }
  })
}
