/**
 * A city, drawn.
 *
 * The properties hero needs the *look* of the pale street map the reference is
 * built on — blocks, arterials, a river, parkland — without any of what that
 * normally costs: no tile service, no API key, no third-party request from a
 * visitor's browser, no attribution obligation, nothing to rate-limit or go
 * down. So the map is generated here, once, as plain SVG.
 *
 * ── What it is and is not ───────────────────────────────────────────────────
 *
 * This is cartographic *texture*, not cartography. It is not Austin, it is not
 * Dallas, and it does not claim to be — which is exactly why it carries no
 * labels. A drawn street grid with invented street names printed on it would be
 * a map that lies; the same grid with nothing written on it is a background,
 * and every fact on this fold — the towns, the counts, the addresses — is
 * carried by the pins and the card standing on top of it, which come from the
 * real listings. The pins themselves are still laid out by true relative
 * geography, so the shape of the portfolio across Texas is honest even though
 * the streets underneath are not a place.
 *
 * ── Why it is generated rather than drawn by hand ───────────────────────────
 *
 * A hand-authored street network convincing at this size is a few hundred path
 * commands that no one can maintain and that would have to be redrawn to change
 * the density. Seeded generation gives the same picture on every render and
 * every machine — the seed is fixed, so this is deterministic, not random —
 * while the density, the block size and the skew stay single numbers.
 */

// The canvas the city is drawn in. Rendered with `slice`, so the box it lands
// in crops this rather than squashing it and the streets keep their proportions
// at every viewport.
const W = 1400
const H = 1000

// The generated area runs well past the canvas because the whole grid is
// rotated: a network drawn exactly to the edges leaves bare triangles in the
// corners once it is turned.
const PAD = 420

// Real street networks are almost never square to the compass, and a grid that
// is reads instantly as a diagram. A few degrees is all it takes.
const SKEW = -7

// Block size, and how far each street is allowed to wander off its line.
const SPACING = 76
const SPACING_JITTER = 26
const WANDER = 7

// Every fourth line or so is promoted to an arterial — wider, and drawn over
// the minor streets.
const ARTERIAL_EVERY = 4

/** Mulberry32: a small, fast, seeded PRNG. Fixed seed in, same city out. */
function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The whole city, computed once at module load.
 *
 * At module scope rather than in a hook because none of it depends on props,
 * state or viewport — it is a constant that happens to be cheaper to describe
 * as a function than as literal path data.
 */
