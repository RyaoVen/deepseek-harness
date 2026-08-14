/**
 * The four hand-rolled SVG charts of the usage dashboard. Each chart is a
 * pure function of its projected shape; styling comes from theme tokens via
 * the module's CSS classes.
 */

import type {
  HeatmapCell, LineShape, PieSlice, RadarShape,
} from './projections.ts'
import { compactCount } from './projections.ts'
import css from './UsageDashboard.module.css'

const CELL = 13
const CELL_GAP = 2
const HEATMAP_PAD_LEFT = 26
const HEATMAP_PAD_TOP = 4
const HEATMAP_WIDTH = HEATMAP_PAD_LEFT + 12 * (CELL + CELL_GAP)
const HEATMAP_HEIGHT = HEATMAP_PAD_TOP + 7 * (CELL + CELL_GAP)

/** Calendar heatmap: one column per week, one row per weekday. */
export function HeatmapChart({ cells }: { cells: readonly HeatmapCell[] }) {
  return (
    <svg
      className={css.chart}
      role="img"
      aria-label="heatmap"
      viewBox={`0 0 ${HEATMAP_WIDTH} ${HEATMAP_HEIGHT}`}
      width={HEATMAP_WIDTH}
      height={HEATMAP_HEIGHT}
    >
      {['Mon', 'Wed', 'Fri', 'Sun'].map((label, index) => (
        <text key={label} className={css.axisLabel} x={0} y={HEATMAP_PAD_TOP + (index * 2 + 1) * (CELL + CELL_GAP) + 4}>
          {label}
        </text>
      ))}
      {cells.map((cell, index) => {
        const column = Math.floor(index / 7)
        const row = index % 7
        return (
          <rect
            key={cell.day}
            className={cell.level === 0 ? css.heatEmpty : css.heatCell}
            style={cell.level === 0 ? undefined : { opacity: cell.level / 4 }}
            x={HEATMAP_PAD_LEFT + column * (CELL + CELL_GAP)}
            y={HEATMAP_PAD_TOP + row * (CELL + CELL_GAP)}
            width={CELL}
            height={CELL}
            rx={2}
          >
            <title>{`${cell.day}: ${cell.calls} calls`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

const RADAR_SIZE = 220
const RADAR_CENTER = RADAR_SIZE / 2
const RADAR_RADIUS = 76

/** Star chart: one polygon per model over the five normalized dimensions. */
export function RadarChart({ shape }: { shape: RadarShape }) {
  const ringPoints = (fraction: number): string => shape.dimensions
    .map((_, index) => {
      const [x, y] = polar(RADAR_CENTER, RADAR_CENTER, RADAR_RADIUS * fraction, index, shape.dimensions.length)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const series = shape.series.map((row) => {
    const points = row.values
      .map((value, index) => {
        const [x, y] = polar(RADAR_CENTER, RADAR_CENTER, RADAR_RADIUS * value, index, shape.dimensions.length)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
    return { ...row, points }
  })
  return (
    <svg className={css.chart} role="img" aria-label="radar" width={RADAR_SIZE} height={RADAR_SIZE}>
      {[0.25, 0.5, 0.75, 1].map(fraction => (
        <polygon key={fraction} className={css.radarRing} points={ringPoints(fraction)} />
      ))}
      {shape.dimensions.map((dimension, index) => {
        const [x, y] = polar(RADAR_CENTER, RADAR_CENTER, RADAR_RADIUS, index, shape.dimensions.length)
        return (
          <g key={dimension}>
            <line className={css.radarAxis} x1={RADAR_CENTER} y1={RADAR_CENTER} x2={x} y2={y} />
            <text className={css.axisLabel} x={x * 1.14} y={y * 1.14 + 3} textAnchor="middle">{dimension}</text>
          </g>
        )
      })}
      {series.map((row, index) => (
        <polygon
          key={row.model}
          className={css[`series${index}` as 'series0']}
          points={row.points}
          fillOpacity={0.12}
        >
          <title>{`${row.model}: ${row.values.map(value => value.toFixed(2)).join(', ')}`}</title>
        </polygon>
      ))}
    </svg>
  )
}

const LINE_WIDTH = 560
const LINE_HEIGHT = 170
const LINE_PAD = 14

/** Trend line: total tokens per day over the kept window. */
export function LineChart({ shape }: { shape: LineShape }) {
  if (shape.points.length === 0) return null
  const step = shape.points.length <= 1 ? 0 : (LINE_WIDTH - LINE_PAD * 2) / (shape.points.length - 1)
  const position = (index: number, totalTokens: number): [number, number] => [
    LINE_PAD + index * step,
    LINE_HEIGHT - LINE_PAD - (totalTokens / shape.maxTokens) * (LINE_HEIGHT - LINE_PAD * 2),
  ]
  const line = shape.points
    .map((point, index) => {
      const [x, y] = position(index, point.totalTokens)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const area = `${LINE_PAD},${LINE_HEIGHT - LINE_PAD} ${line} ${LINE_WIDTH - LINE_PAD},${LINE_HEIGHT - LINE_PAD}`
  const first = shape.points[0]
  const last = shape.points[shape.points.length - 1]
  return (
    <svg className={css.chart} role="img" aria-label="line" width={LINE_WIDTH} height={LINE_HEIGHT}>
      <polygon className={css.lineArea} points={area} />
      <polyline className={css.lineStroke} points={line} />
      {first !== undefined && (
        <text className={css.axisLabel} x={LINE_PAD} y={LINE_HEIGHT - 2}>{first.label}</text>
      )}
      {last !== undefined && (
        <text className={css.axisLabel} x={LINE_WIDTH - LINE_PAD} y={LINE_HEIGHT - 2} textAnchor="end">
          {last.label}
        </text>
      )}
    </svg>
  )
}

const PIE_RADIUS = 58
const PIE_STROKE = 20
const PIE_SIZE = (PIE_RADIUS + PIE_STROKE) * 2 + 8

/** Donut chart: per-model share of total tokens. */
export function PieChart({ slices }: { slices: readonly PieSlice[] }) {
  const center = PIE_SIZE / 2
  return (
    <div className={css.pieWrap}>
      <svg className={css.chart} role="img" aria-label="pie" width={PIE_SIZE} height={PIE_SIZE}>
        {slices.map((slice, index) => (
          <path
            key={slice.model}
            className={css[`series${index}` as 'series0']}
            d={arcPath(center, center, PIE_RADIUS, slice.start, slice.end)}
            strokeWidth={PIE_STROKE}
            fill="none"
          >
            <title>{`${slice.model}: ${slice.totalTokens} tokens (${(slice.fraction * 100).toFixed(1)}%)`}</title>
          </path>
        ))}
        <text className={css.pieCenterValue} x={center} y={center - 2} textAnchor="middle">
          {compactCount(slices.reduce((sum, slice) => sum + slice.totalTokens, 0))}
        </text>
        <text className={css.pieCenterLabel} x={center} y={center + 14} textAnchor="middle">tokens</text>
      </svg>
      <ul className={css.legend}>
        {slices.map((slice, index) => (
          <li key={slice.model}>
            <span className={css[`swatch${index}` as 'swatch0']} />
            <span className={css.legendName}>{slice.model}</span>
            <span className={css.legendValue}>{(slice.fraction * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One point on a circle, angle 0 at 12 o'clock, clockwise. */
function polar(cx: number, cy: number, radius: number, index: number, count: number): [number, number] {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
}

/** One donut arc path from start to end angle (clockwise). */
function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const [startX, startY] = polar(cx, cy, radius, start / (Math.PI * 2), 1)
  if (end - start >= Math.PI * 2 - 1e-6) {
    // A full circle: a single arc whose start and end coincide degenerates to
    // an invisible zero-length path, so split the ring into two semicircles.
    const [halfX, halfY] = polar(cx, cy, radius, (start + Math.PI) / (Math.PI * 2), 1)
    const [endX, endY] = polar(cx, cy, radius, end / (Math.PI * 2), 1)
    return `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 0 1 ${halfX.toFixed(2)} ${halfY.toFixed(2)}`
      + ` A ${radius} ${radius} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`
  }
  const [endX, endY] = polar(cx, cy, radius, end / (Math.PI * 2), 1)
  const largeArc = end - start > Math.PI ? 1 : 0
  return `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`
}
