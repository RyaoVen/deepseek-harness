/**
 * Shared vocabulary for the model-level `api` field — the request format one
 * model row speaks. The picker offers the three protocols the adapter's
 * protocol table can build for a repointed model; every other spelling a
 * `settings.yaml` author may have stored (a catalog no-op, say) is displayed
 * verbatim and left for the adapter's resolver to judge.
 */

import type { ModelsKey } from './locales.ts'

/** The request formats the per-model picker offers, in menu order. */
export const MODEL_API_OPTIONS: readonly { value: string; labelKey: ModelsKey }[] = [
  { value: 'openai-completions', labelKey: 'modelApiOpenAI' },
  { value: 'anthropic-messages', labelKey: 'modelApiAnthropic' },
  { value: 'openai-responses', labelKey: 'modelApiResponses' },
]

/**
 * Whether a stored value is one the picker offers; the adapter accepts more
 * spellings, so this gates display, not storage.
 * @param value - the stored `api` value.
 * @returns whether the picker renders this spelling as one of its choices.
 */
export function isSelectableModelApi(value: unknown): boolean {
  return typeof value === 'string' && MODEL_API_OPTIONS.some(option => option.value === value)
}

/**
 * The badge text for one row's stored api: the picker's label for the states
 * it knows, the raw spelling for anything hand-written, and the inherit label
 * when the field is absent.
 * @param api - the draft's `api` value.
 * @param t - section copy.
 * @returns the badge text.
 */
export function modelApiBadgeText(api: unknown, t: (key: ModelsKey) => string): string {
  if (typeof api !== 'string') return t('modelApiInherit')
  const option = MODEL_API_OPTIONS.find(entry => entry.value === api)
  return option === undefined ? api : t(option.labelKey)
}
