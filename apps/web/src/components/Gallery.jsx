import { useNavigate } from 'react-router-dom'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'

// Four frames in the mosaic — one under the copy, two stacked in the middle,
// one down the right. A fifth has nowhere to go without breaking the column
// rhythm the comp is built on.
const TILES = 4

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
      className="bg-base px-gutter py-20 text-content md:px-gutter-lg md:py-28"
    >
      {/* The height is the composition. 43vw is the comp's own proportion —
          590px of content across a 1360px window — clamped so it neither
          collapses on a small laptop nor grows into a whole screen of
          photographs on a wide monitor. Below `md` it is dropped entirely and
          the columns stack at their natural heights. */}
      <div className="mx-auto grid max-w-[1560px] gap-4 md:h-[clamp(30rem,43vw,44rem)] md:grid-cols-3">
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
    </section>
  )
}
