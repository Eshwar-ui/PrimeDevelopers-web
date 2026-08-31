import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { citiesFor } from '../lib/texas'
import { centreOf, fitZoom, lonLatToWorld } from '../lib/webMercator'
import StreetMap from './StreetMap'
import { sized } from '../lib/images'

/**
 * The properties fold: clean paper at the top, a real map developing out of it
 * as the eye travels down, and the portfolio pinned across the bottom of the
 * screen.
 *
 * The vertical fade is the composition, not a finishing touch. The headline
 * sits on white so the copy is never fighting a background for contrast, and
 * the map is at full strength exactly where the reader ends up looking. A map
 * at even opacity behind everything is a different, worse picture: the
 * headline sits on texture and the pins sit on nothing in particular.
 *
 * ── Where the map comes from ────────────────────────────────────────────────
 *
 * `StreetMap` — drawn in SVG, in this repo, from a fixed seed. There is no tile
 * service behind this fold and no mapping library in the bundle: no API key to
 * hold, no third-party request from a visitor's browser, no rate limit, nothing
 * to go down, and no attribution obligation on the page.
 *
 * What is real here is the arrangement. `lib/webMercator` is still the
 * projection, and it still places every pin, so the portfolio's shape across
 * Texas — which town is north of which, how far apart they sit — is true, and
 * the zoom still fits itself to however far the listings actually spread. The
 * streets underneath are texture; the pins standing on top of it are the
 * facts.
 */

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

// Where the map has developed to full strength. Above the first stop it is not
// there at all, which is what keeps the headline on clean paper.
const FADE =
  'linear-gradient(to bottom, transparent 0%, transparent 14%, rgba(0,0,0,0.25) 38%, rgba(0,0,0,0.7) 57%, #000 74%)'

export default function PropertiesMapHero({ properties, onOpen, children }) {
  const cities = useMemo(() => citiesFor(properties), [properties])

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

  /**
   * The framing: one zoom that fits every town the portfolio is in, and the
   * world-pixel corner the box's top-left sits at.
   *
   * Framed once, on the markers' own bounds, so every town stays visible.
   *
   * Vertical padding is generous because the fade eats the top of the box: a
   * marker placed in the first third would sit on map that has not arrived yet.
   */
  const view = useMemo(() => {
    if (!size || !cities.length) return null

    const points = cities.map((c) => c.coords)

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
      // leaves no room to read the pins — the fold degrades into a grey
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
    >
      {/* The measured box. Both layers below are laid out against it, so the
          map and the pins are working from one set of numbers. */}
      <div ref={boxRef} className="absolute inset-0 -z-10">
        {/* ── The ground, developing downward ─────────────────── */}
        {/* Masked as a layer of its own, and the pins are a second layer over
            the top. Putting the fade on a shared parent would take the
            photographs down with it — the map is what dissolves into the page,
            not the portfolio standing on it. */}
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
              const photo = c.properties.find((p) => p.image)?.image
              const count = c.properties.length

              return (
                <button
                  key={c.key}
                  type="button"
                  // Back in the flow: the layer is inert so the map never eats a
                  // click meant for the copy, but the pins themselves are the
                  // one thing on it worth touching.
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 outline-none transition-transform duration-500 ease-brand hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base motion-reduce:transform-none"
                  style={{ left: at[0], top: at[1] }}
                  onClick={() => onOpen?.(c.properties[0])}
                  aria-label={`${c.label} — ${count} ${count === 1 ? 'property' : 'properties'}`}
                >
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
                  {/* A small badge rather than swapping the thumbnail out — the
                      photo is what makes a pin recognisable at a glance, and a
                      count only needs to add to that, not replace it. */}
                  {count > 1 && (
                    <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-charcoal font-body text-[11px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.7)]">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
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
