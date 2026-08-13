/** Locale bundles for the usage dashboard section. */

/** Locale keys the usage dashboard renders. */
export type UsageDashboardLocaleKey =
  | 'nav' | 'title' | 'intro' | 'refresh' | 'loading' | 'failed' | 'empty'
  | 'heatmapHeading' | 'heatmapIntro' | 'radarHeading' | 'radarIntro'
  | 'lineHeading' | 'lineIntro' | 'pieHeading' | 'pieIntro'
  | 'calls' | 'tokens' | 'total' | 'models' | 'days' | 'hours'
  | 'legendCalls' | 'noUsage'

/** English copy. */
export const en: Record<UsageDashboardLocaleKey, string> = {
  nav: 'Usage',
  title: 'Model usage',
  intro: 'Model calls and token consumption folded from your durable session logs.',
  refresh: 'Refresh',
  loading: 'Folding session logs…',
  failed: 'The usage summary could not be read; refresh to retry.',
  empty: 'No model calls with usage records yet.',
  heatmapHeading: 'Heatmap',
  heatmapIntro: 'Call intensity per calendar day, last 12 weeks.',
  radarHeading: 'Star chart',
  radarIntro: 'Top models across five usage dimensions, normalized per dimension.',
  lineHeading: 'Trend',
  lineIntro: 'Total tokens per day, last 30 days.',
  pieHeading: 'Share',
  pieIntro: 'Share of total tokens per model.',
  calls: 'Calls',
  tokens: 'Tokens',
  total: 'Total',
  models: 'Models',
  days: 'Days',
  hours: 'Hours',
  legendCalls: 'Calls',
  noUsage: 'No usage',
}

/** Simplified Chinese copy. */
export const zh: Record<UsageDashboardLocaleKey, string> = {
  nav: '用量',
  title: '模型消耗',
  intro: '从你的持久会话日志中汇总的模型调用与 token 消耗。',
  refresh: '刷新',
  loading: '正在汇总会话日志…',
  failed: '用量汇总读取失败；点击刷新重试。',
  empty: '还没有带用量记录的模型调用。',
  heatmapHeading: '热力图',
  heatmapIntro: '最近 12 周每天调用强度。',
  radarHeading: '星图',
  radarIntro: '头部模型在五个用量维度上的归一化对比。',
  lineHeading: '趋势',
  lineIntro: '最近 30 天每天的总 token 数。',
  pieHeading: '占比',
  pieIntro: '各模型占总 token 的比例。',
  calls: '调用',
  tokens: 'Token',
  total: '总计',
  models: '模型',
  days: '天数',
  hours: '时段',
  legendCalls: '调用',
  noUsage: '无用量',
}
