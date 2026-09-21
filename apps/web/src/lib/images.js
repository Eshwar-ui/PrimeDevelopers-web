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

// Load-bearing, and not obvious: the render endpoint does NOT preserve aspect
// ratio when handed a width alone. Its default mode is `cover`, and with no
// height to go with it the height simply passes through unscaled — so a
// 2700x1800 hero asked for at width=1200 came back 1200x1800, squeezed to 44%
// of its proper width. Every photograph on the site was served this way, with
// `object-cover` disguising it as an aggressive crop.
//
// `contain` scales proportionally to fit the width instead. It never upscales,
// so the 180x100 partner logos — which ask for 600 and are already smaller
// than every width in the table below — keep passing through untouched.
const RESIZE = 'contain'

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
  // Partner-wall marks. Was 400, sized for the old marquee's 200x48 strip. A
  // wall cell is ~248px CSS at five columns, so 400 held at 1x and went soft on
  // retina; 600 covers 2x, and the largest source in the set (Qahwah, 512px)
  // upscales only slightly to reach it.
  logo: 600,
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
  return `${base.replace(OBJECT_PATH, RENDER_PATH)}?width=${width}&quality=${quality}&resize=${RESIZE}`
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

/**
 * Whether the transformer can actually resize this URL.
 *
 * Load-bearing for `srcSetFor`: `imageUrl` deliberately returns anything it
 * doesn't recognise untouched, which is right for a single `src` and actively
 * wrong for a `srcSet` — four candidates that are all the same untransformed
 * URL tell the browser it has a choice of widths when it has one file, and it
 * will happily pick the "1920w" entry for a 400px slot.
 */
const isTransformable = (src) =>
  typeof src === 'string' &&
  (src.includes(OBJECT_PATH) || src.includes(RENDER_PATH)) &&
  !/\.glb(\?|$)/i.test(src)

/**
 * Candidate widths per named slot.
 *
 * `WIDTHS` above is the *ceiling* — the 2x retina size — and until now it was
 * also the floor, because a single `src` has to serve every device. A phone
 * rendering a 390px-wide hero was handed the 1920px file: four times the pixels
 * it can show, on the connection least able to afford them.
 *
 * The ladders below are roughly 1.5x apart. Closer spacing buys precision the
 * eye cannot see while multiplying edge-cache misses; wider spacing starts
 * rounding a phone up to a tablet's file. Each ends on its `WIDTHS` value, so
 * the top of the ladder is exactly what the slot used to always serve and no
 * screen ever gets less than it did.
 */
export const SRCSET = {
  thumb: [240, 360, 480, 700],
  logo: [200, 300, 450, 600],
  card: [400, 640, 900, 1200],
  full: [640, 960, 1280, 1600, 1920],
}

/**
 * A `srcSet` string for a named slot, or `undefined` when the URL can't be
 * resized — `undefined` rather than an empty string because React omits the
 * attribute entirely for the former and emits `srcset=""` for the latter,
 * which Safari treats as a broken candidate list.
 */
export function srcSetFor(src, size) {
  const widths = SRCSET[size]
  if (!widths || !isTransformable(src)) return undefined
  return widths.map((w) => `${imageUrl(src, { width: w })} ${w}w`).join(', ')
}
