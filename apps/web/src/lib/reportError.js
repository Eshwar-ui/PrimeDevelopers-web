// Where caught errors go.
//
// The console, for now. The point of routing every caught error through one
// function is the day error tracking lands (the audit's phase 5 names Sentry):
// it is wired once, with setErrorReporter(), and every caller — the error
// boundaries, the 3D viewer's load and context-loss handlers — is covered
// without being touched.

let reporter = null

/** Installs the real error tracker. `fn(error, context)`; null removes it. */
export function setErrorReporter(fn) {
  reporter = typeof fn === 'function' ? fn : null
}

/**
 * Reports an error that was handled — shown to the visitor as a fallback
 * rather than thrown. `context.where` names the surface; anything else in
 * `context` travels with it to the tracker.
 */
export function reportError(error, context = {}) {
  console.error(`[prime] ${context.where ?? 'error'}`, error, context)
  try {
    reporter?.(error, context)
  } catch {
    // A broken tracker must never take the fallback down with it.
  }
}
