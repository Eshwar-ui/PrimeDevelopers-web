// Capability detection runs at activation, never at page load — creating a
// throwaway WebGL context on every page view costs memory on exactly the
// low-end devices we are trying to protect.
//
// And it runs once. The answer cannot change within a page's life, but the
// probe used to be repeated on every render of the site plan — 27 clicks made
// 75 contexts. Phones cap how many can be live at once and evict the oldest,
// which can be the viewer's own; the probe context is also released the moment
// it has answered, rather than left for the garbage collector.
let webglSupport = null

export function hasWebGL() {
  if (typeof window === 'undefined') return false
  if (webglSupport !== null) return webglSupport
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    webglSupport = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
