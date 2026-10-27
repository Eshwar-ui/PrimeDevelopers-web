import { useGLTF } from '@react-three/drei'

// Kept apart from ModelViewer so a section can clear a failed load before it
// retries, through a dynamic import, without pulling the viewer's chunk into
// its own. drei arrives in the chunk the viewer already shares.
//
// A load that failed stays cached as a failure — drei's useGLTF keys its
// cache on the URL — so remounting without this rethrows the same error at
// once, and Retry would look like it did nothing.
export function clearModelCache(url) {
  if (url) useGLTF.clear(url)
}
