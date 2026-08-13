/** Locale bundles for the mode switcher. */

/** Locale keys the mode switcher renders. */
export type ModeSwitcherLocaleKey =
  | 'commandDescription'
  | 'standard' | 'creative' | 'design' | 'vibe'
  | 'standardDetail' | 'creativeDetail' | 'designDetail' | 'vibeDetail'
  | 'switchFailed'

/** English copy. */
export const en: Record<ModeSwitcherLocaleKey, string> = {
  commandDescription: 'Switch this session\'s mode',
  standard: 'Standard',
  creative: 'Creative',
  design: 'Design',
  vibe: 'Vibe',
  standardDetail: 'Follow the request directly with the default working style.',
  creativeDetail: 'Prefer novel approaches and explore alternatives before committing.',
  designDetail: 'Think and produce designs only; filesystem and command tools are blocked.',
  vibeDetail: 'Run the fixed agent-cluster workflow: PM, designers, engineers, and QA.',
  switchFailed: 'The mode switch was not accepted by the host.',
}

/** Simplified Chinese copy. */
export const zh: Record<ModeSwitcherLocaleKey, string> = {
  commandDescription: '切换当前会话的模式',
  standard: '标准',
  creative: '创造',
  design: '设计',
  vibe: 'Vibe',
  standardDetail: '直接按请求执行，使用默认工作风格。',
  creativeDetail: '偏好新颖方案，落地前先探索替代做法。',
  designDetail: '只做思考与方案产出；文件读写与命令工具将被禁用。',
  vibeDetail: '运行固定 agent 集群工作流：产品、设计、工程与测试。',
  switchFailed: '宿主没有接受模式切换。',
}
