/** Locale bundles for the desktop decoration settings row. */

/** Locale keys the decoration row renders. */
export type DecorationKey =
  | 'title'
  | 'description'
  | 'on'
  | 'off'

/** English copy. */
export const en: Record<DecorationKey, string> = {
  title: 'Desktop decoration',
  description: 'Show the always-on-top mascot window that mirrors the session state.',
  on: 'On',
  off: 'Off',
}

/** Simplified Chinese copy. */
export const zh: Record<DecorationKey, string> = {
  title: '桌面挂饰',
  description: '显示置顶的吉祥物小窗，随会话状态变化。',
  on: '开',
  off: '关',
}
