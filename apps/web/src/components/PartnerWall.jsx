import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import { useFirstMatchingQuery } from '../hooks/useMediaQuery'

/**
 * The partner wall — every mark at once, as full-width rows.
 *
 * Four rows is the shape this is designed at, but it is a preference rather
 * than a constant: the roster is CMS-driven and only ever grows, so the wall
 * has to stay legible at two marks and at fifty. What is fixed is the *cell* —
 * how small and how large a panel is allowed to get — and the row count moves
 * to respect it. Inside the range the client will realistically upload, that
 * lands on four rows every time.
 */
const PREFERRED_ROWS = 4

/**
 * How many marks may share a row, per breakpoint. First match wins, so these
 * run widest-first.
 *
 * `min` and `max` are the two failure modes, and both are real. Above `max` the
 * panels fall below the size at which a logo is still a logo rather than a
 * smudge — five to a row is already the floor on a 1024 window. Below `min`, a
 * short roster dealt into four rows leaves one mark per row blown up to a
 * third of the viewport, which reads as a hero image, not a partner wall.
 *
 * Adding a tier is one row here; nothing else in the component knows about
 * breakpoints.
 */
const TIERS = [
  { query: '(min-width: 1280px)', min: 3, max: 6 },
  { query: '(min-width: 768px)', min: 3, max: 4 },
  // Phone. Three to a row is ~110px a panel on a 390 screen, so this tier is
  // pinned at two and spends height instead — the one dimension a phone has.
  { query: null, min: 2, max: 2 },
]

const TIER_QUERIES = TIERS.map((tier) => tier.query ?? 'all')

// A hard ceiling on a single panel, for the case the tier bounds cannot reach:
// two logos at `xl` is one row of two, and two 700px panels is a billboard.
// Rows centre, so the leftover width falls away either side.
const MAX_CELL = '20rem'

/**
 * Chooses a row count for `count` marks within a tier's bounds.
 *
 * Starts from the preferred shape and only moves when a bound is breached —
 * too many per row and it adds rows, too few and it takes them away. Returning
 * the row count rather than the column count is deliberate: rows are what the
 * layout is built on, and deriving them here keeps that decision in one place
 * instead of spread across the render.
 */
function planRowCount(count, tier) {
  // Never so many rows that the short ones hold a single mark. Four rows of a
  // five-logo roster balances to 2/1/1/1 — technically even, and three rows
  // each holding one centred panel reads as a broken grid. Capping at
  // count/2 keeps every row a row.
  const rows = Math.min(PREFERRED_ROWS, Math.max(1, Math.floor(count / 2)))
  const perRow = Math.ceil(count / rows)
  // The tier bounds outrank the preference in both directions, and `max` also
  // outranks the guard above: at two marks to a row an odd roster ends on a
  // single no matter how the rows are cut.
  if (perRow > tier.max) return Math.ceil(count / tier.max)
  if (perRow < tier.min) return Math.ceil(count / Math.min(tier.min, count))
  return rows
}

/**
 * Splits `items` into `rowCount` rows whose lengths differ by at most one.
 *
 * Chunking by a fixed column count instead would leave the last row ragged and,
 * worse, would not actually produce the row count asked for: nine logos at
 * ceil(9/4)=3 columns chunk into three rows, not four. Dealing them out by
 * remainder is what makes the row count a guarantee rather than an
 * approximation.
 *
 * The remainder goes to the earliest rows, so a wall that cannot divide evenly
 * is widest at the top and tapers — which reads as deliberate, where a single
 * long row at the bottom reads as overflow.
 */
function balanceRows(items, rowCount) {
  const rows = []
  let cursor = 0
  for (let i = 0; i < rowCount; i += 1) {
    const remaining = items.length - cursor
    const rowsLeft = rowCount - i
    const take = Math.ceil(remaining / rowsLeft)
    if (take > 0) rows.push(items.slice(cursor, cursor + take))
    cursor += take
  }
  return rows
}

