/**
 * Usage dashboard section: four charts over the folded usage summary, with
 * loading, failure, and empty states.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageSummary } from '@deepseek-ai/dsh-host-usage-dashboard/types'
import type { UsageDashboardInjected } from './usage-dashboard-controller.ts'
import type { UsageDashboardLocaleKey } from './locales.ts'
import { HeatmapChart, LineChart, PieChart, RadarChart } from './charts.tsx'
import { compactCount, heatmapCells, lineShape, pieSlices, radarShape } from './projections.ts'
import css from './UsageDashboard.module.css'

type TabLocale = (key: UsageDashboardLocaleKey) => string

/** Props the renderer binds for the usage section. */
export type UsageDashboardSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.usage'>
  & InjectFace<UsageDashboardInjected>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Usage dashboard copy. */
    'settings.usage': UsageDashboardLocaleKey
  }
}

/** Render the usage summary and the four usage charts. */
export function UsageDashboardSection({ t, useUsage, refresh }: UsageDashboardSectionProps) {
  const state = useUsage(value => value)
  return (
    <div className={css.section}>
      <div className={css.headerRow}>
        <div className={css.headerText}>
          <h2 className={css.heading}>{t('title')}</h2>
          <p className={css.intro}>{t('intro')}</p>
        </div>
        <button type="button" className={css.refresh} disabled={state.loading} onClick={refresh}>
          {t('refresh')}
        </button>
      </div>
      {state.loading && state.summary === undefined && <p className={css.status}>{t('loading')}</p>}
      {state.failed && <p role="alert" className={css.failed}>{t('failed')}</p>}
      {!state.loading && !state.failed && state.summary !== undefined && state.summary.totalCalls === 0 && (
        <p className={css.status}>{t('empty')}</p>
      )}
      {state.summary !== undefined && state.summary.totalCalls > 0 && (
        <UsageCharts t={t} summary={state.summary} />
      )}
    </div>
  )
}

/** The summary tiles and four chart cards once a summary stands. */
function UsageCharts({ t, summary }: { t: TabLocale; summary: UsageSummary }) {
  const cells = heatmapCells(summary.byDay)
  const radar = radarShape(summary)
  const line = lineShape(summary.byDay)
  const pie = pieSlices(summary.byModel)
  const modelCount = summary.byModel.filter(model => model.totalTokens > 0).length
  return (
    <>
      <div className={css.tiles}>
        <div className={css.tile}>
          <span className={css.tileValue}>{compactCount(summary.totalCalls)}</span>
          <span className={css.tileLabel}>{t('totalCalls')}</span>
        </div>
        <div className={css.tile}>
          <span className={css.tileValue}>{compactCount(summary.totalTokens)}</span>
          <span className={css.tileLabel}>{t('totalTokens')}</span>
        </div>
        <div className={css.tile}>
          <span className={css.tileValue}>{modelCount}</span>
          <span className={css.tileLabel}>{t('activeModels')}</span>
        </div>
        <div className={css.tile}>
          <span className={css.tileValue}>{summary.byDay.length}</span>
          <span className={css.tileLabel}>{t('activeDays')}</span>
        </div>
      </div>
      <div className={css.grid}>
        <section className={css.card} aria-labelledby="usage-heatmap-heading">
          <h3 id="usage-heatmap-heading" className={css.cardHeading}>{t('heatmapHeading')}</h3>
          <p className={css.cardIntro}>{t('heatmapIntro')}</p>
          <HeatmapChart cells={cells} />
          <Legend t={t} />
        </section>
        <section className={css.card} aria-labelledby="usage-radar-heading">
          <h3 id="usage-radar-heading" className={css.cardHeading}>{t('radarHeading')}</h3>
          <p className={css.cardIntro}>{t('radarIntro')}</p>
          {radar.series.length === 0 ? <p className={css.status}>{t('noUsage')}</p> : <RadarChart shape={radar} />}
        </section>
        <section className={css.card} aria-labelledby="usage-line-heading">
          <h3 id="usage-line-heading" className={css.cardHeading}>{t('lineHeading')}</h3>
          <p className={css.cardIntro}>{t('lineIntro')}</p>
          <LineChart shape={line} />
          {line.points.length === 0 && <p className={css.status}>{t('noUsage')}</p>}
        </section>
        <section className={css.card} aria-labelledby="usage-pie-heading">
          <h3 id="usage-pie-heading" className={css.cardHeading}>{t('pieHeading')}</h3>
          <p className={css.cardIntro}>{t('pieIntro')}</p>
          {pie.length === 0 ? <p className={css.status}>{t('noUsage')}</p> : <PieChart slices={pie} />}
        </section>
      </div>
    </>
  )
}

/** The heatmap intensity legend. */
function Legend({ t }: { t: TabLocale }) {
  return (
    <div className={css.legendRow}>
      <span className={css.legendLess}>{t('legendCalls')}</span>
      {[0, 1, 2, 3, 4].map(level => (
        <span key={level} className={css.heatCell} style={level === 0 ? undefined : { opacity: level / 4 }} />
      ))}
    </div>
  )
}
