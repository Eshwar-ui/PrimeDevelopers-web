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
 * Build the address -> city lookup both maps resolve against.
 *
 * `cities` is the `texas_map` CMS section's list, `[{ name, lat, lon }]`, so
 * adding a town is an admin action rather than a release. Keyed on the
 * lowercased name so it can be matched straight off a property's own address,
 * and carrying the name as authored, because "liberty hill" is not how the
 * town writes it.
 *
 * Rows missing a name or either coordinate are dropped rather than defaulted.
 * A city that fell back to [0, 0] would plant a marker in the Gulf of Guinea
 * and look like a projection bug rather than a missing field.
 */
export function cityIndex(cities = []) {
  const index = {}

  for (const c of cities ?? []) {
    const name = String(c?.name ?? '').trim()
    const lon = Number(c?.lon)
    const lat = Number(c?.lat)
    if (!name || !Number.isFinite(lon) || !Number.isFinite(lat)) continue
    index[name.toLowerCase()] = { label: name, coords: [lon, lat] }
  }

  return index
}

// "2601 State Hwy 121, Lewisville, TX 75067" → "lewisville". Anchored on the
// state abbreviation rather than on comma position, because the street half of
// an address carries a variable number of commas.
export const cityOf = (address) =>
  (address ?? '').match(/,\s*([^,]+?),\s*TX\b/i)?.[1].trim().toLowerCase()

/**
 * Every city the portfolio actually stands in, in map order (north to south),
 * with the listings that sit there.
 *
 * The filter bar and the hero map both need this, and they need to agree: a
 * location the dropdown offers and the map cannot draw is a dead option.
 */
export function citiesFor(properties, cities) {
  const index = cityIndex(cities)
  const found = new Map()

  for (const p of properties ?? []) {
    const key = cityOf(p.address)
    const city = key ? index[key] : null
    if (!city) continue
    if (!found.has(key)) found.set(key, { key, label: city.label, coords: city.coords, properties: [] })
    found.get(key).properties.push(p)
  }

  return [...found.values()].sort((a, b) => b.coords[1] - a.coords[1])
}
