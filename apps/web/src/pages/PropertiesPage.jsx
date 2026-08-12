import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useSection, useProperties, useCategories } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { lenis } from '../hooks/useSmoothScroll'
import MaskedHeading from '../components/MaskedHeading'
import { rise, stagger } from '../lib/motion'
import PrimePill from '../components/PrimePill'
import PropertyStrip from '../components/PropertyStrip'
import Marquee from '../components/Marquee'
import Services from '../components/Services'

// The band unfurls a beat behind the copy. Starting them together reads as two
// animations that happened to fire at once; letting the words get away first
// makes the photographs feel like the answer to them.
const STRIP_DELAY = 380

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

function Card({ p, onOpen }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpen}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface transition-shadow duration-300 hover:shadow-[0_22px_48px_-30px_rgba(0,0,0,0.45)]"
    >
      <div className="relative h-60 overflow-hidden bg-surface-alt">
        {p.image && (
          <img
            src={p.image}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-void/70 px-4 py-1.5 font-body text-[13px] text-bone backdrop-blur-sm">
          {p.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-[1.55rem] font-bold leading-tight tracking-[-0.01em] text-content">
          {p.name}
        </h3>
        <p className="mt-2 font-body text-[15px] text-accent">{p.address}</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--color-line)] pt-4">
          {specsFor(p).map((spec) => (
            <span key={spec} className="font-body text-[14px] text-content/55">
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
  const [filter, setFilter] = useState('All')
  const navigate = useNavigate()
  const list = filter === 'All' ? properties : properties.filter((pr) => pr.category === filter)

  // The band defaults to the listings themselves rather than a second set of
  // uploads: it is the properties carousel, so the properties are the obvious
  // content, and it means the strip is populated the moment the page exists.
  // An explicit `heroSlides` in the CMS overrides that.
  const slides = p.heroSlides?.length
    ? p.heroSlides
    : properties
        .filter((pr) => pr.image)
        .slice(0, 5)
        .map((pr) => ({ image: pr.image, label: pr.name }))

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
      {/* Copy and band share one screen: the band is the bottom of the fold, so
          whatever height the copy doesn't take, it gets. Bounded like the
          homepage hero — a very tall window shouldn't strand the copy in a sea
          of white, and a short one shouldn't crush it — and left to flow below
          lg, where a full-height fold would squeeze the heading, the lede, two
          buttons and a photographic band into a phone screen. */}
      <div className="flex flex-col lg:h-dvh lg:max-h-240 lg:min-h-152">
        <section
          id="properties-hero"
          data-band="light"
          className="flex flex-1 flex-col justify-center bg-surface px-6 pb-12 pt-32 text-center md:px-12 md:pb-14 md:pt-36"
        >
          {/* Same treatment as the homepage hero — display face, bold,
              uppercase, the same tight leading and tracking — at a smaller
              size. Governed by whichever runs out first, width or height, for
              the same reason the home headline is: it now shares a fixed fold
              with the band below, so a short wide window has to shrink the type
              rather than push the photographs off the screen. */}
          <motion.div variants={stagger} initial="hidden" animate="show">
            {/* Plain, not a motion child: its words carry their own masked rise,
                and a block-level lift on top would move each mask along with the
                word inside it — leaving nothing for the word to rise out of. */}
            <h2 className="mx-auto max-w-[18ch] font-display font-bold uppercase leading-[1.03] tracking-tight text-content [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
              <MaskedHeading text={p.heroHeading} accentClass="italic text-accent-soft" />
            </h2>

            {p.heroParagraph && (
              /* Type comes from the homepage lede — same 15px, same leading,
                 same weight of grey — so the two heroes speak at one volume.
                 Only the measure differs: that lede is set left in a column
                 beside the visual, where 480px is what makes it a column, while
                 this one is centred under a full-width heading and at that width
                 breaks into three stub lines. 40rem is the measure the design
                 sets, and it lands the same copy on two balanced lines. */
              <motion.p
                variants={rise}
                className="mx-auto mt-7 max-w-[40rem] font-body text-[15px] leading-relaxed text-content/60"
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
        </section>

        {/* Outside the hero's padding on purpose — the band is full-bleed. */}
        <div data-band="light" className="shrink-0 bg-surface">
          <PropertyStrip slides={slides} delay={STRIP_DELAY} />
        </div>
      </div>

      {/* ── The curated collection ───────────────────────────── */}
      <section id="collection" data-band="light" className="bg-surface px-6 py-20 md:px-12 md:py-28">
        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-end">
          <div>
            {p.curatedEyebrow && (
              <span className="font-body text-[14px] uppercase tracking-[0.14em] text-accent">
                {p.curatedEyebrow}
              </span>
            )}
            <h2 className="mt-4 font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]">
              {renderEmphasis(p.curatedHeading)}
            </h2>
          </div>
          {p.curatedParagraph && (
            <p className="font-body text-[16px] leading-[1.7] text-content/60">
              {p.curatedParagraph}
            </p>
          )}
        </div>

        {/* Not in the Figma, which draws the grid unfiltered — kept because the
            page already shipped with it and dropping it would quietly remove a
            way to navigate the list. Restyled for the light ground. */}
        {categories.length > 2 && (
          <div className="mt-12 flex flex-wrap gap-2.5">
            {categories.map((c) => {
              const active = c === filter
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`rounded-full border px-5 py-2 font-body text-[13px] font-medium uppercase tracking-[0.1em] transition-colors duration-300 ${
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-[var(--color-line)] text-content/55 hover:border-content/35 hover:text-content'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        )}

        <motion.div layout className="mt-12 grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((pr) => (
              <Card key={pr.slug} p={pr} onOpen={() => navigate(`/properties/${pr.slug}`)} />
            ))}
          </AnimatePresence>
        </motion.div>
      </section>

      <Marquee />
      <Services />
    </div>
  )
}
