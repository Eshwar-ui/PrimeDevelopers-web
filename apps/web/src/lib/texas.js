/**
 * The state, projected once.
 *
 * Two places draw Texas now — the footer's dotted card and the properties
 * hero's full-bleed ground — and they have to agree. An outline and a set of
 * pins are only trustworthy together if the *same* function placed both, so the
 * geometry lives here and neither component is allowed its own copy. A pin
 * placed by any other means drifts against the coast the moment the projection
 * or the viewBox changes, and a map whose pins sit in the Gulf is worse than no
 * map.
 *
 * Extracted verbatim from `TexasMap`, which was the only caller until the hero
 * needed the same coastline underneath a different treatment.
 */

// [lon, lat], clockwise from the north-west corner of the panhandle.
//
// A hand-reduced boundary — the panhandle, the Red River run east, the Sabine
// down to the Gulf, the coast to Brownsville, the Rio Grande back up through
// Big Bend to El Paso, and the 32nd parallel home. Around fifty vertices, which
// is enough for the silhouette to be unmistakable at the size a footer card
// shows it and few enough to read as a drawing rather than a traced dataset.
const TEXAS = [
  [-103.0, 36.5], [-100.0, 36.5], [-100.0, 34.56], [-99.2, 34.56],
  [-98.95, 34.21], [-98.1, 34.13], [-97.37, 33.87], [-96.9, 33.87],
  [-96.3, 33.7], [-95.55, 33.93], [-94.95, 33.75], [-94.04, 33.55],
  [-94.04, 33.02], [-94.04, 31.98], [-93.85, 31.2], [-93.55, 31.0],
  [-93.75, 30.35], [-93.7, 29.77],
  [-94.75, 29.35], [-95.1, 28.95], [-96.0, 28.6], [-96.8, 28.3],
  [-97.15, 27.9], [-97.35, 27.3], [-97.28, 26.6], [-97.15, 26.05],
  [-97.35, 25.85],
  [-98.2, 26.05], [-98.8, 26.35], [-99.1, 26.4], [-99.45, 27.05],
  [-99.5, 27.5], [-100.0, 28.05], [-100.65, 28.9], [-101.4, 29.75],
  [-102.35, 29.87], [-102.9, 29.2], [-103.15, 28.99], [-104.1, 29.4],
  [-104.7, 30.15], [-105.6, 30.8], [-106.5, 31.75], [-106.62, 31.91],
  [-106.62, 32.0], [-103.06, 32.0], [-103.06, 36.5],
]

// Equirectangular with the longitude degree narrowed by cos(mid-latitude).
// Without that correction Texas comes out noticeably too wide and stops being
// the shape everyone in the state recognises instantly.
const LON_MIN = -106.62
const LAT_MAX = 36.5
const LAT_MIN = 25.85
const K = Math.cos((31.2 * Math.PI) / 180)

export const WIDTH = 1000
const SCALE = WIDTH / ((-93.55 - LON_MIN) * K)
export const HEIGHT = Math.round((LAT_MAX - LAT_MIN) * SCALE)

export const project = ([lon, lat]) => [(lon - LON_MIN) * K * SCALE, (LAT_MAX - lat) * SCALE]

export const OUTLINE = `${TEXAS.map(
  (c, i) => `${i ? 'L' : 'M'}${project(c).map((n) => n.toFixed(1)).join(' ')}`,
).join('')}Z`

/**
 * Cities the portfolio can name. Keyed on the lowercased city as it appears in a
 * property's own address, so a listing added in a town that isn't here simply
 * gets no marker rather than an invented one.
 */
export const CITIES = {
  lewisville: [-96.9942, 33.0462],
  leander: [-97.8531, 30.5788],
  'cedar park': [-97.8203, 30.5052],
  'liberty hill': [-97.9225, 30.6649],
  austin: [-97.7431, 30.2672],
  georgetown: [-97.6779, 30.6333],
  'round rock': [-97.6789, 30.5083],
  pflugerville: [-97.62, 30.4394],
  hutto: [-97.5467, 30.5427],
  taylor: [-97.4092, 30.571],
  kyle: [-97.8772, 29.9891],
  buda: [-97.8403, 30.0855],
  'san marcos': [-97.9414, 29.8833],
  frisco: [-96.8236, 33.1507],
  anna: [-96.5486, 33.3487],
  plano: [-96.6989, 33.0198],
  mckinney: [-96.6389, 33.1972],
  denton: [-97.1331, 33.2148],
  dallas: [-96.797, 32.7767],
  'fort worth': [-97.3308, 32.7555],
  houston: [-95.3698, 29.7604],
  'san antonio': [-98.4936, 29.4241],
  waco: [-97.1467, 31.5493],
}

// "2601 State Hwy 121, Lewisville, TX 75067" → "lewisville". Anchored on the
// state abbreviation rather than on comma position, because the street half of
// an address carries a variable number of commas.
export const cityOf = (address) =>
  (address ?? '').match(/,\s*([^,]+?),\s*TX\b/i)?.[1].trim().toLowerCase()

// Title Case for display: the lookup table is lowercased so it can be keyed off
// a raw address, but "liberty hill" is not how the town writes its own name.
export const cityLabel = (key) =>
  (key ?? '').replace(/(^|\s)\w/g, (c) => c.toUpperCase())

/**
 * Every city the portfolio actually stands in, in map order (north to south),
 * with the listings that sit there.
 *
 * The filter bar and the hero map both need this, and they need to agree: a
 * location the dropdown offers and the map cannot draw is a dead option.
 */
export function citiesFor(properties) {
  const found = new Map()

  for (const p of properties ?? []) {
    const key = cityOf(p.address)
    if (!key || !CITIES[key]) continue
    if (!found.has(key)) found.set(key, { key, label: cityLabel(key), coords: CITIES[key], properties: [] })
    found.get(key).properties.push(p)
  }

  return [...found.values()].sort((a, b) => b.coords[1] - a.coords[1])
}
