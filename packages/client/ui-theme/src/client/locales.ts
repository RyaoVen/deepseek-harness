/** `settings.theme` namespace dictionaries (the Appearance row's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'appearance.title': '外观',
  'appearance.light': '浅色',
  'appearance.dark': '深色',
  'appearance.system': '跟随系统',
  'appearance.accent': '主题色',
  'appearance.accent.deepseek': '深蓝',
  'appearance.accent.teal': '青绿',
  'appearance.accent.violet': '紫罗兰',
  'appearance.accent.rose': '玫红',
  'appearance.accent.amber': '琥珀',
  'appearance.accent.emerald': '翡翠',
  'appearance.accent.graphite': '石墨',
  'appearance.motion': '动效',
  'appearance.motion.standard': '标准',
  'appearance.motion.reduced': '减弱',
} satisfies Record<string, string>

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'appearance.accent': 'Accent',
  'appearance.accent.deepseek': 'Deep Blue',
  'appearance.accent.teal': 'Teal',
  'appearance.accent.violet': 'Violet',
  'appearance.accent.rose': 'Rose',
  'appearance.accent.amber': 'Amber',
  'appearance.accent.emerald': 'Emerald',
  'appearance.accent.graphite': 'Graphite',
  'appearance.motion': 'Motion',
  'appearance.motion.standard': 'Standard',
  'appearance.motion.reduced': 'Reduced',
} satisfies Record<ThemeKey, string>
