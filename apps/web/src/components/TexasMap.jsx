import { useId, useMemo, useState } from 'react'
import { HEIGHT, OUTLINE, WIDTH, cityIndex, cityOf, project } from '../lib/texas'

/**
 * The state, dotted, with a marker on every Texas city the portfolio actually
 * sits in.
 *
 * The outline and the projection come from `lib/texas` — this component draws
 * the state, it does not define it. That split exists because the properties
 * hero draws the same coastline under a completely different treatment, and
 * two hand-copied projections would drift the first time either was touched.
 *
 * The city coordinates deliberately do *not* come from there. They arrive as a
 * `cities` prop sourced from the `texas_map` CMS section, so adding a town is
 * an admin action rather than a release — which is the whole point, since a
 * property in a town missing from the table renders no marker and says nothing
 * about why.
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

function markersFor(properties, cityLookup) {
  const points = []

  for (const p of properties ?? []) {
    const city = cityLookup[cityOf(p.address)]
    if (!city) continue

    const [x, y] = project(city.coords)
    const available = Number(p.available) || 0
    const near = points.find((pt) => Math.hypot(pt.x - x, pt.y - y) < CLUSTER_RADIUS)

    if (near) {
      // Weighted toward the sites already in the cluster so one outlying town
      // cannot drag the marker off the group it represents.
      near.x = (near.x * near.count + x) / (near.count + 1)
      near.y = (near.y * near.count + y) / (near.count + 1)
      near.count += 1
      near.available += available
      near.items.push({ property: p, city: city.label, x, y })
    } else {
      points.push({ x, y, count: 1, available, items: [{ property: p, city: city.label, x, y }] })
    }
  }

  return points
}

/**
 * A cluster, taken apart again — one marker per town rather than one per site.
 *
 * Per town and not per property, because two of the four Austin-area sites are
 * both in Leander: split to the property they would be two markers at identical
 * coordinates, which is the exact overlap the clustering exists to prevent —
 * reintroduced by the thing meant to resolve it.
 */
function splitByCity(cluster) {
  const byCity = new Map()

  for (const item of cluster.items) {
    const existing = byCity.get(item.city)
    if (existing) {
      existing.items.push(item)
      existing.available += Number(item.property.available) || 0
    } else {
      byCity.set(item.city, {
        x: item.x,
        y: item.y,
        count: 1,
        available: Number(item.property.available) || 0,
        items: [item],
      })
    }
  }

  return [...byCity.values()]
}

/**
 * A cluster's towns, fanned out around it on short leader lines.
 *
 * The alternative was magnifying the map, which does not work here. Cedar Park
 * and Leander are about seven units apart on a thousand-unit map while a
 * marker's halo runs to forty, so prising them apart on zoom alone needs
 * something past 12× — and by 4.5× the coastline has already left the frame and
 * the panel is a featureless field of dots. A map of Texas that no longer looks
 * like Texas has given up the only thing it was for. Fanning the towns out
 * leaves the state whole and unmagnified and still separates them completely.
 *
 * Positions are not a plain ring. Each town keeps its real bearing from the
 * cluster's centre where it can, so Liberty Hill stays north-west of Leander
 * and the fan still says something true about where these places are. What an
 * even ring guarantees — that no two markers land on top of each other — is
 * kept by spacing the *slots* evenly and then assigning towns to them in
 * bearing order, and rotating the whole fan to sit as close to the real
 * bearings as one rotation can. Order is preserved exactly; angle
 * approximately; overlap impossible.
 */
const SPIDER_RADIUS = 95

