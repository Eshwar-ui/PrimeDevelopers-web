import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { citiesFor } from '../lib/texas'
import { useSection } from '../context/ContentContext'
import { centreOf, fitZoom, lonLatToWorld } from '../lib/webMercator'
import StreetMap from './StreetMap'
import { sized } from '../lib/images'

/**
 * The properties fold: clean paper at the top, a real map developing out of it
 * as the eye travels down, and the portfolio pinned across the bottom of the
 * screen with one listing raised out of it on a card.
 *
 * The vertical fade is the composition, not a finishing touch. The reference
 * this follows puts its headline on white and lets the map arrive toward the
 * bottom of the fold — so the copy is never fighting a background for contrast,
 * and the map is at full strength exactly where the reader ends up looking. A
 * map at even opacity behind everything is a different, worse picture: the
 * headline sits on texture and the pins sit on nothing in particular.
 *
 * ── Where the map comes from ────────────────────────────────────────────────
 *
 * `StreetMap` — drawn in SVG, in this repo, from a fixed seed. There is no tile
 * service behind this fold and no mapping library in the bundle: no API key to
 * hold, no third-party request from a visitor's browser, no rate limit, nothing
 * to go down, and no attribution obligation on the page. An earlier pass did
 * fetch real Positron tiles, and the honest reckoning was that it bought very
 * little — the map cannot be dragged, zoomed or clicked, so almost nothing that
 * makes real tiles real was reachable — in exchange for a hard runtime
 * dependency on someone else's CDN.
 *
 * What is real here is the arrangement. `lib/webMercator` is still the
 * projection, and it still places every pin, so the portfolio's shape across
 * Texas — which town is north of which, how far apart they sit — is true, and
 * the zoom still fits itself to however far the listings actually spread. The
 * streets underneath are texture; the pins and the card standing on them are
 * the facts.
 */

// How long a city holds the card before the map moves on. Long enough to read
// the name, the address and the specs without feeling parked.
const DWELL = 4600

/**
 * The strip of the fold the markers are allowed to occupy.
 *
 * This is the geometry the whole hero turns on, so it is worth being explicit.
 * Two things compete for one column of pixels: the copy at the top, and the pin
 * band under it — and the zoom follows from how much room the band gets, because
 * `fitZoom` is asked to fit every town into exactly that space. Fit to the full
 * height and then nudge the result downward, which is the obvious first move,
 * and the southern half of the portfolio ends up below the fold: the fit was
 * computed against a box the markers were then pushed out of.
 *
 * The band's ceiling is measured, not guessed. An earlier pass put it at a fixed
 * fraction of the height, which has to be pessimistic enough for the longest
 * headline on the shortest laptop — and paying that everywhere squeezed the band
 * hard enough to drive the map out to zoom 4, which is most of North America.
 * Reading where the copy actually ends buys back the difference, and adapts on
 * its own when the CMS copy changes length.
 */
const COPY_CLEARANCE = 44
const BAND_FLOOR = 64

// The card, for the arithmetic that decides which side of its pin it hangs on.
// Stated rather than measured because it is fixed by this file — the width is a
// utility class and the height follows from the thumbnail plus three lines.
const CARD_H = 210
const CARD_GAP = 26

// Where the map has developed to full strength. Above the first stop it is not
// there at all, which is what keeps the headline on clean paper.
const FADE =
  'linear-gradient(to bottom, transparent 0%, transparent 14%, rgba(0,0,0,0.25) 38%, rgba(0,0,0,0.7) 57%, #000 74%)'

/**
 * The marker over the raised card, carrying the town's count.
 *
 * The point sits on top when there is a card hanging beneath it and underneath
 * when there is not — a tail pointing at nothing is worse than no tail.
 */
function CountPin({ count, up }) {
  return (
    <span className="relative flex size-11 items-center justify-center rounded-full bg-charcoal font-body text-[15px] font-bold text-white shadow-[0_10px_22px_-8px_rgba(0,0,0,0.7)]">
      {count}
      {/* A rotated square tucked behind the disc reads as one shape with it; a
          triangle drawn separately shows its seam on retina. */}
      <span
        className={`absolute size-3 rotate-45 rounded-[2px] bg-charcoal ${up ? '-top-1' : '-bottom-1'}`}
      />
    </span>
  )
}

