// Serves stored images through the website API's resizer instead of raw.
//
// The CMS stores whatever the admin uploaded, and the client's source images
// are ~2MB PNGs of photographs — PNG being lossless, and therefore the worst
// possible format for a photo. Originals live at <site>/media/images/...; the
// API resizes them at <site>/api/img/images/... (apps/api/src/modules/media),
// proportionally, never enlarging, as WebP. A 2,153,717-byte hero slide arrives
// as ~115,298 bytes, with no re-upload and no change to what is stored.
// CloudFront caches each resized result, so the cost is paid once.

// The site's own origin. Media is matched only there (absolute) or as a
// root-relative path, so an external URL that happens to contain
// /media/images/ is left alone rather than pointed at a resizer it doesn't have.
const SITE_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_API_BASE_URL).origin
  } catch {
    return ''
  }
})()
const MEDIA_IMAGES = '/media/images/'
const RESIZER_IMAGES = '/api/img/images/'
const pathOnSite = (src) => {
  if (src.startsWith('/') && !src.startsWith('//')) return src
  if (SITE_ORIGIN && src.startsWith(`${SITE_ORIGIN}/`)) return src.slice(SITE_ORIGIN.length)
  return null
}
const isSiteImage = (src) => {
  const path = pathOnSite(src)
  return Boolean(path) && (path.startsWith(MEDIA_IMAGES) || path.startsWith(RESIZER_IMAGES))
}

/**
 * The public root that `images/...` paths hang off: the site's own /media
 * (S3 behind CloudFront in production; the dev server proxies it). The AWS
 * build also sets VITE_MEDIA_BASE to <site>/media explicitly.
 */
export const MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE || `${SITE_ORIGIN}/media`

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
 * Point a stored site image at the resizer, or re-size one already pointed there.
 *
 * Handling the already-resized case is what lets call sites narrow an image
 * that `withTransformedImages` has stamped with the default width. Without it
 * the blanket transform would be a ceiling as well as a floor, and nothing
 * downstream could ask for the 200px version it actually needs.
 *
 * Anything else — a local `/models/...` path, an external URL, an empty value —
 * is returned untouched, so this is safe to apply blanket-wise across CMS data.
 */
export function imageUrl(src, { width = DEFAULT_WIDTH, quality = DEFAULT_QUALITY } = {}) {
  if (typeof src !== 'string' || !isSiteImage(src)) return src

  // `.glb` models must never be handed to the image resizer, which would
  // reject them and break the 3D viewer.
  if (/\.glb(\?|$)/i.test(src)) return src

  const [base] = src.split('?')
  return `${base.replace(MEDIA_IMAGES, RESIZER_IMAGES)}?width=${width}&quality=${quality}`
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
  // Only a string that is a URL and nothing else. A journal post's Markdown
  // body can *contain* a storage URL, and handing the whole body to imageUrl
  // cut it off at the first "?" in the prose. Images inside a body are sized
  // where they render instead.
  if (typeof value === 'string') return /^https?:\/\/\S+$/.test(value) ? imageUrl(value, options) : value
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
const isTransformable = (src) => typeof src === 'string' && isSiteImage(src) && !/\.glb(\?|$)/i.test(src)

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

/**
 * Authored alt text for one of a property's images, or ''.
 *
 * `detail.imageAlts` is a list of `{ src, alt }` rather than a map keyed by
 * URL on purpose: `withTransformedImages` rewrites every URL *value* on load
 * and leaves object keys alone, so a keyed map would stop matching the
 * gallery the moment it reached a visitor. As values, both sides are
 * rewritten the same way and still compare equal.
 */
export const imageAlt = (property, src) =>
  (property?.detail?.imageAlts ?? []).find((entry) => entry?.src && entry.src === src)?.alt ?? ''