function spiderLayout(cluster) {
  const towns = splitByCity(cluster)
  if (towns.length < 2) return towns.map((t) => ({ ...t, anchor: null }))

  const withBearing = towns.map((t) => ({
    town: t,
    bearing: Math.atan2(t.y - cluster.y, t.x - cluster.x),
  }))
  withBearing.sort((a, b) => a.bearing - b.bearing)

  const step = (Math.PI * 2) / withBearing.length

  // The rotation that best matches the real bearings: the circular mean of each
  // town's bearing minus the slot it has been given. Averaging angles through
  // sin/cos rather than arithmetically, because bearings wrap — the mean of
  // 179° and -179° is 180°, not zero.
  let sin = 0
  let cos = 0
  withBearing.forEach((entry, i) => {
    const delta = entry.bearing - i * step
    sin += Math.sin(delta)
    cos += Math.cos(delta)
  })
  const offset = Math.atan2(sin, cos)

  return withBearing.map((entry, i) => {
    const angle = offset + i * step
    return {
      ...entry.town,
      x: cluster.x + Math.cos(angle) * SPIDER_RADIUS,
      y: cluster.y + Math.sin(angle) * SPIDER_RADIUS,
      // Where the leader line comes from, and where the town actually is.
      anchor: { x: cluster.x, y: cluster.y },
    }
  })
}

/**
 * What a marker says when it cannot be seen — the accessible name, and the
 * same sentence the tooltip shows in pieces.
 *
 * Cities are de-duplicated because a cluster is a cluster of *sites*, not of
 * towns: two developments in Leander would otherwise name it twice.
 */
