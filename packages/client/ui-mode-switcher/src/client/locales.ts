/** Locale bundles for the mode switcher. */

/** Locale keys the mode switcher renders. */
export type ModeSwitcherLocaleKey =
  | 'commandDescription'
  | 'standard' | 'creative'
  | 'standardDetail' | 'creativeDetail'
  | 'switchFailed'

/** English copy. */
export const en: Record<ModeSwitcherLocaleKey, string> = {
  commandDescription: 'Switch this session\'s mode',
  standard: 'Standard',
  creative: 'Creative',
  standardDetail: 'Follow the request directly with the default working style.',
  creativeDetail: 'Prefer novel approaches and explore alternatives before committing.',
  switchFailed: 'The mode switch was not accepted by the host.',
}

/** Simplified Chinese copy. */
export const zh: Record<ModeSwitcherLocaleKey, string> = {
  commandDescription: '切换当前会话的模式',
  standard: '标准',
  creative: '创造',
  standardDetail: '直接按请求执行，使用默认工作风格。',
  creativeDetail: '偏好新颖方案，落地前先探索替代做法。',
  switchFailed: '宿主没有接受模式切换。',
}