export default function PartnerWall() {
  const about = useSection('about_home')
  const { logos = [] } = useSection('marquee')
  const reduced = useReducedMotion()

  const visibleLogos = useMemo(() => logos.filter((logo) => logo.image), [logos])

  // `all` is a query that always holds, so the last tier is the floor and the
  // lookup can never miss. TIERS runs widest-first for exactly this reason.
  const tierIndex = useFirstMatchingQuery(TIER_QUERIES)
  const tier = TIERS[tierIndex] ?? TIERS[TIERS.length - 1]

  const rows = useMemo(() => {
    if (!visibleLogos.length) return []
    return balanceRows(visibleLogos, planRowCount(visibleLogos.length, tier))
  }, [visibleLogos, tier])

  // Every cell is the same width across every row — the widest row is what sets
  // it, and the shorter rows centre within that. Sizing each row to its own
  // length instead would make a four-logo row's panels visibly larger than a
  // five-logo row's directly above it.
  const perRow = rows.length ? rows[0].length : 1

  // The logos are the section: without them there is nothing but a kicker over
  // an empty grid.
  if (!visibleLogos.length) return null

  return (
    <section id="partners" className="relative isolate overflow-hidden bg-void">
      <div className="py-14 md:py-18 xl:py-20">
        <div className="mx-auto flex max-w-[34rem] items-center gap-5 px-gutter text-[0.72rem] font-bold uppercase tracking-[0.22em] text-accent-soft md:text-[0.8rem]">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-accent-soft/70" />
          <h2>{about.eyebrow || 'Our Partners'}</h2>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-accent-soft/70" />
        </div>

        {/* Full-bleed rather than inside the page gutter: the wall is the one
            element here that is meant to measure the viewport. The padding left
            on it is a safety margin, not a gutter — panels flush to a phone's
            screen edge read as clipped.

            Not a list, either: a `ul` of rows announces "4 items" rather than
            the partners, and a `ul` of logos cannot hold the rows the layout
            needs. The order is stable and every mark carries its own alt text,
            so the images are the content on their own. */}
        <div
          className="mt-10 flex flex-col px-4 md:mt-14 md:px-6"
          // One gap value for both axes, and the cell width is written against
          // it below, so changing it here keeps the rows aligned.
          style={{ '--wall-gap': 'clamp(0.5rem, 1.2vw, 1.25rem)', gap: 'var(--wall-gap)' }}
        >
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center" style={{ gap: 'var(--wall-gap)' }}>
              {row.map((logo, i) => (
                <motion.div
                  key={logo.image + '-' + i}
                  // Not `flex-1`: a row holding fewer than `perRow` marks would
                  // stretch its panels to fill the width, and the wall would
                  // lose the single cell size it is built on.
                  style={{
                    width: `calc((100% - ${perRow - 1} * var(--wall-gap)) / ${perRow})`,
                    maxWidth: MAX_CELL,
                  }}
                  initial={reduced ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-10% 0px' }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    // Staggered down the wall a row at a time, so it assembles
                    // top to bottom instead of every panel arriving at once.
                    delay: reduced ? 0 : rowIndex * 0.08 + i * 0.03,
                  }}
                >
                  <div
                    className={
                      'flex aspect-[5/3] h-full w-full items-center justify-center rounded-xl ' +
                      'shadow-[0_18px_45px_-24px_rgba(0,0,0,0.7)] transition-transform duration-300 hover:-translate-y-1 ' +
                      (logo.darkPanel ? 'bg-carbon ring-1 ring-white/15' : 'bg-white')
                    }
                  >
                    {/* The mark is capped on both axes rather than sat in a
                        padded box, because the roster is not one shape: a wide
                        wordmark and a square badge in the same padding box come
                        out wildly different optical sizes — the wordmark fills
                        its width and towers, the badge shrinks to the height and
                        floats. Two independent caps let each shape stop at the
                        size that makes it *look* the same weight as its
                        neighbours.

                        The numbers are a pair, not two settings. On this 5:3
                        panel the height cap resolves to 0.35 of the panel's
                        width, so a square mark lands at ~0.35w and a 4:1
                        wordmark at 0.70w by 0.18w — near enough the same inked
                        area, which is what the eye actually reads as "same
                        size". Changing the panel ratio means re-deriving both. */}
                    <img
                      src={sized(logo.image, 'logo')}
                      alt={logo.alt ?? ''}
                      loading="lazy"
                      decoding="async"
                      className="max-h-[58%] max-w-[70%] object-contain"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