function markerLabel(marker) {
  const towns = [...new Set(marker.items.map((it) => it.city))]
  const names = marker.items.map((it) => it.property.name).join(', ')
  return `${names} — ${towns.join(', ')}. ${marker.available} units available.`
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

export default function TexasMap({ properties, cities = [], density = 'fine', className = '' }) {
  // Keyed on the lowercased city as it appears in a property's own address, so
  // a listing added in a town that isn't in `cities` simply gets no marker
  // rather than an invented one.
  const cityLookup = useMemo(() => cityIndex(cities), [cities])
  const markers = markersFor(properties, cityLookup)
  const dots = DENSITY[density] ?? DENSITY.fine

  // Both the bleeding desktop map and the stacked mobile one are mounted at
  // once, so their defs share a document. SVG references resolve by id against
  // the whole document and take the first match, which means fixed ids would
  // silently hand the second instance the first one's pattern — and the two are
  // deliberately not the same any more.
  const uid = useId().replace(/:/g, '')
  const id = (name) => `${name}-${uid}`

  // Which marker is under the cursor or holding focus, and which side of it the
  // card was placed on. Index rather than the marker object, so the identity
  // check on leave/blur stays cheap and a re-render that rebuilds `markers`
  // cannot strand a stale reference.
  const [active, setActive] = useState(null)

  /**
   * The index of the cluster currently fanned out, if any.
   *
   * Pointer-driven only — never set on focus. Fanning replaces the hovered
   * cluster with the towns inside it, so a keyboard user who focused a cluster
   * would have the element under their focus deleted out from under them.
   * Focus instead opens the card, which already lists every site in the
   * cluster by name, so nothing is withheld from the keyboard; it is only
   * reached a different way.
   */
  const [spider, setSpider] = useState(null)

  // The fanned cluster is swapped for its towns; every other marker is left
  // alone, so a second cluster elsewhere on the map stays clustered.
  const shown = useMemo(
    () =>
      spider === null
        ? markers
        : markers.flatMap((m, i) => (i === spider ? spiderLayout(m) : [m])),
    [markers, spider],
  )

  const open = active === null ? null : shown[active.index]

  /**
   * Opens a marker's card, above it when there is room and below it when there
   * is not.
   *
   * The Austin cluster carries four sites, which is a 339px card — measured —
   * and the footer is the bottom of a long page, so a reader arriving at it
   * routinely has the map's upper half near the top of the window. Anchored
   * upward unconditionally, that card rendered 335px above the viewport: not
   * clipped, simply not on screen.
   *
   * The height is estimated from the row count rather than measured, because
   * measuring means rendering first and a card that places itself on a second
   * frame visibly jumps. The rows are a fixed two lines each, so the estimate
   * only has to survive the font — not arbitrary content.
   */
  const ROW_H = 58
  const CARD_PADDING = 24
  const GAP = 20

  const openMarker = (index, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const needed = shown[index].items.length * ROW_H + CARD_PADDING + GAP
    const below = rect.top < needed && window.innerHeight - rect.bottom > rect.top
    setActive({ index, below })
  }

  // Guarded rather than a bare clear: with two markers close together the
  // pointer can enter the next one before this one reports leaving, and an
  // unguarded clear would close the card that just opened.
  const closeMarker = (index) => setActive((cur) => (cur?.index === index ? null : cur))

  /**
   * Pointing at a cluster fans it out; pointing at a single site just opens its
   * card.
   *
   * The card is deliberately *not* opened for a cluster. A moment later that
   * cluster will not exist — it is about to become three towns — so its card
   * would be a list that flashes up and is immediately replaced by the markers
   * that list was describing. The fan is the answer to the hover; the cards
   * belong to what the fan reveals.
   */
  const enterMarker = (index, event) => {
    if (spider === null && shown[index].items.length > 1) {
      setActive(null)
      setSpider(index)
      return
    }
    openMarker(index, event)
  }

  // Leaving the map as a whole, rather than leaving a marker: between two
  // fanned towns the pointer is over the state but over no marker, and
  // collapsing there would snap the fan shut the instant the reader moved
  // between the two things they were trying to compare.
  const leaveMap = () => {
    setSpider(null)
    setActive(null)
  }

  return (
    // The tooltip is HTML, not SVG <text>: it needs wrapping, a background and
    // real type, all of which SVG makes hard and none of which it makes better.
    // Positioning it in percentages against this wrapper works because the svg
    // below is `w-full h-auto` over a fixed viewBox, so the box and the
    // coordinate system stay in exact proportion at every width.
    <div className={`relative ${className}`}>
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      fill="none"
      // No longer `aria-hidden`. The geography is still decoration, but the
      // markers now carry the portfolio's locations and are focusable, and a
      // focusable element inside an aria-hidden subtree is a thing screen
      // readers are explicitly not allowed to resolve.
      role="group"
      aria-label="Portfolio locations across Texas"
      // `text-bone` belongs on the root, not on the dotted path. `currentColor`
      // inside a <pattern> resolves against the pattern's own inherited colour —
      // which comes from this <svg>, never from the element referencing the
      // pattern as a fill. With the colour set on the path instead, the dots
      // silently inherited the page's body text: near-white under the dark theme
      // and charcoal under the light one, where the whole map all but vanished
      // against the panel. Bone is fixed in both themes, so this is stable.
      className="text-bone h-auto w-full"
      onMouseLeave={leaveMap}
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

      {/* Leader lines, under the markers so a line never crosses a disc. Drawn
          from the cluster's true position out to each fanned town, because that
          position is where these places actually are — without them the fan is
          three markers that have wandered off the map's own geography with
          nothing saying they belong together. */}
      {shown.map((m) =>
        m.anchor ? (
          <line
            key={`leader-${m.items.map((it) => it.city).join('|')}`}
            x1={m.anchor.x}
            y1={m.anchor.y}
            x2={m.x}
            y2={m.y}
            className="stroke-accent-soft/35"
            strokeWidth="1.5"
          />
        ) : null,
      )}

      {/* The cluster's own position, kept as a small fixed point once its towns
          have moved off it. */}
      {shown.some((m) => m.anchor) && (
        <circle
          cx={shown.find((m) => m.anchor).anchor.x}
          cy={shown.find((m) => m.anchor).anchor.y}
          r="3.5"
          className="fill-accent-soft/70"
        />
      )}

      {shown.map((m, i) => {
        // Area, not radius, tracks the count — a radius proportional to units
        // would make a 60-unit site look four times the site it is.
        const r = Math.min(26, 9 + Math.sqrt(m.available) * 1.6)
        const halo = r * 2.1
        const isOpen = active?.index === i
        const mx = m.x
        const my = m.y
        return (
          <g
            // Keyed on the towns it stands for, not on its coordinates: a
            // cluster and the markers it splits into share a position, and a
            // positional key would have React reuse the cluster's node for one
            // of its own children and leave the fade mid-flight.
            key={m.items.map((it) => it.city).join('|')}
            tabIndex={0}
            // Focusable and labelled, but deliberately not `role="button"`:
            // there is nothing to activate, and announcing a button that does
            // nothing on Enter is a worse lie than announcing a plain group.
            // The label carries the whole card in words, so a reader who never
            // sees the tooltip still gets everything it shows.
            aria-label={markerLabel(m)}
            className="texas-marker cursor-pointer outline-none"
            onMouseEnter={(event) => enterMarker(i, event)}
            onMouseLeave={() => closeMarker(i)}
            onFocus={(event) => openMarker(i, event)}
            onBlur={() => closeMarker(i)}
          >
            {/* Hit target. The rings are thin and the halo is nearly
                transparent, so without a solid invisible disc the marker is
                only reliably hoverable on its 6px centre dot. */}
            <circle cx={mx} cy={my} r={Math.max(halo, 34)} fill="transparent" />
            <circle
              cx={mx}
              cy={my}
              r={halo}
              className={
                'transition-[fill] duration-300 ' + (isOpen ? 'fill-accent-soft/28' : 'fill-accent-soft/12')
              }
            />
            <circle
              cx={mx}
              cy={my}
              r={r}
              strokeWidth="2"
              className={
                'transition-[fill,stroke] duration-300 ' +
                (isOpen ? 'fill-accent-soft/45 stroke-accent-soft' : 'fill-accent-soft/25 stroke-accent-soft/70')
              }
            />
            <circle cx={mx} cy={my} r={r * 0.34} className="fill-bone" />
          </g>
        )
      })}
    </svg>

    {open && (
      <div
        // `pointer-events-none` so the card can never sit between the cursor
        // and the marker that opened it — which would flicker it shut and back
        // open as the pointer crossed the boundary.
        role="tooltip"
        className="pointer-events-none absolute z-20 w-max max-w-[16rem]"
        style={{
          left: `${(open.x / WIDTH) * 100}%`,
          top: `${(open.y / HEIGHT) * 100}%`,
          // Clear of the marker's outer halo on whichever side it was placed —
          // see `openMarker`. The horizontal shift slides toward the middle for
          // markers near an edge: this map bleeds off the panel's right side on
          // desktop, so a centred card on an eastern marker would be cut in
          // half by the viewport.
          transform: `translate(${
            open.x / WIDTH > 0.62 ? '-85%' : open.x / WIDTH < 0.28 ? '-15%' : '-50%'
          }, ${active.below ? '1.75rem' : 'calc(-100% - 1.25rem)'})`,
        }}
      >
        <div className="rounded-xl bg-void/90 px-4 py-3 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/15 backdrop-blur-md">
          {/* Two lines a site, not three. The Austin cluster holds four of
              them, and at three lines each the card came to 339px — more than
              half the height of a 620px window, which no amount of flipping
              could keep on screen. Town and figures share a line instead. */}
          {open.items.map(({ property, city }) => (
            <div
              key={property.slug ?? property.name}
              className="not-first:mt-2.5 not-first:border-t not-first:border-white/10 not-first:pt-2.5"
            >
              <p className="font-display text-[13.5px] font-bold leading-tight text-bone">{property.name}</p>
              <p className="mt-1 font-body text-[11px] leading-snug text-bone-3">
                <span className="text-accent-soft">{city}</span>
                {[
                  property.buildings && `${property.buildings} buildings`,
                  property.available && `${property.available} available`,
                ]
                  .filter(Boolean)
                  .map((bit) => ` · ${bit}`)
                  .join('')}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}
    </div>
  )
}