const CITY = (() => {
  const rand = prng(0x50726d64) // "Prmd"
  const between = (lo, hi) => lo + rand() * (hi - lo)

  // Where the streets cross, jittered so blocks are not all the same size.
  const lines = (from, to) => {
    const at = []
    for (let v = from; v < to; v += SPACING + between(-SPACING_JITTER, SPACING_JITTER)) at.push(v)
    return at
  }

  const xs = lines(-PAD, W + PAD)
  const ys = lines(-PAD, H + PAD)

  // A street as a polyline that drifts off true rather than a dead-straight
  // line. The drift is what stops the grid reading as graph paper.
  const run = (fixed, from, to, vertical) => {
    const points = []
    const steps = 7
    for (let i = 0; i <= steps; i += 1) {
      const along = from + ((to - from) * i) / steps
      const off = fixed + between(-WANDER, WANDER)
      points.push(vertical ? `${off.toFixed(1)},${along.toFixed(1)}` : `${along.toFixed(1)},${off.toFixed(1)}`)
    }
    return points.join(' ')
  }

  const minor = []
  const arterial = []

  xs.forEach((x, i) => {
    const d = run(x, -PAD, H + PAD, true)
    ;(i % ARTERIAL_EVERY === 2 ? arterial : minor).push(d)
  })
  ys.forEach((y, i) => {
    const d = run(y, -PAD, W + PAD, false)
    ;(i % ARTERIAL_EVERY === 0 ? arterial : minor).push(d)
  })

  // Built-up blocks: a subset of the cells, inset off their streets. Not every
  // cell, because a fully tiled grid loses the streets in it.
  const blocks = []
  const parks = []

  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x = xs[i]
      const y = ys[j]
      const w = xs[i + 1] - x
      const h = ys[j + 1] - y
      if (w < 24 || h < 24) continue

      const roll = rand()
      const inset = 5

      if (roll > 0.94) {
        parks.push({ x: x + inset, y: y + inset, w: w - inset * 2, h: h - inset * 2 })
      } else if (roll > 0.42) {
        blocks.push({ x: x + inset, y: y + inset, w: w - inset * 2, h: h - inset * 2 })
      }
    }
  }

  // The river. A smooth meander across the whole canvas, drawn as one stroked
  // path rather than a filled polygon so its width is a single number.
  const river = (() => {
    const points = []
    for (let i = 0; i <= 8; i += 1) {
      points.push([
        -PAD + ((W + PAD * 2) * i) / 8,
        H * 0.34 + Math.sin(i * 1.15) * 150 + between(-40, 40),
      ])
    }
    return points.reduce((d, [x, y], i, all) => {
      if (!i) return `M${x.toFixed(1)} ${y.toFixed(1)}`
      const [px, py] = all[i - 1]
      const cx = (px + x) / 2
      return `${d}C${cx.toFixed(1)} ${py.toFixed(1)} ${cx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
    }, '')
  })()

  // Two long freeways on their own alignment, ignoring the street grid the way
  // real ones do.
  const freeways = [
    `M${-PAD} ${H * 0.86} C ${W * 0.3} ${H * 0.74}, ${W * 0.62} ${H * 0.9}, ${W + PAD} ${H * 0.66}`,
    `M${W * 0.14} ${-PAD} C ${W * 0.3} ${H * 0.3}, ${W * 0.2} ${H * 0.62}, ${W * 0.44} ${H + PAD}`,
  ]

  return { minor, arterial, blocks, parks, river, freeways }
})()

/**
 * The palette lives on the root element as custom properties rather than in
 * `index.css`, because these six values are meaningless anywhere but here and
 * belong next to the thing that reads them. Both themes are stated in full —
 * the dark set is a genuine night-mode basemap, not the light one dimmed.
 */
const PALETTE =
  '[--land:#eceff1] [--block:#e2e7ea] [--park:#dde9dd] [--water:#cfe0ea] ' +
  '[--road:#ffffff] [--casing:#d7dde1] [--freeway:#f4e6cd] [--freeway-casing:#e2cfa8] ' +
  'dark:[--land:#0f1a20] dark:[--block:#14222a] dark:[--park:#152521] dark:[--water:#0e2733] ' +
  'dark:[--road:#22343e] dark:[--casing:#182731] dark:[--freeway:#3a3527] dark:[--freeway-casing:#2a2720]'

export default function StreetMap({ className = '' }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      // `slice` rather than the default: this is a ground, and a ground that
      // letterboxes is a picture of a map sitting on a page.
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
      className={`${PALETTE} ${className}`}
    >
      <rect x="0" y="0" width={W} height={H} fill="var(--land)" />

      {/* Everything inside the skew. The rotation is what keeps the grid from
          reading as a diagram; the freeways and the river are inside it too, so
          the whole city turns together. */}
      <g transform={`rotate(${SKEW} ${W / 2} ${H / 2})`}>
        {CITY.blocks.map((b) => (
          <rect
            key={`b${b.x}-${b.y}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="2"
            fill="var(--block)"
          />
        ))}

        {CITY.parks.map((p) => (
          <rect
            key={`p${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            rx="10"
            fill="var(--park)"
          />
        ))}

        {/* Minor streets, cased then filled — the pale outline is what gives a
            white road on a near-white ground its edge. Both passes are one
            <g> with a shared stroke so the browser is not resolving the same
            paint for two hundred elements. */}
        <g fill="none" stroke="var(--casing)" strokeWidth="6" strokeLinecap="round">
          {CITY.minor.map((d) => (
            <polyline key={`mc${d.slice(0, 24)}`} points={d} />
          ))}
        </g>
        <g fill="none" stroke="var(--road)" strokeWidth="4" strokeLinecap="round">
          {CITY.minor.map((d) => (
            <polyline key={`m${d.slice(0, 24)}`} points={d} />
          ))}
        </g>

        <g fill="none" stroke="var(--casing)" strokeWidth="13" strokeLinecap="round">
          {CITY.arterial.map((d) => (
            <polyline key={`ac${d.slice(0, 24)}`} points={d} />
          ))}
        </g>
        <g fill="none" stroke="var(--road)" strokeWidth="10" strokeLinecap="round">
          {CITY.arterial.map((d) => (
            <polyline key={`a${d.slice(0, 24)}`} points={d} />
          ))}
        </g>

        {/* Over the streets, not under them. A river drawn beneath the grid
            leaves roads running across open water for its whole length; drawn
            over it, the network simply stops at the bank, which is what a map
            without a bridge there actually looks like. */}
        <path d={CITY.river} fill="none" stroke="var(--water)" strokeWidth="34" strokeLinecap="round" />

        {/* And the freeways over the river, because those do bridge it. */}
        <g fill="none" strokeLinecap="round">
          {CITY.freeways.map((d) => (
            <path key={`fc${d.slice(0, 20)}`} d={d} stroke="var(--freeway-casing)" strokeWidth="17" />
          ))}
          {CITY.freeways.map((d) => (
            <path key={`f${d.slice(0, 20)}`} d={d} stroke="var(--freeway)" strokeWidth="12" />
          ))}
        </g>
      </g>
    </svg>
  )
}
