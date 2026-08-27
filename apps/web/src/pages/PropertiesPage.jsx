import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion, useInView } from 'motion/react'
import { useSection, useProperties, useCategories } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
import { lenis } from '../hooks/useSmoothScroll'
import MaskedHeading from '../components/MaskedHeading'
import { rise, stagger, inViewOnce } from '../lib/motion'
import PrimePill from '../components/PrimePill'
import PropertiesMapHero from '../components/PropertiesMapHero'
// import Marquee from '../components/Marquee'
import Services from '../components/Services'

// The three figures under each card name. The design writes them as free text —
// "2.5 Acres", "Ready", "12 retail slots" — which the integer columns on the
// property record can't express, so a listing may carry its own set under
// `detail.specs`. Falling back to the columns rather than rendering an empty
// row means the grid reads correctly today, before any listing has been given
// specs of its own.
const specsFor = (p) => {
  const custom = p.detail?.specs
  if (Array.isArray(custom) && custom.length) return custom.slice(0, 3).map(String)
  return [`${p.buildings} buildings`, `${p.sold} sold`, `${p.available} available`]
}

/**
 * A block the reader scrolls to, revealed in the site's shared vocabulary —
 * `stagger` over `rise`, held until the block is properly in frame.
 *
 * Driven by `useInView` into an `animate` variant label rather than by the
 * `whileInView` prop, and that is not a stylistic preference. `whileInView`
 * animates the element it sits on perfectly well — the property cards below use
 * it — but it does **not** put the subtree into a variant state, so `variants`
 * on the children resolves against nothing and framer never writes a style for
 * them at all. The symptom is silent: the markup looks right, the parent gets
 * its props, and the children simply render at their resting position, so the
 * stagger appears to work while doing nothing. Resolving the label into
 * `animate` is what the hero above already does, and it propagates.
 *
 * The reduced-motion gate is explicit because framer honours `variants` exactly
 * as authored; with the props dropped the children have no parent state to
 * follow and no `animate` of their own, so they render where they belong
 * (DESIGN.md §5).
 */
