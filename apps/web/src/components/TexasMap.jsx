import { useId } from 'react'

/**
 * The state, dotted, with a marker on every Texas city the portfolio actually
 * sits in.
 *
 * The outline is a hand-reduced Texas boundary — the panhandle, the Red River
 * run east, the Sabine down to the Gulf, the coast to Brownsville, the Rio
 * Grande back up through Big Bend to El Paso, and the 32nd parallel home. Around
 * fifty vertices, which is enough for the silhouette to be unmistakable at the
 * size a footer card shows it and few enough to read as a drawing rather than a
 * traced dataset.
 *
 * Outline and markers are projected by the *same* function, which is the whole
 * point: a pin placed by any other means drifts against the coast the moment the
 * projection or the viewBox changes, and a map whose pins sit in the Gulf is
 * worse than no map.
 */

// [lon, lat], clockwise from the north-west corner of the panhandle.
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
const WIDTH = 1000
const SCALE = WIDTH / ((-93.55 - LON_MIN) * K)
const HEIGHT = Math.round((LAT_MAX - LAT_MIN) * SCALE)

const project = ([lon, lat]) => [(lon - LON_MIN) * K * SCALE, (LAT_MAX - lat) * SCALE]

const OUTLINE = `${TEXAS.map((c, i) => `${i ? 'L' : 'M'}${project(c).map((n) => n.toFixed(1)).join(' ')}`).join('')}Z`

/**
 * Cities the portfolio can name. Keyed on the lowercased city as it appears in a
 * property's own address, so a listing added in a town that isn't here simply
 * gets no marker rather than an invented one.
 */
const CITIES = {
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
const cityOf = (address) => (address ?? '').match(/,\s*([^,]+?),\s*TX\b/i)?.[1].trim().toLowerCase()

/**
 * Markers, clustered.
 *
 * Leander, Cedar Park and Liberty Hill are three separate developments in three
 * separate towns, and at the scale of the whole state they land within about
 * seven pixels of each other — drawn individually they overlap into an
 * indistinct blob that reads as a rendering fault. Merging anything inside a
 * short radius into one marker carrying the combined count is both the legible
 * answer and the honest one: the portfolio really is concentrated there, and the
 * marker says so with its size.
 */
const CLUSTER_RADIUS = 34

function markersFor(properties) {
  const points = []

  for (const p of properties ?? []) {
    const coords = CITIES[cityOf(p.address)]
    if (!coords) continue

    const [x, y] = project(coords)
    const available = Number(p.available) || 0
    const near = points.find((pt) => Math.hypot(pt.x - x, pt.y - y) < CLUSTER_RADIUS)

    if (near) {
      // Weighted toward the sites already in the cluster so one outlying town
      // cannot drag the marker off the group it represents.
      near.x = (near.x * near.count + x) / (near.count + 1)
      near.y = (near.y * near.count + y) / (near.count + 1)
      near.count += 1
      near.available += available
    } else {
      points.push({ x, y, count: 1, available })
    }
  }

  return points
}

/**
 * Dot geometry, in viewBox units, per density.
 *
 * It has to be a choice rather than a constant because the pattern is defined in
 * user units and therefore *scales with the rendered width*. At the panel's
 * desktop size the fine grid resolves cleanly; in the stacked mobile layout the
 * same map draws about a third as wide, which put the dots under a pixel across
 * and the state vanished entirely — leaving two markers floating on an empty
 * card. Coarse trades density for dots that survive the scale.
 */
const DENSITY = {
  fine: { gap: 15, r: 2.7 },
  coarse: { gap: 26, r: 5.4 },
}

export default function TexasMap({ properties, density = 'fine', className = '' }) {
  const markers = markersFor(properties)
  const dots = DENSITY[density] ?? DENSITY.fine

  // Both the bleeding desktop map and the stacked mobile one are mounted at
  // once, so their defs share a document. SVG references resolve by id against
  // the whole document and take the first match, which means fixed ids would
  // silently hand the second instance the first one's pattern — and the two are
  // deliberately not the same any more.
  const uid = useId().replace(/:/g, '')
  const id = (name) => `${name}-${uid}`

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      fill="none"
      aria-hidden
      focusable="false"
      // `text-bone` belongs on the root, not on the dotted path. `currentColor`
      // inside a <pattern> resolves against the pattern's own inherited colour —
      // which comes from this <svg>, never from the element referencing the
      // pattern as a fill. With the colour set on the path instead, the dots
      // silently inherited the page's body text: near-white under the dark theme
      // and charcoal under the light one, where the whole map all but vanished
      // against the panel. Bone is fixed in both themes, so this is stable.
      className={`text-bone ${className}`}
    >
      <defs>
        {/* The dot field. A pattern rather than a few thousand authored circles:
            the browser tiles it, the file stays readable, and the density is one
            number instead of a generated list. */}
        <pattern id={id('dots')} width={dots.gap} height={dots.gap} patternUnits="userSpaceOnUse">
          <circle cx={dots.gap / 2} cy={dots.gap / 2} r={dots.r} fill="currentColor" fillOpacity="0.5" />
        </pattern>

        {/* Rim light along the north-west edge, in the brand's own two accents
            rather than the reference's spectrum. Ramped through its own alpha
            stops so it never has to cross grey on the way out. */}
        <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-ember)" stopOpacity="0.85" />
          <stop offset="38%" stopColor="var(--color-accent-soft)" stopOpacity="0.6" />
          <stop offset="72%" stopColor="var(--color-accent-soft)" stopOpacity="0" />
        </linearGradient>

        <radialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-accent-soft)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-accent-soft)" stopOpacity="0" />
        </radialGradient>

        <clipPath id={id('clip')}>
          <path d={OUTLINE} />
        </clipPath>
      </defs>

      {/* Atmosphere behind the state, clipped to it so the glow never leaks into
          the card as a soft rectangle. */}
      <g clipPath={`url(#${id('clip')})`}>
        <ellipse cx={WIDTH * 0.34} cy={HEIGHT * 0.62} rx={WIDTH * 0.42} ry={HEIGHT * 0.4} fill={`url(#${id('glow')})`} />
      </g>

      <path d={OUTLINE} fill={`url(#${id('dots')})`} />
      <path d={OUTLINE} stroke={`url(#${id('rim')})`} strokeWidth="2.5" strokeLinejoin="round" />

      {markers.map((m) => {
        // Area, not radius, tracks the count — a radius proportional to units
        // would make a 60-unit site look four times the site it is.
        const r = Math.min(26, 9 + Math.sqrt(m.available) * 1.6)
        return (
          <g key={`${m.x.toFixed(1)}-${m.y.toFixed(1)}`}>
            <circle cx={m.x} cy={m.y} r={r * 2.1} className="fill-accent-soft/12" />
            <circle cx={m.x} cy={m.y} r={r} className="fill-accent-soft/25 stroke-accent-soft/70" strokeWidth="2" />
            <circle cx={m.x} cy={m.y} r={r * 0.34} className="fill-bone" />
          </g>
        )
      })}
    </svg>
  )
}
