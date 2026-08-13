/** Appearance row store: snapshot-mirror action and the revision guard. */
import { describe, expect, it } from 'vitest'
import { createAppearanceRowStore } from '../src/client/settings-store.ts'

describe('createAppearanceRowStore', () => {
  it('init shape: system preference, base accent and motion, revision at -1', () => {
    const store = createAppearanceRowStore().create()
    expect(store.getSnapshot()).toEqual({
      preference: 'system', accent: 'deepseek', motion: 'standard', revision: -1,
    })
  })

  it('sync mirrors preference, accent, and motion and advances the revision', () => {
    const store = createAppearanceRowStore().create()
    store.actions.sync('dark', 'violet', 'reduced', 0)
    expect(store.getSnapshot()).toEqual({ preference: 'dark', accent: 'violet', motion: 'reduced', revision: 0 })
    store.actions.sync('light', 'teal', 'standard', 2)
    expect(store.getSnapshot()).toEqual({ preference: 'light', accent: 'teal', motion: 'standard', revision: 2 })
  })

  it('revision guard drops stale and duplicate writes', () => {
    const store = createAppearanceRowStore().create()
    store.actions.sync('dark', 'teal', 'standard', 3)
    store.actions.sync('system', 'deepseek', 'standard', 2)
    store.actions.sync('system', 'deepseek', 'standard', 3)
    expect(store.getSnapshot().preference).toBe('dark')
    expect(store.getSnapshot().accent).toBe('teal')
    expect(store.getSnapshot().revision).toBe(3)
  })
})
