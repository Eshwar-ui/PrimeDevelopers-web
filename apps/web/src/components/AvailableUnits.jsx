import { useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { motion, useReducedMotion } from 'motion/react'
import { dealCards } from '../lib/reveal'
import { useProperties, useSection } from '../context/ContentContext'
import { collectUnits } from '../lib/units'
import { SIZE_TIERS } from '../lib/unitTiers'
import { renderEmphasis } from '../lib/emphasis'
import ActionButton from './ActionButton'
import ArrowRight from './ArrowRight'
import UnitCard from './UnitCard'

gsap.registerPlugin(ScrollTrigger)

// Four cards, matching the Properties teaser's own cap (`TEASER_COUNT` there)
// — this is a taste of what's available, not the leasing index. "View all
// properties" is the door to the rest.
const TEASER_COUNT = 4

export default function AvailableUnits() {
  const properties = useProperties()
  // Eyebrow, heading and intro — Site content → "Find your ideal space".
  const copy = useSection('units_home')
  const scope = useRef(null)
  const [tier, setTier] = useState('all')
  // Set by a filter click, so the cards that follow swap in quickly rather
  // than replaying the full scroll entrance (see the deal below).
  const filtered = useRef(false)
  const reduceMotion = useReducedMotion()
  const allUnits = useMemo(() => collectUnits(properties), [properties])

  const sizeFiltered = useMemo(() => {
    const test = SIZE_TIERS.find((t) => t.id === tier)?.test ?? (() => true)
    return allUnits.filter((row) => test(row.sf))
  }, [allUnits, tier])

  /**
   * The four cards actually rendered: a round-robin across the statuses
   * present rather than the plain top four.
   *
   * Straight slicing looked right and wasn't: Centro has 20 available units
   * and 47 sold ones, and available sorts first, so the section rendered four
   * available units and no evidence that the other 47 existed. The
   * round-robin leads on availability — it takes the first bucket first — and
   * still puts a let unit on screen, which is what makes the rest of the
   * inventory discoverable at all.
   *
   * This carries more weight now that the status pills are gone: the mix is
   * the only thing telling a visitor the inventory is broader than four
   * vacancies.
   */
  const shown = useMemo(() => {
    const buckets = new Map()
    for (const row of sizeFiltered) {
      if (!buckets.has(row.unit.status)) buckets.set(row.unit.status, [])
      buckets.get(row.unit.status).push(row)
    }

    const queues = [...buckets.values()]
    const picked = []
    for (let round = 0; picked.length < TEASER_COUNT; round += 1) {
      // Every queue exhausted — fewer units than the cap, which is fine.
      if (queues.every((q) => round >= q.length)) break
      for (const queue of queues) {
        if (round < queue.length && picked.length < TEASER_COUNT) picked.push(queue[round])
      }
    }
    return picked
  }, [sizeFiltered])

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const deal = dealCards(
        scope.current?.querySelectorAll('[data-unit-card]'),
        filtered.current ? { y: 20, step: 0.06 } : undefined
      )
      return () => deal?.kill()
    },
    {
      scope,
      // Keyed on the property/unit pair, not the unit index alone: with every
      // status in the list, index 0 of two different buildings now collides
      // and the stagger would skip re-running on a filter change.
      dependencies: [
        shown.map((s) => `${s.property.slug}:${s.building?.building}:${s.unit.index}`).join(','),
        tier,
      ],
      revertOnUpdate: true,
    }
  )

  // No unit anywhere in the portfolio — the same call the other homepage
  // panels make: an empty shell is worse than no section at all.
  if (allUnits.length === 0) return null

  return (
    <section
      data-section-reveal="off"
      data-band="light"
      ref={scope}
      aria-labelledby="available-units-heading"
      className="bg-base px-gutter py-6 text-content"
    >
      <div className="mx-auto max-w-[1560px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
            <span aria-hidden className="h-px w-8 bg-accent/45" />
            {copy.eyebrow}
            <span aria-hidden className="h-px w-8 bg-accent/45" />
          </p>
          <h2
            id="available-units-heading"
            className="mt-4 text-balance font-display font-bold leading-[1.1] tracking-[-0.02em] text-content"
            style={{ fontSize: 'clamp(1.7rem, 3vw, 2.5rem)' }}
          >
            {renderEmphasis(copy.heading, 'text-accent')}
          </h2>
          <p className="mt-3 font-body text-[15px] leading-relaxed text-content/70">
            {copy.paragraph}
          </p>
        </div>

        {/* `layoutScroll` so the pill measures correctly inside the phone's
            horizontally scrolling row. */}
        <motion.div
          layoutScroll
          className="-mx-gutter mt-8 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-gutter pb-2 scroll-px-gutter sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0"
          role="group"
          aria-label="Filter units by size"
        >
          {SIZE_TIERS.map((t) => {
            const isActive = tier === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  filtered.current = true
                  setTier(t.id)
                }}
                className={`relative isolate min-h-11 shrink-0 snap-start rounded-full border px-5 font-body text-[13px] font-bold transition-colors duration-200 ease-brand ${
                  isActive
                    ? 'border-accent text-white'
                    : 'border-content/20 text-content/70 hover:border-accent hover:text-accent'
                }`}
              >
                {/* One pill shared by every filter: it slides from the old
                    choice to the new one instead of the fill jumping across. */}
                {isActive && (
                  <motion.span
                    layoutId="unit-tier-pill"
                    aria-hidden
                    className="absolute -inset-px -z-10 rounded-full bg-accent"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.5 }}
                  />
                )}
                {t.label}
              </button>
            )
          })}
        </motion.div>

        {shown.length === 0 ? (
          <p className="mt-12 text-center font-body text-sm text-content/70">
            No units match that size right now — try another size, or explore the full list
            below.
          </p>
        ) : (
          /* A rail everywhere below the desktop rung, a grid at it.

             The switch used to happen at `md`, which put the whole tablet
             range — the widths that are actually called "responsive" — into a
             wrapping grid: at 768px `auto-fit` fits two columns, so four units
             came out as two rows of two. A teaser that wraps stops reading as
             a teaser, because a second row looks like the start of an index.
             It now stays a single scrollable row until `xl`, which is the
             first width where four cards genuinely fit across and there is
             nothing left to scroll. `lg` was the obvious rung and the wrong
             one: the gutter is `clamp(1.5rem, 6.5vw, 6.25rem)`, so it eats 13%
             of the viewport through this whole range, and at 1053px the
             content box is ~916px — three tracks of 15rem, not four. The
             fourth card dropped to a row of its own, which is a worse
             stacking than the one the rail was fixing. Four tracks need
             ~1032px of content, so the grid cannot appear below ~1186px.

             The track width steps down with the breakpoint instead of holding
             at 85%: one card and a peek is right on a phone, but 85% of a
             tablet is a 650px card, which is a poster. Each step keeps the
             next card partly visible, which is what tells a visitor the row
             moves — there is no other affordance for it.

             At the desktop rung the card is measured from the viewport, not
             set in rem. The tracks there had drifted back to a fixed
             `auto-cols-[23.25rem]` on `grid-flow-col`, which asks for
             4 x 372px + 3 x 24px = 1560px of content — and at a 1536px window
             the content box is 1488px, so the fourth card was clipped by
             exactly 72px and the row quietly became scrollable on a display
             wide enough to show everything. A `1fr` track divides whatever is
             there by the number of cards, so the four always land inside the
             container at any width above the rung.

             The track is `minmax(0, 23.25rem)`, not `1fr`. A bare `1fr`
             divides the container however many cards there are, so the size
             filters — which can leave a single match — turned one unit into a
             1560px poster with its photograph cropped to a letterbox. With a
             ceiling the card shrinks with the viewport and stops growing at
             the width it was drawn for, and `xl:justify-center` centres what
             is there under a heading that is already centred.

             The count is `shown.length` capped at four rather than a fixed
             `grid-cols-4`: fixed columns would leave one match sitting
             against three empty tracks, and an empty `minmax(0, …)` track
             still takes its share of the free space. It is not `auto-fit`
             either — `auto-fit` derives its repetition from the *max* track
             sizing function, so the ceiling would silently decide the column
             count too.

             `xl`, not `lg`, is still the rung. The gutter is
             `clamp(1.5rem, 6.5vw, 6.25rem)` and eats 13% of the viewport
             through that range; at 1053px the content box is ~916px, which is
             229px a card — under the ~15rem where the unit name and the price
             stop fitting on two lines. At 1280px the content box is 1114px
             and a card is 260px, which clears it; 1536px gives 316px and
             1920px is held at the 1560px cap, four 372px cards. */
          <div
            style={{ '--uc': Math.min(shown.length, TEASER_COUNT) }}
            className="-mx-gutter mt-10 grid auto-cols-[85%] grid-flow-col snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain px-gutter py-3 scroll-px-gutter sm:auto-cols-[20rem] md:auto-cols-[21rem] lg:auto-cols-[22rem] xl:mx-0 xl:grid-flow-row xl:grid-cols-[repeat(var(--uc),minmax(0,23.25rem))] xl:justify-center xl:overflow-x-visible xl:px-0 xl:py-0"
          >
            {shown.map((row) => (
              // The building has to be in the key. `unit.index` is the unit's
              // position within *its own* building, so with every building in
              // the list now, unit 6 of B-06 and unit 6 of B-07 would collide
              // on one key.
              <UnitCard
                key={`${row.property.slug}-${row.building?.building}-${row.unit.index}`}
                {...row}
                className="snap-start"
              />
            ))}
          </div>
        )}

        {sizeFiltered.length > TEASER_COUNT && (
          <div className="mt-8 flex justify-center">
            {/* The unit-wise half of /properties, not the listings grid: this
                section is units, and the visitor asking for more of it wants
                the rest of the units rather than the developments holding
                them. */}
            <ActionButton tone="ghost" href={`/properties?view=units${tier === 'all' ? '' : `&size=${tier}`}`}>
              View all units
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </ActionButton>
          </div>
        )}
      </div>
    </section>
  )
}
