import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
import ArrowRight from './ArrowRight'

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
              src={sized(property.image, 'card')}
              alt={property.name}
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
  const properties = useProperties()
  const navigate = useNavigate()

  const tiles = properties.filter((p) => p.image).slice(0, TILES)
  if (tiles.length === 0) return null

  const go = (to) => (e) => {
    e.preventDefault()
    navigate(to)
  }

  // One frame. `flex-1` inside its column, with a floor for the phone layout
  // where the columns have unstacked and there is no shared height left to
  // divide — `flex-1` of nothing is nothing, and the photographs would vanish.
  const Tile = ({ p }) =>
    p ? (
      <a
        href={`/properties/${p.slug}`}
        onClick={go(`/properties/${p.slug}`)}
        className="group relative block min-h-56 flex-1 overflow-hidden rounded-panel bg-surface-alt outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0"
      >
        <img
          src={sized(p.image, 'card')}
          alt={p.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
        />
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
      id="gallery"
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
          <Tile p={tiles[0]} />
        </div>

        {/* ── column two — two frames, evenly split ──────────────── */}
        <div className="flex flex-col gap-4">
          <Tile p={tiles[1]} />
          <Tile p={tiles[2]} />
        </div>

        {/* ── column three — one frame, and the way out ──────────── */}
        <div className="flex flex-col gap-4">
          <Tile p={tiles[3]} />
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
