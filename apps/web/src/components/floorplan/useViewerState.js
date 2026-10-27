import { lazy, useCallback, useState } from 'react'
import { hasWebGL } from '../../lib/webgl'
import { reportError } from '../../lib/reportError'

// Named so the launch button can start the chunk on hover or focus; the
// module cache makes the second call free.
export const loadViewer = () => import('./ModelViewer')

/**
 * Everything both plan sections need to run the 3D viewer honestly: whether
 * the visitor has asked for it, whether it failed and why, and a Retry that
 * actually retries.
 *
 * Failure used to be a boolean that swapped in the loading skeleton, so a
 * model that 404'd, a context iOS took back, or a phone with no WebGL all
 * showed "Loading…" forever, with the error thrown away. `failure.reason` is
 * one of:
 *   'webgl'   — no WebGL on this device; nothing to retry
 *   'context' — the GPU context was lost; a fresh canvas usually works
 *   'load'    — the model file failed to load or parse
 *   'chunk'   — the viewer's own code failed to arrive
 *
 * Retry clears drei's cached failure for the URL and makes a fresh lazy
 * component, because React.lazy keeps a rejected import forever.
 */
export function useViewerState(url) {
  const [Viewer, setViewer] = useState(() => lazy(loadViewer))
  const [activated, setActivated] = useState(false)
  const [failure, setFailure] = useState(null)
  // Bumped on Retry, to key the boundary and viewer so both start clean.
  const [attempt, setAttempt] = useState(0)

  const fail = useCallback(
    (error, reason = 'load') => {
      // No WebGL is a fact about the device, not an error to chase.
      if (reason !== 'webgl') reportError(error, { where: 'model-viewer', reason, url })
      // The first failure is the one that explains what the visitor saw;
      // anything after it is the viewer being torn down.
      setFailure((current) => current ?? { reason, error })
    },
    [url],
  )

  // Capability is checked here, on the press, never during render — see
  // lib/webgl.
  const activate = useCallback(() => {
    if (!hasWebGL()) {
      fail(new Error('WebGL is not available'), 'webgl')
      return
    }
    setActivated(true)
  }, [fail])

  const retry = useCallback(async () => {
    try {
      const { clearModelCache } = await import('./modelCache')
      clearModelCache(url)
    } catch {
      // The chunk itself is what failed; the fresh lazy below retries it.
    }
    setViewer(() => lazy(loadViewer))
    setFailure(null)
    setActivated(true)
    setAttempt((n) => n + 1)
  }, [url])

  return { Viewer, activated, activate, failure, fail, retry, attempt }
}
