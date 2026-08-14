/**
 * The hero mode seat: staging semantics — a pick waits for a blank session,
 * is applied when one becomes current, and is consumed once applied.
 */

import { describe, expect, it, vi } from 'vitest'
import { createSnapshotStore, type SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { AGENT_MODES, ModeSeatController } from '../src/client/mode-seat-store.ts'
import type { ModeSeatSessionSummary } from '../src/client/mode-seat-store.ts'

const SESSION = 's-1' as SessionId

function harness() {
  const setMode = vi.fn(async () => true)
  let session: ModeSeatSessionSummary | undefined = { id: SESSION, blank: true }
  const seat = new ModeSeatController(
    async () => 'creative',
    setMode,
    () => session,
  )
  return { seat, setMode, current: () => session, setSession: (next?: ModeSeatSessionSummary) => { session = next } }
}

describe('ModeSeatController', () => {
  it('lists every known mode in UI order', () => {
    const { seat } = harness()
    expect(seat.store.getSnapshot().options).toEqual(['standard', 'creative', 'design', 'vibe', 'spec'])
    expect(AGENT_MODES).toHaveLength(5)
  })

  it('loads the current session mode onto the chip', async () => {
    const { seat } = harness()
    await seat.load()
    expect(seat.store.getSnapshot().current).toBe('creative')
  })

  it('applies a staged pick to a blank session and consumes it', async () => {
    const { seat, setMode } = harness()
    await seat.select('vibe')
    expect(setMode).toHaveBeenCalledWith(SESSION, 'vibe')
    expect(seat.store.getSnapshot().current).toBe('vibe')
    expect(setMode).toHaveBeenCalledTimes(1)
  })

  it('applies a staged pick when a blank session appears later', async () => {
    const { seat, setMode, setSession } = harness()
    setSession(undefined)
    await seat.select('spec')
    expect(setMode).not.toHaveBeenCalled()
    setSession({ id: SESSION, blank: true })
    await seat.apply()
    expect(setMode).toHaveBeenCalledWith(SESSION, 'spec')
    expect(seat.store.getSnapshot().current).toBe('spec')
  })

  it('drops the stage when the session has already run', async () => {
    const { seat, setMode, setSession } = harness()
    setSession({ id: SESSION, blank: false })
    await seat.select('design')
    expect(setMode).not.toHaveBeenCalled()
    expect(seat.store.getSnapshot().current).toBe('standard')
  })

  it('publishes a rejected apply through the snapshot', async () => {
    const { seat, setMode } = harness()
    setMode.mockResolvedValueOnce(false)
    await seat.select('vibe')
    expect(seat.store.getSnapshot().error).toBe('mode switch was rejected')
    expect(seat.store.getSnapshot().current).toBe('standard')
  })

  it('keeps the seat reactive through its store', async () => {
    const { seat } = harness()
    const store = createSnapshotStore(seat.store.getSnapshot())
    const stop = seat.store.subscribe(() => store.set(seat.store.getSnapshot()))
    await seat.select('creative')
    stop()
    expect(store.getSnapshot().current).toBe('creative')
  })
})
