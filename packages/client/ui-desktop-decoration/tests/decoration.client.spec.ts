/**
 * The decoration settings row: bridge detection, locale keys, and the store's
 * sync semantics. Pure units — no browser, no slots.
 */

import { describe, expect, it } from 'vitest'
import { createDecorationRowStore } from '../src/client/settings-store.ts'
import { desktopBridgeOf, type DesktopBridge } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'

describe('ui-desktop-decoration', () => {
  it('ships parallel bilingual copy', () => {
    const keys = Object.keys(en).sort()
    expect(Object.keys(zh).sort()).toEqual(keys)
    expect(keys).toEqual(['description', 'off', 'on', 'title'])
  })

  it('detects the desktop bridge only when the shell exposes it', () => {
    expect(desktopBridgeOf()).toBeUndefined()
    const bridge: DesktopBridge = {
      getDecorEnabled: async () => true,
      setDecorEnabled: () => {},
    }
    Object.defineProperty(globalThis, 'window', {
      value: { desktopBridge: bridge },
      configurable: true,
    })
    try {
      expect(desktopBridgeOf()).toBe(bridge)
    } finally {
      delete (globalThis as { window?: unknown }).window
    }
  })

  it('mirrors the bridge availability and switch state through the store', () => {
    const store = createDecorationRowStore()
    const instance = store.create()
    expect(instance.getSnapshot().available).toBe(false)
    expect(instance.getSnapshot().enabled).toBe(false)
    instance.actions.sync(true, true)
    expect(instance.getSnapshot().available).toBe(true)
    expect(instance.getSnapshot().enabled).toBe(true)
    instance.actions.sync(true, false)
    expect(instance.getSnapshot().enabled).toBe(false)
  })
})
