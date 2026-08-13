/**
 * Decoration row slot store: the desktop-bridge availability and the switch
 * state. The plugin's apply-world is the only writer; the row component reads
 * via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Store state mirrored from the desktop shell bridge. */
export interface DecorationRowState {
  /** Whether the page runs inside the desktop shell (the row hides otherwise). */
  available: boolean
  /** Whether the decoration window is shown. */
  enabled: boolean
}

/** Declared action shape giving the exported factory a stable return type. */
type DecorationRowActions = {
  sync: (draft: DecorationRowState, available: boolean, enabled: boolean) => void
}

/**
 * Declares the decoration row state and write surface.
 * @returns the store handle.
 */
export function createDecorationRowStore(): EngineStoreHandle<DecorationRowState, DecorationRowActions> {
  return defineStore({
    init: (): DecorationRowState => ({ available: false, enabled: false }),
    actions: {
      sync: (d, available: boolean, enabled: boolean) => {
        d.available = available
        d.enabled = enabled
      },
    },
  })
}
