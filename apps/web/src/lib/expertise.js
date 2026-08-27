/**
 * The four ways to work with Prime, and the photograph that stands for each.
 *
 * Two places draw these — the Expertise page in full, and the homepage's
 * services band as a four-up teaser — and until now only one of them knew where
 * the pictures were. The homepage rendered its watermark placeholder instead,
 * which is what the fallback is *for*, except the images had been supplied all
 * along and were sitting in `public/images/expertise`. Shared here so the two
 * cannot disagree about what Interiors looks like.
 *
 * Keyed on the slugified title rather than on position, because the CMS owns
 * the list: a fifth service, or a reordering, must not silently hand Franchise
 * the interiors photograph.
 */

export const slugify = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

// Served from `public/`, not imported through the bundler. These are large
// photographs that only two routes want; letting Vite fingerprint them would
// put them in the build graph for no gain, and a CMS-supplied image would take
// precedence over them anyway.
export const SERVICE_IMAGES = {
  interiors: '/images/expertise/interiors.webp',
  collaborations: '/images/expertise/collaborations.webp',
  franchise: '/images/expertise/franchise.webp',
  invest: '/images/expertise/invest.webp',
}

/**
 * The image for one service, or an empty string if there is none.
 *
 * An image set on the record wins, so uploading one through the CMS overrides
 * the file shipped here rather than being ignored by it. Callers that have
 * further fallbacks of their own — the Expertise page reaches for property
 * photography before giving up — chain them onto the empty return.
 */
export const serviceImage = (service) =>
  service?.image || SERVICE_IMAGES[slugify(service?.title)] || ''