function RevealGroup({ className, children }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const inView = useInView(ref, inViewOnce)

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={reduced ? undefined : stagger}
      initial={reduced ? undefined : 'hidden'}
      animate={reduced ? undefined : inView ? 'show' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

function Card({ p, onOpen }) {
  const reduced = useReducedMotion()
  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: inViewOnce,
      }

  return (
    <motion.article
      layout
      {...reveal}
      // `whileInView`, not `animate`. On mount every card in the list animated
      // at once, so a card six rows down finished its entrance while it was
      // still two screens below the fold and was simply *there* when the reader
      // arrived. Tied to the viewport, each row now meets the reader.
      //
      // `exit` stays on the presence tree: filtering removes cards, and that is
      // a different event from scrolling to one.
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`Open ${p.name}`}
      // The homepage's card, exactly: `rounded-panel`, the accent hairline at
      // rest rather than on hover, and the same lift on approach. The hairline
      // is not decoration — these cards are `bg-surface` on a `bg-base` ground,
      // which in light mode is white on white, so without it a card has no edge
      // at all. Matching `duration-500 ease-brand` matters as much as the
      // colours do: the same card reacting at two different speeds on two pages
      // is what makes a site feel assembled rather than designed.
      className="group flex cursor-pointer flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)] focus-visible:border-accent/75"
    >
      <div className="relative h-60 overflow-hidden bg-surface-alt">
        {p.image && (
          <img
            src={sized(p.image, 'card')}
            style={{ viewTransitionName: `property-image-${p.slug}` }}
            alt={p.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-void/70 px-4 py-1.5 font-body text-[13px] text-bone backdrop-blur-sm">
          {p.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3
          style={{ viewTransitionName: `property-title-${p.slug}` }}
          className="font-display text-[1.55rem] font-bold leading-tight tracking-[-0.01em] text-content"
        >
          {p.name}
        </h3>
        <p className="mt-2 font-body text-[15px] text-accent">{p.address}</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--color-line)] pt-4">
          {specsFor(p).map((spec) => (
            <span key={spec} className="font-body text-[14px] text-content/70">
              {spec}
            </span>
          ))}
        </div>
      </div>
    </motion.article>
  )
}

export default function PropertiesPage() {
  const p = useSection('properties_page')
  const properties = useProperties()
  const categories = useCategories()
  const navigate = useNavigate()

  const [filter, setFilter] = useState('All')
  const list = filter === 'All' ? properties : properties.filter((pr) => pr.category === filter)
  const openProperty = async (property) => {
    const path = `/properties/${property.slug}`
    const root = document.documentElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // The route is lazy and AnimatePresence holds the outgoing listing for its
    // exit. Warm the chunk first, then keep the View Transition update pending
    // until the matching hero is truly mounted; otherwise Chrome snapshots the
    // outgoing page twice and there is no destination element to morph into.
    await import('./PropertyDetailPage')

    if (!document.startViewTransition || reduced) {
      navigate(path)
      return
    }

    root.classList.add('property-route-transition')
    flushSync(() => {
      window.dispatchEvent(new CustomEvent('prime:property-transition', { detail: true }))
    })
    const transition = document.startViewTransition(async () => {
      flushSync(() => navigate(path))

      await new Promise((resolve) => {
        const deadline = performance.now() + 1600
        const waitForHero = () => {
          const hero = document.querySelector(`[data-property-hero="${property.slug}"]`)
          if (hero || performance.now() >= deadline) {
            resolve()
            return
          }
          setTimeout(waitForHero, 16)
        }
        waitForHero()
      })
    })

    transition.finished.finally(() => {
      root.classList.remove('property-route-transition')
      window.dispatchEvent(new CustomEvent('prime:property-transition', { detail: false }))
    })
  }
  // PrimePill is a plain anchor, which is right for the homepage hero's hash
  // link but would hard-navigate a route. Both handlers take the click back off
  // the browser: one hands it to Lenis so the jump down the page is smooth like
  // every other in-page link, the other to the router so /contact doesn't
  // reload the app.
  const onBrowse = (e) => {
    const href = p.ctaHref || '#collection'
    if (!href.startsWith('#')) return
    e.preventDefault()
    lenis.current?.scrollTo(href, { offset: -20 })
  }

  const onTour = (e) => {
    const href = p.ctaSecondaryHref || '/contact'
    if (!href.startsWith('/')) return
    e.preventDefault()
    navigate(href)
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      {/* Copy and map share one screen rather than dividing it. The map is the
          ground, arriving under the copy toward the bottom of the fold, so
          there is no band here to give the leftover height to — the section
          sets its own and centres the copy in the paper above the pins. */}
      <PropertiesMapHero properties={properties} onOpen={openProperty}>
        {/* Same treatment as the homepage hero — display face, bold, uppercase,
            the same tight leading and tracking — at a smaller size. Governed by
            whichever runs out first, width or height, for the same reason the
            home headline is: a short wide window has to shrink the type rather
            than push the buttons down onto the pins. */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="text-center">
          {/* Plain, not a motion child: its words carry their own masked rise,
              and a block-level lift on top would move each mask along with the
              word inside it — leaving nothing for the word to rise out of. */}
          <h2 className="mx-auto max-w-[18ch] font-display font-bold uppercase leading-[1.03] tracking-tight text-content [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            <MaskedHeading text={p.heroHeading} accentClass="italic text-accent" />
          </h2>

          {p.heroParagraph && (
            /* Type comes from the homepage lede — same 15px, same leading, same
               weight of grey — so the two heroes speak at one volume. Only the
               measure differs: that lede is set left in a column beside the
               visual, where 480px is what makes it a column, while this one is
               centred under a full-width heading and at that width breaks into
               three stub lines. 40rem is the measure the design sets, and it
               lands the same copy on two balanced lines. */
            <motion.p
              variants={rise}
              className="mx-auto mt-7 max-w-[40rem] font-body text-[15px] leading-relaxed text-content/70"
            >
              {p.heroParagraph}
            </motion.p>
          )}

          <motion.div
            variants={rise}
            className="mt-9 flex flex-wrap items-center justify-center gap-4"
          >
            <PrimePill href={p.ctaHref || '#collection'} onClick={onBrowse}>
              {p.ctaLabel}
            </PrimePill>
            <PrimePill variant="outline" href={p.ctaSecondaryHref || '/contact'} onClick={onTour}>
              {p.ctaSecondaryLabel}
            </PrimePill>
          </motion.div>
        </motion.div>
      </PropertiesMapHero>

      {/* ── The curated collection ───────────────────────────── */}
      {/* Ground, gutter, rhythm and measure are the homepage's — `bg-base
          px-gutter py-20 text-content md:px-gutter-lg md:py-28` is what every
          section on the landing page sets, and this band was running its own
          `bg-surface px-6` with no measure at all. The gutter is the visible
          half: `px-gutter-lg` is 6.25rem against the 3rem this had, so the grid
          now starts on the same vertical as the homepage's cards instead of
          sitting 2rem wider than everything else on the site. */}
      <section
        id="collection"
        data-band="light"
        className="bg-base px-gutter py-20 text-content md:px-gutter-lg md:py-28"
      >
        {/* The 1560px measure every homepage section sets. Without it this grid
            was the one band on the site with no ceiling, so on a wide display it
            ran three cards across a 2400px row while the landing page above it
            held its column. */}
        <div className="mx-auto max-w-[1560px]">
          {/* The section-level reveal in `SectionRevealController` un-blurs this
            whole band the moment its top edge enters view — and this band is
            over 1700px tall, so on its own it means the grid at the bottom
            finished animating about 1500px before anyone scrolled to it. The
            section entrance introduces the band; these interior reveals are
            what actually meet the reader on the way down. */}
          <RevealGroup className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-end">
            <div>
              {/* inline-block because a transform on an inline box is ignored
                outright — the lift would silently do nothing here. */}
              {p.curatedEyebrow && (
                <motion.span
                  variants={rise}
                  className="inline-block font-body text-[14px] uppercase tracking-[0.14em] text-accent"
                >
                  {p.curatedEyebrow}
                </motion.span>
              )}
              {/* Safe as a motion child, unlike the hero above: this heading is
                `renderEmphasis`, not `MaskedHeading`, so there are no per-word
                masks for a block-level lift to drag along with their words. */}
              <motion.h2
                variants={rise}
                className="mt-4 font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]"
              >
                {renderEmphasis(p.curatedHeading)}
              </motion.h2>
            </div>
            {p.curatedParagraph && (
              <motion.p
                variants={rise}
                className="font-body text-[16px] leading-[1.7] text-content/70"
              >
                {p.curatedParagraph}
              </motion.p>
            )}
          </RevealGroup>

          {/* Not in the Figma, which draws the grid unfiltered — kept because the
            page already shipped with it and dropping it would quietly remove a
            way to navigate the list. Restyled for the light ground. */}
          {/* Not in the Figma, which draws the grid unfiltered — kept because the
            page already shipped with it and dropping it would quietly remove a
            way to navigate the list. Restyled for the light ground. */}
          {categories.length > 2 && (
            <RevealGroup className="mt-12 flex flex-wrap gap-2.5">
              {categories.map((c) => {
                const active = c === filter
                return (
                  // `variants` only — no `animate`. Clicking a pill re-renders the
                  // row, and an explicit animate prop here would re-run the
                  // entrance on every filter change; driven by the parent's
                  // variant state it settles at `show` and stays there.
                  <motion.button
                    key={c}
                    variants={rise}
                    type="button"
                    onClick={() => setFilter(c)}
                    className={`min-h-11 rounded-full border px-5 py-2 font-body text-[13px] font-medium uppercase tracking-[0.1em] transition-colors duration-300 ${
                      active
                        ? 'border-accent bg-accent text-white dark:text-void'
                        : 'border-[var(--color-line)] text-content/70 hover:border-content/35 hover:text-content'
                    }`}
                  >
                    {c}
                  </motion.button>
                )
              })}
            </RevealGroup>
          )}

          <motion.div layout className="mt-12 grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {list.map((pr) => (
                <Card key={pr.slug} p={pr} onOpen={() => openProperty(pr)} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* <Marquee /> */}
      <Services />
    </div>
  )
}
