/**
 * Desktop decoration page script. The page is a plain local document (no
 * bundler): it opens the same WebSocket mux downlink the Web GUI uses and
 * folds session events into the three-state mascot, so the decoration always
 * mirrors the main window's conversation without any bridge from the GUI.
 * `window.decorBridge` (the decor preload) carries click/menu intent to the
 * shell main process.
 */

/** Convert an http(s) server URL into the ws(s) mux downlink URL. */
function muxUrlOf(server) {
  const url = new URL(server)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/api/events.mux'
  url.search = ''
  url.hash = ''
  return url.href
}

/** Set the mascot state and return it (for tests of the fold). */
function setStatus(status) {
  document.body.dataset.status = status
  return status
}

/** Pending timers, keyed so a superseded state cancels the older transition. */
const timers = { doneToIdle: undefined }

/** Fold one mux envelope into the mascot state. */
function foldEnvelope(envelope) {
  const payload = envelope && envelope.payload
  if (payload === undefined || payload.type !== 'session/event') return
  const event = payload.event
  if (event === undefined || typeof event.type !== 'string') return
  if (event.type === 'step/start') {
    window.clearTimeout(timers.doneToIdle)
    setStatus('thinking')
    return
  }
  if (event.type === 'step/end' || event.type === 'turn/end') {
    window.clearTimeout(timers.doneToIdle)
    setStatus('done')
    // A completed step relaxes back to idle shortly after; a follow-up
    // step/start (tool round-trips inside one turn) wins over the timer.
    timers.doneToIdle = window.setTimeout(() => setStatus('idle'), 2500)
  }
}

/** Wire the downlink and the shell bridge once the document is ready. */
function boot() {
  const params = new URLSearchParams(window.location.search)
  const server = params.get('server')
  if (server !== null && server.length > 0) {
    const socket = new WebSocket(muxUrlOf(server))
    socket.addEventListener('message', (message) => {
      try {
        foldEnvelope(JSON.parse(String(message.data)))
      } catch {
        /* a malformed frame is not this page's problem */
      }
    })
  }

  const orb = document.getElementById('orb')
  if (orb !== null) {
    orb.addEventListener('click', () => {
      window.decorBridge?.activate()
    })
    orb.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      window.decorBridge?.menu()
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
