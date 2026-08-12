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
 * Named widths, so call sites state what the image *is* rather than guessing a
 * number. Each is roughly 2x the largest CSS size that slot ever renders at,
 * which is the point at which a retina display stops being able to tell.
 *
 * These matter more than they look: every URL used to carry width=1920, so the
 * six 78x54 hero thumbnails pulled ~633KB between them, and the client logos
 * were being *upscaled* from a 150px original to 1920px. Sizing them here is
 * the single largest saving on the homepage.
 */
export const WIDTHS = {
  // Hero rail tiles. They were 78x54 when this was 200; the redesign widened
  // them to half the copy column on phones and a third of it from `sm` up,
  // which is ~350px CSS at the top end — so 200 would now be visibly soft.
  thumb: 700,
  logo: 400, // marquee client logos — up to 200x48 CSS
  // Cards top out at ~735px CSS in the gallery, so this stays comfortably
  // retina. Sized generously on purpose: every card is lazy-loaded now, so the
  // extra weight lands after first paint rather than competing with it.
  card: 1200,
  full: DEFAULT_WIDTH, // full-bleed hero and detail imagery
}

/**
 * Rewrite a Supabase public object URL to its transformed equivalent, or resize
 * one that has already been rewritten.
 *
 * Handling the already-transformed case is what lets call sites narrow an image
 * that `withTransformedImages` has stamped with the default width. Without it
 * the blanket transform would be a ceiling as well as a floor, and nothing
 * downstream could ask for the 200px version it actually needs.
 *
 * Anything else — a local `/models/...` path, an external URL, an empty value —
 * is returned untouched, so this is safe to apply blanket-wise across CMS data.
 */
export function imageUrl(src, { width = DEFAULT_WIDTH, quality = DEFAULT_QUALITY } = {}) {
  if (typeof src !== 'string') return src

  const isObject = src.includes(OBJECT_PATH)
  const isRendered = src.includes(RENDER_PATH)
  if (!isObject && !isRendered) return src

  // `.glb` models live in a bucket of their own and must never be handed to an
  // image transformer, which would reject them and break the 3D viewer.
  if (/\.glb(\?|$)/i.test(src)) return src

  const [base] = src.split('?')
  return `${base.replace(OBJECT_PATH, RENDER_PATH)}?width=${width}&quality=${quality}`
}

/** `imageUrl` at a named width — the form nearly every call site wants. */
export const sized = (src, size) => imageUrl(src, { width: WIDTHS[size] ?? size })

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
