// Serves stored images through Supabase's image transformer instead of raw.
//
// The CMS stores whatever the admin uploaded, and the client's source images
// are ~2MB PNGs of photographs — PNG being lossless, and therefore the worst
// possible format for a photo. The hero carousel alone pulled 12.7MB, which is
// most of why a cold load took seconds.
//
// Supabase's render endpoint resizes on the fly and content-negotiates WebP
// from the browser's Accept header, so the same slide drops from 2,153,717
// bytes to 115,298 — a 95% saving with no re-upload and no change to what is
// stored. Transformed results are cached at the edge, so the cost is paid once.

const OBJECT_PATH = '/storage/v1/object/public/'
const RENDER_PATH = '/storage/v1/render/image/public/'

// Wide enough for a full-bleed hero on a 2x laptop display without being so
// large that a phone downloads desktop pixels. Individual call sites pass a
// smaller width where the image is known to render small — a card thumbnail has
// no use for 1920px.
const DEFAULT_WIDTH = 1920
const DEFAULT_QUALITY = 75

/**
 * Rewrite a Supabase public object URL to its transformed equivalent.
 *
 * Anything else — a local `/models/...` path, an external URL, an empty value,
 * or a URL already pointing at the render endpoint — is returned untouched, so
 * this is safe to apply blanket-wise across CMS data.
 */
export function imageUrl(src, { width = DEFAULT_WIDTH, quality = DEFAULT_QUALITY } = {}) {
  if (typeof src !== 'string' || !src.includes(OBJECT_PATH)) return src

  // `.glb` models live in a bucket of their own and must never be handed to an
  // image transformer, which would reject them and break the 3D viewer.
  if (/\.glb(\?|$)/i.test(src)) return src

  const [base] = src.split('?')
  return `${base.replace(OBJECT_PATH, RENDER_PATH)}?width=${width}&quality=${quality}`
}

/**
 * Walk CMS data and transform every image URL in it.
 *
 * Applied once where content is loaded rather than at each of the ~30 places an
 * image is rendered: a single choke point cannot be forgotten when someone adds
 * a new `<img>`, and it covers URLs nested anywhere in the property `detail`
 * blob without needing to know its shape.
 */
export function withTransformedImages(value, options) {
  if (typeof value === 'string') return imageUrl(value, options)
  if (Array.isArray(value)) return value.map((item) => withTransformedImages(item, options))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, item] of Object.entries(value)) out[key] = withTransformedImages(item, options)
    return out
  }
  return value
}
