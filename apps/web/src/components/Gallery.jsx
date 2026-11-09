import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useSection, useListings } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized, srcSetFor } from '../lib/images'
import ArrowRight from './ArrowRight'
import { coverImage } from '../lib/covers'
import { useParallax } from '../hooks/useParallax'
import { useGSAP } from '@gsap/react'
import { dealCards } from '../lib/reveal'

// Four frames in the mosaic — one under the copy, two stacked in the middle,
// one down the right. A fifth has nowhere to go without breaking the column
// rhythm the comp is built on.
const TILES = 4
const MOBILE_ROTATE_MS = 4800

/**
 * The portfolio at a glance: three columns of real property photographs with
 * the section's own copy at the head of the first one.
 *
 * Built as three flex columns inside a fixed-height grid, not as a grid of
 * placed cells. The comp's whole trick is that the three columns end level with
 * each other while holding different things — copy plus one tall frame, two
 * half-height frames, one frame plus a button. Row placement cannot express
 * that: it needs every cell to agree on a row height none of them share. Given
 * a height, `flex-1` divides whatever is left inside each column and the three
 * feet land on the same line by construction.
 */
function MobileGallery({ tiles, heading, paragraph, go }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (tiles.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setTimeout(() => setActive((current) => (current + 1) % tiles.length), MOBILE_ROTATE_MS)
    return () => window.clearTimeout(id)
  }, [active, tiles.length])

  const property = tiles[active]
  if (!property) return null

  return (
    <div className="md:hidden">
      <div className="mb-6">
        <h2
          className="text-balance font-display font-bold leading-[1.1] tracking-[-0.02em] text-content"
          style={{ fontSize: 'clamp(1.6rem, 8vw, 2.4rem)' }}
        >
          {renderEmphasis(heading, 'text-ember')}
        </h2>
        {paragraph && (
          <p className="mt-4 max-w-[46ch] font-body text-[14px] leading-[1.7] text-content/55">
            {paragraph}
          </p>
        )}
      </div>

      <div className="relative overflow-hidden rounded-panel bg-surface-alt">
        <AnimatePresence initial={false} mode="wait">
          <motion.a
            key={property.slug}
            href={`/properties/${property.slug}`}
            onClick={go(`/properties/${property.slug}`)}
            initial={{ opacity: 0, scale: 1.025 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="group relative block aspect-[1.18] overflow-hidden outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`View ${property.name}`}
          >
            <img
              src={sized(coverImage(property, 'mosaic'), 'card')}
              // Empty on purpose: the link is named "View <property>" and the
              // caption below says the name again, so a description here would
              // only make a screen reader say it a third time.
              alt=""
              // This branch is `md:hidden` — it only ever renders on a phone,
              // where the frame is the full column. One breakpoint, one width.
              srcSet={srcSetFor(coverImage(property, 'mosaic'), 'card')}
              sizes="100vw"
              loading={active === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.035]"
            />
            {/* The scrim, and it has to actually reach the text.
                `h-24 from-void/85 via-void/8` put its midpoint — 48px up, which
                is where the name sits — at 8% opacity, so the caption was
                bright white type laid on whatever the photograph happened to
                be. On a dusk shot it read; on POW Lewisville's daylight
                concrete it disappeared.

                Taller, and the fade held back to 58% so the whole caption
                block (two lines plus `p-5`, about 84px) sits on 60% or more
                before the gradient is allowed to open up. */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-void/92 via-void/62 via-58% to-transparent"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-bone">
              <span className="min-w-0">
                <span className="block truncate font-display text-[1.15rem] font-bold leading-tight">{property.name}</span>
                {property.address && <span className="mt-1 block truncate font-body text-[12px] text-bone/70">{property.address}</span>}
              </span>
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bone text-void transition-transform duration-300 ease-brand group-hover:-rotate-45">
                <ArrowRight className="size-4 -rotate-45" />
              </span>
            </span>
            <span className="absolute right-4 top-4 rounded-full bg-void/55 px-2.5 py-1 font-body text-[10px] font-bold tracking-[0.12em] text-bone backdrop-blur-sm">
              {String(active + 1).padStart(2, '0')} / {String(tiles.length).padStart(2, '0')}
            </span>
          </motion.a>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose a property">
          {tiles.map((item, index) => (
            <button
              key={item.slug}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-label={`Show ${item.name}`}
              onClick={() => setActive(index)}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active === index ? 'w-7 bg-accent' : 'w-1.5 bg-content/25'
              }`}
            />
          ))}
        </div>
        <span className="whitespace-nowrap font-body text-[10px] font-bold uppercase tracking-[0.12em] text-content/45">
          Tap to explore
        </span>
      </div>
    </div>
  )
}
export default function Gallery() {
  const { heading, paragraph, ctaLabel } = useSection('gallery')
  const properties = useListings()
  const navigate = useNavigate()

  const tiles = properties.filter((p) => coverImage(p, 'mosaic')).slice(0, TILES)

  // Above the early return — a hook skipped on the render where the CMS has
  // sent nothing yet and run on the render after is a hook order violation,
  // and this section genuinely starts empty. Keyed to the tile count for the
  // reason Properties and Services key their card tweens: the photographs
  // arrive after mount, so layers built on the first pass are built over
  // nothing and never run again.
  const scope = useRef(null)
  useParallax(scope, [tiles.length])
  // The frames deal in one after the other; the photographs keep drifting
  // inside them. Only the frames move here, never the parallax layers.
  useGSAP(
    () => {
      const deal = dealCards(scope.current?.querySelectorAll('[data-gallery-tile]'), { y: 48 })
      return () => deal?.kill()
    },
    { scope, dependencies: [tiles.length], revertOnUpdate: true }
  )

  if (tiles.length === 0) return null


  const go = (to) => (e) => {
    e.preventDefault()
    navigate(to)
  }

  // One frame. `flex-1` inside its column, with a floor for the phone layout
  // where the columns have unstacked and there is no shared height left to
  // divide — `flex-1` of nothing is nothing, and the photographs would vanish.
  const Tile = ({ p, drift = 0.12 }) =>
    p ? (
      <a
        data-gallery-tile
        href={`/properties/${p.slug}`}
        onClick={go(`/properties/${p.slug}`)}
        className="group relative block min-h-56 flex-1 overflow-hidden rounded-panel bg-surface-alt outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0"
      >
        {/* The photograph drifts inside its frame; the frame does not move.
            The composition above is three columns of different contents built
            to end level with each other, and drifting the columns themselves
            would pull the one thing it is constructed to hold. Depth has to
            come from behind the frame edge instead — which is the better read
            anyway: the mosaic becomes four windows onto something moving
            rather than four pictures sliding about.

            The overscan sets the ceiling on how far this can travel, and it is
            the only thing that does. The layer is 150% of the frame and pulled
            up 25%, leaving 25% of headroom at each edge; a drift of d moves it
            d x 75% of the frame height, so anything up to 0.33 stays inside
            the frame and never shows its own ground. The drifts below sit under
            that with room to spare.

            It was 118% and a 0.07-0.14 drift, which worked out to about 50px of
            travel across a 1400px scroll pass — a 3% differential, well under
            what the eye reads as depth at all. The effect was running the whole
            time and was simply too small to see. */}
        <span aria-hidden data-parallax={drift} className="absolute inset-x-0 -top-[25%] block h-[150%]">
          <img
            src={sized(coverImage(p, 'mosaic'), 'card')}
            // Empty on purpose: the caption below names the link (it is only
            // hidden visually until hover), so the photograph is decoration.
            alt=""
            // The mosaic counterpart, which is `md:` and up: two columns inside
            // the content measure, so roughly half the viewport apiece.
            srcSet={srcSetFor(coverImage(p, 'mosaic'), 'card')}
            sizes="(min-width: 768px) 50vw, 100vw"
            loading="lazy"
            decoding="async"
            // The hover scale stays on the image and the drift sits on the
            // wrapper above it. Both on one element and they fight: GSAP writes
            // an inline transform, and an inline transform beats the utility
            // class outright, so the photograph would stop responding to hover
            // the moment it first scrolled.
            className="size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
          />
        </span>
        {/* The name arrives on hover or focus only. At rest the mosaic is
            photographs; a permanent caption on all four turns it back into a
            list of cards. */}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void/85 to-void/0 p-5 pt-12 font-display text-[15px] font-bold text-bone opacity-0 transition-opacity duration-400 ease-brand group-hover:opacity-100 group-focus-visible:opacity-100">
          {p.name}
        </span>
      </a>
    ) : null

  return (
    <section
      data-section-reveal="off"
      id="gallery"
      ref={scope}
      data-band="light"
      className="bg-base px-gutter py-section text-content md:py-section-lg"
    >
      {/* The height is the composition. 43vw is the comp's own proportion —
          590px of content across a 1360px window — clamped so it neither
          collapses on a small laptop nor grows into a whole screen of
          photographs on a wide monitor. Below `md` it is dropped entirely and
          the columns stack at their natural heights. */}
      <div className="mx-auto max-w-[1560px]">
        <MobileGallery tiles={tiles} heading={heading} paragraph={paragraph} go={go} />

        <div className="hidden gap-4 md:grid md:h-[clamp(30rem,43vw,44rem)] md:grid-cols-3">
        {/* ── column one — the copy, then one tall frame ─────────── */}
        <div className="flex flex-col gap-4">
          <div className="md:pr-4">
            <h2
              className="text-balance font-display font-bold leading-[1.1] tracking-[-0.02em] text-content"
              // Smaller than the other section headings on the page, because
              // this one lives in a third of the measure rather than across it.
              // At the old 3.1vw "Explore Our Properties" took three lines in
              // its column and pushed the frame below it out of register with
              // the other two.
              style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.4rem)' }}
            >
              {renderEmphasis(heading, 'text-ember')}
            </h2>
            {paragraph && (
              <p className="mt-4 max-w-[46ch] font-body text-[14px] leading-[1.7] text-content/55">
                {paragraph}
              </p>
            )}
          </div>
          <Tile p={tiles[0]} drift={0.22} />
        </div>

        {/* ── column two — two frames, evenly split ──────────────── */}
        <div className="flex flex-col gap-4">
          {/* Four speeds rather than one. Moving together they read as a
              single sheet behind four holes; a little apart, each frame reads
              as its own window at its own distance. */}
          <Tile p={tiles[1]} drift={0.3} />
          <Tile p={tiles[2]} drift={0.15} />
        </div>

        {/* ── column three — one frame, and the way out ──────────── */}
        <div className="flex flex-col gap-4">
          <Tile p={tiles[3]} drift={0.26} />
          {/* Full column width and a real slab of height, as drawn. This is the
              section's only action and the last thing in its reading order, so
              it is sized to be what you land on rather than a link tucked under
              a corner. `shrink-0` keeps the frame above from squeezing it. */}
          <a
            href="/properties"
            onClick={go('/properties')}
            className="flex min-h-16 shrink-0 items-center justify-center rounded-full border border-content/25 px-6 text-center font-body text-[15px] font-medium uppercase tracking-[0.08em] text-content outline-none transition-[background-color,border-color,color] duration-300 ease-brand hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-20"
          >
            {ctaLabel || 'See more projects'}
          </a>
        </div>
        </div>
      </div>
    </section>
  )
}
