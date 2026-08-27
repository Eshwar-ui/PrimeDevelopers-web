/**
 * Web Mercator, the projection every slippy map on the internet is drawn in.
 *
 * The properties hero pins a photograph on every town the portfolio stands in,
 * and those pins have to sit in true relation to each other — Lewisville north
 * of Georgetown, Houston out to the east, the Austin corridor bunched together
 * because it really is. This is the arithmetic that answers *where does this
 * longitude and latitude land in this box*, in about twenty lines and with no
 * dependency: Leaflet is ~42KB gzipped plus a stylesheet, essentially all of it
 * for interaction the hero deliberately does not have.
 *
 * The zoom is what makes it adaptive rather than a lookup table of positions. A
 * portfolio concentrated in one metro frames itself tightly; one spread from
 * San Antonio to the Red River pulls back on its own. Nothing has to be
 * re-tuned when a listing is added in a new town.
 */

// The unit the zoom scale is defined against — the size of one map tile in the
// convention every provider shares. Nothing here fetches a tile; this is what
// makes "zoom 8" mean the same thing it means everywhere else.
const TILE = 256

const RAD = Math.PI / 180

/** Pixels across the whole world at a given zoom. */
export const worldSize = (zoom) => TILE * 2 ** zoom

/**
 * [lon, lat] → [x, y] in world pixels at `zoom`.
 *
 * The latitude term is the Mercator part: the further from the equator, the
 * more the projection stretches, which is why treating latitude linearly would
 * bunch the north of the state noticeably closer together than it is.
 */
export function lonLatToWorld([lon, lat], zoom) {
  const size = worldSize(zoom)
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const sin = Math.sin(clamped * RAD)

  return [
    ((lon + 180) / 360) * size,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  ]
}

/**
 * The tightest integer zoom at which every point still fits inside `width` ×
 * `height`, less `padding` on each edge.
 *
 * The bounds of a single-city portfolio are a point, which no zoom can fail to
 * fit — hence the ceiling, rather than letting the search run to the end and
 * return a scale at which the whole portfolio is one dot.
 */
export function fitZoom(points, width, height, { padX = 96, padY = 96, min = 3, max = 11 } = {}) {
  if (points.length < 2) return Math.min(max, 9)

  // The two axes get their own padding because the box they have to fit is not
  // the viewport — it is the strip of the fold left over below the copy, which
  // is far shorter than it is wide.
  const usable = { w: Math.max(1, width - padX * 2), h: Math.max(1, height - padY * 2) }

  for (let z = max; z >= min; z -= 1) {
    const xs = points.map((p) => lonLatToWorld(p, z)[0])
    const ys = points.map((p) => lonLatToWorld(p, z)[1])
    const spanX = Math.max(...xs) - Math.min(...xs)
    const spanY = Math.max(...ys) - Math.min(...ys)

    if (spanX <= usable.w && spanY <= usable.h) return z
  }

  return min
}

/** The centre of a set of points, in world pixels at `zoom`. */
export function centreOf(points, zoom) {
  const projected = points.map((p) => lonLatToWorld(p, zoom))
  const xs = projected.map((p) => p[0])
  const ys = projected.map((p) => p[1])

  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]
}