export default function PropertiesMapHero({ properties, onOpen, children }) {
  const reduced = useReducedMotion()
  // Same city table the footer map reads, so the two never disagree about
  // where a town is or whether it exists at all.
  const { cities: cityTable } = useSection('texas_map')
  const cities = useMemo(() => citiesFor(properties, cityTable), [properties, cityTable])

  // The map is sized from the box it is in rather than from the viewport: the
  // section has padding, and a hero on a phone in landscape is a different
  // shape from the same hero on a desktop. Nothing is placed until the box has
  // been measured, because pins laid out against a guessed width would visibly
  // jump on the first frame.
  const boxRef = useRef(null)
  const copyRef = useRef(null)
  const [size, setSize] = useState(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const copy = copyRef.current
    if (!box || !copy) return

    const measure = () => {
      const b = box.getBoundingClientRect()
      const c = copy.getBoundingClientRect()

      // Rounded, and bailing when nothing moved, so a sub-pixel resize does not
      // re-run the projection to arrive at the same answer.
      setSize((prev) => {
        const next = {
          width: Math.round(b.width),
          height: Math.round(b.height),
          copyBottom: Math.round(c.bottom - b.top),
        }
        return prev &&
          prev.width === next.width &&
          prev.height === next.height &&
          prev.copyBottom === next.copyBottom
          ? prev
          : next
      })
    }

    // Both, because either can change without the other: the section grows with
    // the window, and the copy grows when a webfont lands or a heading rewraps.
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    observer.observe(copy)
    return () => observer.disconnect()
  }, [])

  const [held, setHeld] = useState(false)
  // The key of the city holding the card, or null to mean "whatever the cycle
  // is on". A key rather than an index because the list it indexes into changes
  // with the viewport, and an index into a list that resized points at a
  // different town.
  const [picked, setPicked] = useState(null)
  const [tick, setTick] = useState(0)

  /**
   * The framing: one zoom that fits every town the portfolio is in, and the
   * world-pixel corner the box's top-left sits at.
   *
   * The map does not pan between cities. An earlier pass re-centred it on
   * whichever city held the card, which slid the entire state under the reader
   * every few seconds and took half the pins off screen on each move. Framed
   * once, on the markers' own bounds, every town stays visible — the card
   * moves, the ground does not.
   *
   * Vertical padding is generous because the fade eats the top of the box: a
   * marker placed in the first third would sit on map that has not arrived yet.
   */
  const view = useMemo(() => {
    if (!size || !cities.length) return null

    const points = cities.map((c) => c.coords)

    // The band, in pixels: everything between the bottom of the copy and a
    // short margin above the fold's edge. It gets all of it — the card is
    // placed around whichever pin is active rather than reserved for up front,
    // because reserving a card's height under every pin is what starved the
    // band in the first place.
    const top = size.copyBottom + COPY_CLEARANCE
    const bottom = Math.max(top + 90, size.height - BAND_FLOOR)

    const zoom = fitZoom(points, size.width, bottom - top, {
      padX: Math.min(150, size.width * 0.12),
      // Half a pin, so a marker at the very top of the band is not sitting with
      // its upper edge in the copy.
      padY: 40,
    })
    const [cx, cy] = centreOf(points, zoom)

    return {
      zoom,
      // The markers' own centre is placed at the band's centre, so the fit that
      // was just computed is the fit the reader actually gets.
      origin: [cx - size.width / 2, cy - (top + bottom) / 2],
    }
  }, [size, cities])

  // Screen position of a city inside the box, from the same projection that
  // frames the fold.
  const positionOf = useCallback(
    (coords) => {
      if (!view) return null
      const [x, y] = lonLatToWorld(coords, view.zoom)
      return [x - view.origin[0], y - view.origin[1]]
    },
    [view],
  )

  /**
   * Where each city's card would go, or nothing if it has nowhere to go.
   *
   * Below the pin is the default and reads best — the pin is what the eye finds
   * first, and the card unfolds downward from it. A pin low enough that a card
   * beneath it would run off the fold gets its card above instead, which is the
   * reference's own arrangement. On a short window the copy and the bottom edge
   * can be less than two card-heights apart, and then a town has no honest slot
   * at all: the card is dropped rather than laid over the headline.
   */
  const slots = useMemo(() => {
    const found = new Map()
    if (!view || !size) return found

    for (const c of cities) {
      const y = positionOf(c.coords)[1]

      const below = y + CARD_GAP
      if (below + CARD_H <= size.height - 12) {
        found.set(c.key, { top: below, tailUp: true })
        continue
      }

      const above = y - CARD_GAP - CARD_H
      if (above >= size.copyBottom + 8) found.set(c.key, { top: above, tailUp: false })
    }

    return found
  }, [cities, view, size, positionOf])

  /**
   * The cities the cycle actually visits.
   *
   * Only the ones that can hold a card, because a cycle that walked every town
   * would make the card blink in and out as it passed the ones that cannot —
   * which reads as a fault, not as a design. Every town is still pinned and
   * still clickable; the tour just does not stop at the ones with nothing to
   * show. If no town can hold a card, the tour is the full list and the fold is
   * pins alone.
   */
  const tour = useMemo(() => {
    const withSlots = cities.filter((c) => slots.has(c.key))
    return withSlots.length ? withSlots : cities
  }, [cities, slots])

  const active =
    (picked && cities.find((c) => c.key === picked)) ||
    (tour.length ? tour[tick % tour.length] : null)

  useEffect(() => {
    // Reduced motion, a reader hovering or tabbing the pins, and a town they
    // picked themselves are all reasons for the card to hold still.
    if (reduced || held || picked || tour.length < 2) return
    const timer = setInterval(() => setTick((t) => t + 1), DWELL)
    return () => clearInterval(timer)
  }, [reduced, held, picked, tour.length])

  const focus = active && view ? positionOf(active.coords) : null
  const card = active ? slots.get(active.key) : null
  const featured = card ? active.properties[0] : null

  return (
    <section
      id="properties-hero"
      data-band="light"
      // A floor, not a fixed height. `h-dvh` with a max clamp is safe only while
      // the fold's contents are shorter than the shortest laptop, and
      // `overflow-hidden` is here to crop the map — anything that outgrew the
      // box would be cropped along with it. A minimum can only ever grow the
      // section.
      //
      // The bottom padding is small on purpose now that the copy sits at the
      // top of its box: everything below the last line of type is the map's, and
      // the band's own floor keeps the pins off the edge.
      //
      // The `max()` is the important half. Tracking the viewport alone means a
      // 1366×768 laptop gives the band about 150px once the copy has had its
      // share, which drives the zoom out to the scale of several states and
      // leaves no room to hang a card off a pin — the fold degrades into a grey
      // smudge on exactly the machines most people are using. Holding a floor of
      // 58rem costs those readers a short scroll and keeps the composition
      // intact; the copy and its buttons are still above the fold either way.
      // Ground, gutter and ink are the homepage's, not this page's own: every
      // section on the landing page is `bg-base px-gutter text-content`, and
      // this hero was the one place still standing on `bg-surface` behind a
      // hand-set `px-6`. In light mode the two grounds are the same white, so
      // the difference only showed in dark — where `surface` is a raised panel
      // colour and the rest of the site's document ground is two steps below it,
      // making this page read as a card floating on top of the site.
      className="relative isolate flex min-h-[38rem] flex-col overflow-hidden bg-base px-gutter pb-16 pt-32 text-content md:px-gutter-lg md:pt-36 lg:min-h-[max(58rem,min(100dvh,64rem))]"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      {/* The measured box. Both layers below are laid out against it, so the
          map and the pins are working from one set of numbers. */}
      <div ref={boxRef} className="absolute inset-0 -z-10">
        {/* ── The ground, developing downward ─────────────────── */}
        {/* Masked as a layer of its own, and the pins are a second layer over
            the top. Putting the fade on a shared parent would take the
            photographs and the card down with it — the map is what dissolves
            into the page, not the portfolio standing on it. */}
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden"
          style={{ maskImage: FADE, WebkitMaskImage: FADE }}
        >
          {/* Held back off full strength. The drawing is already pale, but it is
              still a street network: at full contrast it competes with the pins,
              which are the only thing on this fold anyone needs to read. */}
          <StreetMap className="absolute inset-0 size-full opacity-85 dark:opacity-70" />
        </div>

        {/* ── The portfolio, standing on it ────────────────────── */}
        <div className="pointer-events-none absolute inset-0">
          {view &&
            cities.map((c) => {
              const at = positionOf(c.coords)
              const isActive = c.key === active?.key
              const photo = c.properties.find((p) => p.image)?.image

              return (
                <button
                  key={c.key}
                  type="button"
                  // Back in the flow: the layer is inert so the map never eats a
                  // click meant for the copy, but the pins themselves are the
                  // one thing on it worth touching.
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-transform duration-500 ease-brand hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base motion-reduce:transform-none"
                  style={{ left: at[0], top: at[1] }}
                  // Picking a town stops the tour on it — a reader who chose
                  // Georgetown should not be moved off it four seconds later.
                  // Picking it again hands the fold back to the cycle.
                  onClick={() => setPicked((k) => (k === c.key ? null : c.key))}
                  onFocus={() => setHeld(true)}
                  onBlur={() => setHeld(false)}
                  aria-label={`${c.label} — ${c.properties.length} ${
                    c.properties.length === 1 ? 'property' : 'properties'
                  }`}
                >
                  {isActive ? (
                    <CountPin count={c.properties.length} up={card?.tailUp ?? false} />
                  ) : (
                    <span className="block size-13 overflow-hidden rounded-full border-2 border-surface bg-surface-alt shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)] md:size-15">
                      {photo && (
                        <img
                          src={sized(photo, 'thumb')}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                  )}
                </button>
              )
            })}

          {/* The raised listing, clear of its pin so the teardrop reads as the
              card's own point.

              Desktop only: at phone width a card floated over the map would
              cover the map, and the grid it previews is one scroll away. */}
          {featured && (
            <motion.button
              key={featured.slug}
              type="button"
              initial={reduced ? false : { opacity: 0, y: card.tailUp ? -12 : 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onOpen?.(featured)}
              // `rounded-panel` and the accent hairline, both from the homepage
              // cards. The hairline earns its place twice over here: it is the
              // house style for a card, and this one is a light panel standing
              // on a light map, which is exactly the case a `--color-line` grey
              // is too quiet to separate.
              className="pointer-events-auto absolute hidden w-60 -translate-x-1/2 cursor-pointer overflow-hidden rounded-panel border border-accent/45 bg-surface p-2 text-left shadow-[0_30px_64px_-28px_rgba(0,0,0,0.5)] outline-none transition-[border-color] duration-500 ease-brand hover:border-accent/75 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base md:block"
              // Placed in pixels rather than by transform: `card.top` is the
              // result of an arithmetic that already knows about the fold's
              // edges, and a percentage offset would throw that away.
              style={{ left: focus[0], top: card.top }}
              aria-label={`Open ${featured.name}`}
            >
              <span className="block h-28 overflow-hidden rounded-xl bg-surface-alt">
                {featured.image && (
                  <img
                    src={sized(featured.image, 'thumb')}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                )}
              </span>
              <span className="block px-2 pb-1 pt-3">
                <span className="block truncate font-display text-[1.05rem] font-bold leading-tight tracking-[-0.01em] text-content">
                  {featured.name}
                </span>
                <span className="mt-1 block truncate font-body text-[13px] text-accent">
                  {featured.address}
                </span>
                <span className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-2.5 font-body text-[12px] text-content/60">
                  <span className="truncate">{featured.category}</span>
                  {Number(featured.available) > 0 && (
                    <span className="shrink-0 font-medium text-content/75">
                      {featured.available} available
                    </span>
                  )}
                </span>
              </span>
            </motion.button>
          )}
        </div>
      </div>

      {/* ── The copy ───────────────────────────────────────────── */}
      {/* `justify-start` rather than centred, and the ref is on the copy itself
          rather than this box: what the band needs to know is where the last
          line of type actually is, and a centred box reports the same bottom
          edge whether it holds two lines or six. Sitting the copy at the top of
          the available space also gives the map the maximum run underneath it,
          which is what the zoom is computed from. */}
      <div className="relative flex flex-1 flex-col justify-start">
        {/* The same 1560px measure every homepage section sets. It does nothing
            at ordinary widths — the copy inside is narrower than this — but it
            stops the hero from being the one band on the site that keeps
            spreading on an ultrawide display. */}
        <div ref={copyRef} className="mx-auto w-full max-w-[1560px]">
          {children}
        </div>
      </div>
    </section>
  )
}
