import { useId } from 'react'
import { CITIES, HEIGHT, OUTLINE, WIDTH, cityOf, project } from '../lib/texas'

/**
 * The state, dotted, with a marker on every Texas city the portfolio actually
 * sits in.
 *
 * The outline, the projection and the city table all come from `lib/texas` —
 * this component draws the state, it does not define it. That split exists
 * because the properties hero now draws the same coastline under a completely
 * different treatment, and two hand-copied projections would drift the first
 * time either was touched.
 */

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
