import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import CountUp from '../components/CountUp'
import { rise, stagger, inViewOnce } from '../lib/motion'
import { useProperty, useSection } from '../context/ContentContext'
import { useSectionNav } from '../hooks/useSectionNav'
import PrimePill from '../components/PrimePill'
import FloorPlanSection from '../components/FloorPlanSection'
import SiteModelSection from '../components/SiteModelSection'
import { hasSiteModel } from '../lib/siteModel'
import { sized } from '../lib/images'
import { scrollToElement } from '../lib/scrollToElement'
import PropertyHero from '../components/PropertyHero'
import { youtubeEmbedUrl } from '../lib/video'
import {
  buildingFromResourceLabel,
  buildingSlug,
  getInvestment,
  isInvestmentLinkable,
} from '../lib/investment'

// Eyebrow section label with the accent dash, matching the site system.
//
// `inv` means "on one of the two dark bands", not "dark mode" — the light
// variant reads role tokens and follows the theme, while the dark one is fixed,
// because the bands it sits on are dark in both themes by design.
function SectionTag({ children, tone = 'light' }) {
  const inv = tone === 'inv'
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className={`h-px w-10 shrink-0 ${inv ? 'bg-accent-soft' : 'bg-accent'}`} />
      <span
        className={`font-body text-[13px] font-bold uppercase tracking-[0.28em] ${
          inv ? 'text-bone/80' : 'text-content/70'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

// Glyphs for the highlight rows. The titles are free text an admin typed, so
// the icon is chosen by what the title says and falls back to a neutral mark.
const HIGHLIGHT_ICONS = [
  [/\b(expansive|project|size|acre|sq|square|area)\b/i, 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5'],
  [/\b(mezzanine|floor|plan|layout|level)\b/i, 'M3 3h18v18H3zM3 9h18M9 9v12'],
  [/\b(premium|feature|balcon|glass|finish)\b/i, 'M12 3l2.2 5.6L20 10l-4.4 3.4L16.8 19 12 16l-4.8 3 1.2-5.6L4 10l5.8-1.4z'],
  [/\b(traffic|location|road|access|highway|hwy)\b/i, 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  [/\b(park|vehicle|car)\b/i, 'M3 13l2-6h14l2 6v6h-3v-2H6v2H3zM7 16h.01M17 16h.01'],
]
const HIGHLIGHT_FALLBACK = 'M12 4l8 8-8 8-8-8 8-8Z'

// Glyphs for the overview figures. Chosen by what the label says, the same way
// HIGHLIGHT_ICONS reads a title, because these labels are free text an admin
// typed — "SFT Property Size", "Total Units", "Available Units" — and a fixed
// icon per position would mislabel the moment someone reorders them.
//
// Order is load-bearing rather than incidental: "Available Units" satisfies the
// units test as well as the availability one, so the narrower reading has to be
// offered first or two of the three figures draw the same mark.
//
// Each entry is a list of paths — the two-figure mark can't be drawn in one.
const STAT_ICONS = [
  [
    /\b(available|vacant|remaining|unleased)\b/i,
    ['M21 8.2 12 3 3 8.2v7.6L12 21l9-5.2V8.2Z', 'M3 8.2l9 5.2 9-5.2', 'M12 13.4V21'],
  ],
  [
    /\b(total|units?|tenants?|occupancy|leased|sold)\b/i,
    ['M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21', 'M9 11.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2', 'M22 21v-1.8a4 4 0 0 0-3-3.87', 'M16 3.13a4.1 4.1 0 0 1 0 7.94'],
  ],
  [
    /\b(sft|sq|square|size|acres?|area|project|feet)\b/i,
    ['M4 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15', 'M12 21V11a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v10', 'M3 21h18', 'M7 9h2M7 13h2M7 17h2', 'M15 14h2M15 18h2'],
  ],
]

function StatIcon({ label }) {
  const match = STAT_ICONS.find(([test]) => test.test(label ?? ''))
  const paths = match ? match[1] : [HIGHLIGHT_FALLBACK]
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 text-content/40"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

const TILE_TONES = [
  'bg-content/6 text-content/70',
  'bg-[color-mix(in_srgb,var(--color-status-available)_14%,transparent)] text-[var(--color-status-available)]',
  'bg-prime-soft text-accent',
  'bg-[color-mix(in_srgb,var(--color-ember)_16%,transparent)] text-ember',
]

function HighlightIcon({ title }) {
  const match = HIGHLIGHT_ICONS.find(([test]) => test.test(title ?? ''))
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d={match ? match[1] : HIGHLIGHT_FALLBACK} />
    </svg>
  )
}
export default function PropertyDetailPage() {
  const { slug } = useParams()
  const property = useProperty(slug)
  const t = useSection('property_detail_page')
  const go = useSectionNav()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(0)
  const [galleryMain, setGalleryMain] = useState(0)
  const [openArea, setOpenArea] = useState(0)

  // A unit link from the homepage arrives as `?building=…&unit=…`. On the
  // per-building path the building is a tab, so it has to be opened here
  // before FloorPlanSection — which reads `?unit=` for itself — can find the
  // unit in it. The site-model path handles both parameters internally and is
  // deliberately left alone.
  //
  // Named rather than indexed on purpose: a tab index would break the moment
  // the client reorders buildings in the admin, and these links are shared.
  const linkedBuilding = searchParams.get('building')
  useEffect(() => {
    if (!linkedBuilding || hasSiteModel(property)) return
    const buildings = property?.detail?.floorPlans?.buildings ?? []
    const index = buildings.findIndex(
      (b) => String(b.building ?? '').trim().toLowerCase() === linkedBuilding.trim().toLowerCase(),
    )
    // An unknown building is not an error — the page opens on its first tab,
    // which is what a stale shared link should do.
    if (index >= 0) setTab(index)
  }, [linkedBuilding, property])

  // Bring the plan to the visitor, once, on arrival.
  //
  // Guarded by a ref rather than by empty deps: `property` arrives from the
  // content fetch, so on a cold load the section does not exist yet on the
  // first pass and an arrival-only effect would scroll to nothing. The ref is
  // what keeps it to once — FloorPlanSection rewrites `?unit=` on every
  // click, and re-running would drag the page back up under the visitor.
  const linkedUnit = searchParams.get('unit')
  const hasScrolled = useRef(false)
  const cancelScroll = useRef(null)

  // Unmount-only teardown, and it resets the guard — see the matching note in
  // SiteModelSection. Returning the canceller from the effect below instead
  // would cancel the scroll on the visitor's first unit click, and would stop
  // it running at all under StrictMode.
  useEffect(
    () => () => {
      cancelScroll.current?.()
      cancelScroll.current = null
      hasScrolled.current = false
    },
    [],
  )

  useEffect(() => {
    if (hasScrolled.current) return
    if ((!linkedUnit && !linkedBuilding) || !property || hasSiteModel(property)) return
    const section = document.getElementById('floor-plans')
    if (!section) return
    hasScrolled.current = true
    cancelScroll.current = scrollToElement(section)
  }, [property, linkedBuilding, linkedUnit])

  if (!property) {
    return (
      <section
        data-band="light"
        className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-base px-6 text-center"
      >
        <h1 className="font-display text-3xl font-bold tracking-[-0.01em] text-content">
          {t.notFoundHeading}
        </h1>
        <Link
          to="/properties"
          className="font-body text-[14px] uppercase tracking-[0.14em] text-accent transition-colors duration-300 hover:text-prime-deep"
        >
          {t.notFoundBackLabel}
        </Link>
      </section>
    )
  }

  const d = property.detail
  const gallery = property.gallery ?? []
  // The overview shows two frames, not a collage. The hero photograph is
  // usually also the first gallery entry, so it is dropped here — showing the
  // reader the image they just scrolled past reads as a duplicate rather than
  // as a second view of the site.
  const overviewImages = gallery.filter((src) => src && src !== property.image).slice(0, 2)
  // Guarded: a property with no buildings yet would divide 0 by 0 and render
  // "(NaN% currently reserved.)" in the enquiry copy.
  const soldPct = property.buildings > 0 ? Math.round((property.sold / property.buildings) * 100) : 0

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <PropertyHero
        property={property}
        soldPct={soldPct}
        onEnquire={() => go(`/contact?property=${property.id}&from=/properties/${property.slug}`)}
      />

      {/* ── Overview ─────────────────────────────────────────── */}
      {/* The argument on the left, the photography beside it as evidence, and
          the project's figures on a full-width band that closes the section.
          Three groups, and which one owns the figures is the whole design:
          they describe the development, not the two frontages above them, so
          they sit outside the columns rather than under one of them.

          That is also the only place they fit. Inside the right column the row
          had ~390px at 1024px to seat three unwrappable numerals, their icons
          and their rules — it overflowed its own panel at every desktop width
          and only got worse with a longer figure or a fourth stat. Full width
          it has 270px per cell at the narrowest supported layout. */}
      {d?.overview?.heading && (
        <section id="overview" data-band="light" className="bg-base px-gutter py-20 md:py-28">
          <div className="mx-auto max-w-[1560px]">
            {/* `lg:items-center` rather than `items-start`: the copy column runs
                taller than a pair of 4:3 frames at most widths, and pinning
                both to the top left the slack as a hard stub under the
                photographs. Centred, it reads as air around them.

                The columns collapse to one when the listing has no gallery — a
                two-column grid with an empty half is worse than a single
                column, and the copy gets the full measure instead. */}
            <div
              className={`grid gap-12 lg:gap-16 ${
                overviewImages.length > 0 ? 'lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center' : ''
              }`}
            >
              <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={inViewOnce}>
                {d.overview.eyebrow && (
                  <motion.div variants={rise}>
                    <SectionTag>{d.overview.eyebrow}</SectionTag>
                  </motion.div>
                )}
                {/* The documented section-heading clamp (DESIGN.md §2), which
                    the highlights section below already uses. The 3.9vw/3.5rem
                    this carried made it the largest heading on the page at the
                    top end and — because a vw clamp climbs later than a `md:`
                    step — *smaller* than every heading beneath it from 768px to
                    about 1230px. The lead section cannot be the one that
                    undersells itself.

                    `text-balance` rather than a `ch` cap: the heading is CMS
                    copy of unknown length, and a hard measure that lands two
                    tidy lines on the seeded string turns a longer one into a
                    stub. */}
                <motion.h2
                  variants={rise}
                  className="mt-4 max-w-[22ch] text-balance font-display font-bold leading-[1.08] tracking-[-0.02em] text-content [font-size:clamp(1.9rem,3.4vw,3rem)]"
                >
                  {d.overview.heading}
                </motion.h2>
                {/* 34rem is ~66 characters of Arimo at this size — a real
                    reading measure. The 52ch it replaces was set for the old
                    narrow five-column gutter and left the paragraph visibly
                    short of its own column. */}
                <motion.p
                  variants={rise}
                  className="mt-6 max-w-[34rem] font-body text-[16px] leading-[1.75] text-content/70"
                >
                  {d.overview.body}
                </motion.p>
                {/* Unconditional. This was gated on `d.overview.flyer`, an
                    unrelated CMS field for a downloadable sheet, so a property
                    whose row simply had no flyer URL lost the section's only
                    call to action — invisible today because the seed sets it to
                    '#', and one blank field away from a persuade section with
                    nothing to click. */}
                <motion.div variants={rise} className="mt-10 w-fit">
                  <PrimePill
                    href="/contact"
                    onClick={(event) => {
                      event.preventDefault()
                      go(`/contact?property=${property.id}&from=/properties/${property.slug}`)
                    }}
                  >
                    {t.overviewEnquireLabel}
                  </PrimePill>
                </motion.div>
              </motion.div>

              {/* Evidence. `gap-4` between the two frames against `gap-12` to
                  the copy column and a ruled band below: the pair is one idea
                  and reads as one, which the uniform `gap-5` on both axes had
                  flattened into three equal tiles.

                  Side by side while the column is the full page width, stacked
                  once it is a half of it. Two landscape frames inside a half
                  column are ~270px wide — thumbnails floating against a copy
                  column twice their height, which is what the first pass got
                  wrong. The reference sets them side by side because its right
                  column also carried the figures; those now close the section
                  full-width, so the pair has to hold that height on its own.

                  An aspect ratio, not a fixed height — with `h-56 md:h-64` the
                  same frontage was cropped ~1.5:1 as a pair and ~3:1 alone, so
                  the photograph changed shape with the size of the gallery. The
                  ratio turns with the arrangement: 4:3 while the frames are a
                  pair (at 768 that is 274px wide, and a letterbox crop of a
                  shopfront at that size shows nothing), 16:9 once they are
                  stacked, where a squarer frame would run the pair 290px past
                  the bottom of the copy beside it. */}
              {overviewImages.length > 0 && (
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="show"
                  viewport={inViewOnce}
                  className={`grid gap-4 ${overviewImages.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-1' : ''}`}
                >
                  {overviewImages.map((image, i) => (
                    <motion.div
                      key={`${image}-${i}`}
                      variants={rise}
                      className="overflow-hidden rounded-panel border border-line bg-surface-alt"
                    >
                      <img
                        src={sized(image, 'card')}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-brand hover:scale-[1.04] lg:aspect-[16/9]"
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* The figures. A hairline and generous air rather than a bordered
                panel: `bg-surface` and `bg-base` are both #ffffff in the light
                theme, so the panel this replaces had no fill at all there and
                existed only as an outline, while in dark it read as a raised
                card — one idiom that only existed in one theme, which is the
                exact failure DESIGN.md §1 warns about.

                Ink numerals with accent labels, matching the highlights band
                below and the homepage stats. Blue is this system's interaction
                colour; the previous pass had twelve accent-carrying elements
                here and exactly one of them clickable, so the Enquire pill had
                no colour advantage over a decorative hairline. It now has five,
                and it is the only saturated mass among them. */}
            {d.overview.stats?.length > 0 && (
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="show"
                viewport={inViewOnce}
                className="mt-16 grid gap-y-8 border-t border-line pt-12 sm:grid-cols-3 sm:gap-y-0 sm:divide-x sm:divide-line md:mt-20 md:pt-14"
              >
                {d.overview.stats.map((s, i) => (
                  <motion.div
                    key={`${s.label ?? ''}-${i}`}
                    variants={rise}
                    className="min-w-0 sm:px-7 sm:first:pl-0 sm:last:pr-0"
                  >
                    {/* Above the numeral, not beside it. Beside it, each icon
                        took 42px off the one dimension the row was short of,
                        and five stats would have spent 140px of a 190px cell on
                        decoration before the first digit rendered. Stacked, a
                        cell is only ever as wide as its widest line. */}
                    <StatIcon label={s.label} />
                    <CountUp
                      value={s.value}
                      className="numeral mt-4 block text-content [font-size:clamp(2.4rem,2.9vw,3rem)]"
                    />
                    <span className="mt-2.5 block font-body text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                      {s.label}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* ── Tenants ──────────────────────────────────────────── */}
      {d?.tenants?.length > 0 && (
        <section data-band="light" className="border-y border-[var(--color-line)] bg-base px-gutter py-16">
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
            {d.tenants.map((logo, i) => (
              <img
                key={i}
                src={logo}
                alt=""
                className="h-10 w-auto object-contain transition-transform duration-300 hover:scale-105 md:h-12"
              />
            ))}
          </div>
        </section>
      )}

      {/* Property highlights */}
      {d?.highlights?.heading && (
        <section data-band="light" className="bg-surface-alt px-gutter pb-8 pt-16 md:pb-10 md:pt-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={inViewOnce}
            >
              <motion.div variants={rise} className="flex items-center gap-4">
                <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
                <span className="font-body text-[13px] font-bold uppercase tracking-[0.22em] text-content/70">
                  {t.highlightsEyebrow}
                </span>
              </motion.div>
              <motion.h2
                variants={rise}
                className="mt-6 font-display font-bold leading-[1.08] tracking-[-0.02em] text-content [font-size:clamp(1.9rem,3.4vw,3rem)]"
              >
                {d.highlights.heading}
              </motion.h2>
              <motion.p
                variants={rise}
                className="mt-6 max-w-[48ch] font-body text-[16px] leading-[1.7] text-content/70"
              >
                {d.highlights.body}
              </motion.p>
              {d.highlights.bigStats?.length > 0 && (
                <motion.div variants={rise} className="mt-10 flex flex-wrap gap-12">
                  {d.highlights.bigStats.map((s, i) => (
                    <div key={`${s.label ?? ''}-${i}`} className="flex flex-col gap-1.5">
                      <CountUp
                        value={s.value}
                        className="numeral text-[2.4rem] leading-none text-content"
                      />
                      <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            {d.highlights.cards?.length > 0 && (
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="show"
                viewport={inViewOnce}
                className="rounded-2xl border border-[var(--color-line)] bg-surface px-7 md:px-8"
              >
                {d.highlights.cards.map((c, i) => (
                  <motion.div
                    key={`${c.title ?? ''}-${i}`}
                    variants={rise}
                    className={`group -mx-4 flex items-start justify-between gap-6 rounded-xl px-4 py-6 transition-colors duration-300 hover:bg-content/4 ${
                      i > 0 ? 'border-t border-dashed border-[var(--color-line)]' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <h3 className="font-display text-[1.15rem] font-bold tracking-[-0.01em] text-content transition-colors duration-300 group-hover:text-accent">
                        {c.title}
                      </h3>
                      <p className="mt-1.5 font-body text-[15px] leading-relaxed text-content/70">
                        {c.body}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className={`grid size-11 shrink-0 place-items-center rounded-xl transition-transform duration-300 ease-brand group-hover:-translate-y-0.5 group-hover:scale-110 ${
                        TILE_TONES[i % TILE_TONES.length]
                      }`}
                    >
                      <HighlightIcon title={c.title} />
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>
      )}
      {/* ── Floor plans ──────────────────────────────────────── */}
      {/* A property with a tagged whole-site model gets that instead of the
          per-building tabs below — see SiteModelSection.jsx. The per-building
          path stays exactly as it is for every property that hasn't been
          re-tagged onto a site model yet. */}
      {hasSiteModel(property) ? (
        <section
          data-band="light"
          id="floor-plans"
          className="scroll-mt-24 bg-surface-alt px-gutter pb-16 pt-8 md:pb-20 md:pt-10"
        >
          <SiteModelSection property={property} />
        </section>
      ) : d?.floorPlans?.buildings?.length > 0 && (
        <section
          data-band="light"
          id="floor-plans"
          className="scroll-mt-24 bg-surface-alt px-gutter pb-16 pt-8 md:pb-20 md:pt-10"
        >
          {/* `floorPlans.heading` and `.body` are deliberately not rendered.
              The design opens this section on the figures, and the stat cards
              plus the building tabs already say what it is. The fields remain in
              the CMS and on the record — editing them simply has no effect on
              this page any more. */}

          {/* Four separate cards rather than the joined strip Overview uses.
              These are properties of the building currently selected below, so
              they have to look like they can change when the tab does — a
              welded strip reads as a fixed masthead. `Building No.` is dropped:
              the tabs directly beneath already name the building. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total Area', `${d.floorPlans.buildings[tab].area} sq ft`],
              ['Total Units', d.floorPlans.buildings[tab].units],
              ['Available Units', d.floorPlans.buildings[tab].available],
              ['Parking', d.floorPlans.buildings[tab].parking],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 rounded-2xl border border-[var(--color-line)] bg-surface px-6 py-6 shadow-[0_18px_45px_-38px_rgba(20,28,33,.45)] md:px-7"
              >
                <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/70">
                  {label}
                </span>
                <p className="mt-3 font-display text-[clamp(1.75rem,2.4vw,2.4rem)] font-bold uppercase leading-none tracking-[-0.025em] text-content">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {d.floorPlans.buildings.length > 1 && (
            <div className="mt-4 flex max-w-full justify-start gap-2 overflow-x-auto pb-1">
              {d.floorPlans.buildings.map((b, i) => (
                <button
                  key={b.building}
                  type="button"
                  onClick={() => setTab(i)}
                  aria-pressed={i === tab}
                  className={`min-h-12 shrink-0 rounded-xl border bg-surface px-5 py-3 font-body text-[15px] font-medium shadow-[0_12px_24px_-18px_rgba(20,28,33,.65)] transition-all duration-300 ${
                    i === tab
                      ? 'border-accent text-accent ring-1 ring-accent/20'
                      : 'border-[var(--color-line)] text-content hover:-translate-y-0.5 hover:border-content/30'
                  }`}
                >
                  {b.building}
                </button>
              ))}
            </div>
          )}
          {/* Interactive floor plan, or a placeholder until one is uploaded */}
          <div className="mt-3">
            {d.floorPlans.buildings[tab].planImage ||
            d.floorPlans.buildings[tab].model?.url ||
            d.floorPlans.buildings[tab].unitList?.length ? (
              <FloorPlanSection key={tab} building={d.floorPlans.buildings[tab]} propertyId={property.id} />
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl border border-[var(--color-line)] bg-surface-alt md:h-[380px]">
                <span className="eyebrow text-content/70">
                  Floor plan — {d.floorPlans.buildings[tab].building}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Gateway for growth ───────────────────────────────────
          `bg-bone` / `text-ink` before this: fixed pigments, not role tokens.
          --color-bone is never overridden, so the section stayed a sheet of
          pure white with dark type in *both* themes — a blinding slab midway
          down an otherwise dark page. */}
      {d?.location?.heading && (
        <section data-band="light" className="bg-base px-gutter py-20 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            {/* Image + thumbnails */}
            {gallery.length > 0 && (
              <div className="min-w-0">
                <img
                  src={gallery[galleryMain]}
                  alt=""
                  className="h-[300px] w-full rounded-2xl object-cover md:h-[420px]"
                />
                <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                  {gallery.slice(0, 5).map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGalleryMain(i)}
                      className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border transition-colors ${
                        i === galleryMain ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex min-w-0 flex-col justify-center lg:pl-4">
              <SectionTag>{d.location.eyebrow}</SectionTag>
              <h2 className="mt-6 font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]">
                {d.location.heading}
              </h2>
              <p className="mt-3 font-display text-lg font-bold text-accent">{d.location.sub}</p>
              <p className="mt-6 max-w-[58ch] font-body text-[16px] leading-[1.7] text-content/70">
                {d.location.body}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Established sites gallery — light intermission ────── */}
      {/* No top padding: this continues the section above on the same ground
          rather than starting a new one. */}
      {d?.establishedSites?.heading && gallery.length > 0 && (
        <section data-band="light" className="bg-base px-gutter pb-20 md:pb-28">
          <SectionTag>{t.establishedSitesLabel}</SectionTag>
          <h2 className="mt-6 max-w-[24ch] font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]">
            {d.establishedSites.heading}
          </h2>
          {/* Hovering a card takes it to ~40vw and the other three give up the
              width to pay for it, so nothing is ever covered: the row is a flex
              strip from md up and the hovered card's `flex-grow` goes 1 → 2.6.
              At 2.6 of 5.6 total it takes 46% of the free space, which lands
              between 37vw and 40vw from `lg` to `2xl` — the gaps and gutters
              are fixed pixels, so the share drifts slightly with the viewport.

              The row's height never changes, which is what keeps every card on
              the one baseline: the open card gets wider, not taller.

              The photo scales *inside* the card as it opens. Growing the frame
              alone only uncrops the picture — the zoom is what makes it read as
              the card coming forward.

              Below md it stays the two-column grid: a quarter-width card is
              unusable on a phone and there is no hover there to open it. */}
          <div className="mt-12 grid grid-cols-2 gap-4 md:flex md:h-[26rem] md:gap-5">
            {gallery.slice(0, 4).map((src, i) => (
              <div
                key={i}
                // `flex-grow` is the animated property, not `transform`. Every
                // `scale-*` utility in Tailwind v4 compiles to the standalone
                // `scale:` property rather than into `transform:`, so a
                // `transition-[transform]` on a scaled element animates nothing
                // and the change lands in a single frame.
                className="group overflow-hidden rounded-2xl bg-surface-alt transition-[flex-grow] duration-700 ease-brand motion-reduce:transition-none md:min-w-0 md:flex-1 md:hover:flex-[2.6]"
              >
                <img
                  // 1600 rather than the `card` 1200: open, this is the widest
                  // card on the site, and at 2x on a wide display 1200 is soft.
                  src={sized(src, 1600)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-48 w-full object-cover transition-[scale] duration-700 ease-brand group-hover:scale-[1.06] motion-reduce:transition-none md:h-full"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Ext. Facade photo strip ──────────────────────────── */}
      {/* Dark on purpose, and one of only two bands on this page that are.
          The elevation photographs are the thing being sold and they carry
          far more depth against a near-black ground than against paper — the
          same reason a gallery paints its walls dark behind bright work.
          Deliberately carries no data-band, so the navbar goes light over it. */}
      {d?.extFacade?.length > 0 && (
        <section className="bg-void px-gutter py-20 text-bone md:py-28">
          <SectionTag tone="inv">{t.extFacadeLabel}</SectionTag>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {d.extFacade.map(
              (src, i) =>
                src && (
                  <div key={i} className="group overflow-hidden rounded-2xl bg-carbon">
                    <img
                      src={sized(src, 'card')}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-48 w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] md:h-64"
                    />
                  </div>
                )
            )}
          </div>
        </section>
      )}

      {/* ── Neighborhoods + map ──────────────────────────────── */}
      {d?.neighborhoods?.items?.length > 0 && (
        <section data-band="light" className="bg-surface-alt px-gutter py-20 md:py-28">
          <SectionTag>{t.neighborhoodsLabel}</SectionTag>
          <h2 className="mt-6 font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]">
            {t.neighborhoodsHeading}
          </h2>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            {/* Accordion */}
            <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {d.neighborhoods.items.map((n, i) => {
                const open = i === openArea
                return (
                  <button
                    key={n.name}
                    type="button"
                    onClick={() => setOpenArea(open ? -1 : i)}
                    className="flex w-full flex-col items-start gap-2 py-5 text-left"
                  >
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="font-display text-lg font-bold text-content">{n.name}</span>
                      {/* accent, not the saffron this was: ember is gone from
                          the light system, and it is the only affordance
                          telling you the row opens. */}
                      <span
                        aria-hidden
                        className={`text-accent transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
                      >
                        +
                      </span>
                    </span>
                    {open && n.note && (
                      <span className="max-w-[46ch] font-body text-[15px] leading-[1.7] text-content/70">
                        {n.note}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Map */}
            {d.neighborhoods.mapQuery && (
              <div className="h-[300px] overflow-hidden rounded-2xl border border-[var(--color-line)] md:h-[380px]">
                <iframe
                  title="Location map"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(d.neighborhoods.mapQuery)}&output=embed`}
                  // Google serves a light map and there is no way to ask it for
                  // a dark one, so the inversion is how this used to match a
                  // dark section. Desaturated only on the light ground, where
                  // the map is already the right value, and inverted just in
                  // dark mode — a white rectangle there would be the brightest
                  // thing on the page.
                  className="h-full w-full grayscale dark:invert-[0.92]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Videos ───────────────────────────────────────────── */}
      {d?.videos?.length > 0 && (
        <section data-band="light" className="bg-base px-gutter py-20 md:py-28">
          <SectionTag>{t.videosLabel}</SectionTag>
          <h2 className="mt-6 font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]">
            {t.videosHeading}
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {d.videos.map(
              (v, i) =>
                v.url && (
                  <div
                    key={i}
                    className="relative aspect-video overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface-alt"
                  >
                    <iframe
                      title={`Property video ${i + 1}`}
                      src={youtubeEmbedUrl(v.url)}
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )
            )}
          </div>
        </section>
      )}

      {/* ── Resources ────────────────────────────────────────────
          Last of the content sections, immediately before the closing
          enquiry. These are the take-aways — flyers, rate sheets, the
          Crexi and LoopNet listings — and they belong at the end, once
          the page has made its case. Opening the page on them sent a
          visitor off-site before they had seen the property.

          Split in two, because they were never one kind of thing. A CAP rate
          sheet is the start of an investment conversation; a LoopNet listing
          is a link. Flat and uniform, the four rate sheets were four rows of
          identical grey among nine, and the most valuable items on the page
          were the easiest to miss. Now they lead, carry the building they
          describe and — once figures are published — go to a page on this
          site rather than bouncing the reader to a PDF host. */}
      {d?.resourceLinks?.length > 0 &&
        (() => {
          const buildings = d?.floorPlans?.buildings ?? []
          const links = d.resourceLinks.filter((link) => link?.url && link?.label)
          // A CAP-rate label only counts as one if its building actually
          // exists. Anything unmatched falls through to the ordinary list,
          // which is exactly what it was before this split.
          const rated = []
          const others = []
          for (const link of links) {
            const building = buildingFromResourceLabel(link.label, buildings)
            if (building) rated.push({ link, building })
            else others.push(link)
          }

          return (
            <section data-band="light" className="bg-surface-alt px-gutter py-16 md:py-24">
              <SectionTag>{t.resourcesLabel}</SectionTag>

              {rated.length > 0 && (
                <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rated.map(({ link, building }, i) => {
                    const internal = isInvestmentLinkable(building)
                    const capRate = String(getInvestment(building)?.capRate ?? '').trim()
                    const href = internal
                      ? `/properties/${property.slug}/investment/${buildingSlug(building.building)}`
                      : link.url
                    // Same card either way; only where it goes differs. An
                    // internal route must not be an <a>, or every visit
                    // reloads the SPA and loses the scroll position.
                    const Tag = internal ? Link : 'a'
                    const nav = internal ? { to: href } : { href, target: '_blank', rel: 'noreferrer' }

                    return (
                      <Tag
                        key={`rated-${i}`}
                        {...nav}
                        className="group flex flex-col justify-between gap-6 rounded-2xl border border-[var(--color-line)] bg-surface p-5 transition-colors duration-300 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-content/55">
                              {internal ? 'Investment summary' : 'CAP rate flyer'}
                            </p>
                            <p className="mt-2 font-display text-xl font-bold tracking-[-0.02em] text-content transition-colors duration-300 group-hover:text-accent">
                              {building.building}
                            </p>
                          </div>
                          {/* The yield is the number an investor scans for, so
                              it sits on the card rather than one click in. */}
                          {capRate && (
                            <span className="shrink-0 rounded-full bg-accent/12 px-3 py-1 font-body text-[11px] font-bold uppercase tracking-wide text-accent">
                              {capRate} CAP
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-2 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-content/70 transition-colors duration-300 group-hover:text-accent">
                          {internal ? 'View the figures' : 'Open the flyer'}
                          <span
                            aria-hidden
                            className="transition-transform duration-300 group-hover:translate-x-1"
                          >
                            →
                          </span>
                        </span>
                      </Tag>
                    )
                  })}
                </div>
              )}

              {others.length > 0 && (
                <div
                  className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
                    rated.length > 0 ? 'mt-3' : 'mt-8'
                  }`}
                >
                  {others.map((link, i) => (
                    <a
                      key={`other-${i}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-4 rounded-2xl border border-[var(--color-line)] bg-surface p-4 transition-colors duration-300 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {link.thumbnail ? (
                        <img
                          src={link.thumbnail}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-accent transition-transform duration-300 group-hover:translate-x-0.5">
                          →
                        </span>
                      )}
                      <span className="font-body text-sm font-bold uppercase tracking-[0.1em] text-content transition-colors duration-300 group-hover:text-accent">
                        {link.label}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )
        })()}

      {/* ── CTA ──────────────────────────────────────────────── */}
      {/* ── Closing anchor ───────────────────────────────────────
          The band itself, not a card sitting on one. This was a dark panel
          inset on a ground of almost the same value, separated by a hairline —
          which read as a leftover component rather than the end of the page.
          Full-bleed, it closes the page the way the About page's final band
          does, and it is the second and last of the two dark anchors.

          No data-band, so the navbar keeps its light chrome over it. */}
      <section className="relative overflow-hidden bg-void px-gutter py-24 text-bone md:py-32">
        {/* A single low breath of CG Blue behind the corner the eye leaves
            from. Atmosphere rather than decoration: on a flat near-black this
            wide it is the difference between a closing statement and a slab. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 70% at 100% 100%, rgba(0,115,164,0.22) 0%, rgba(0,115,164,0) 70%)',
          }}
        />

        <div className="relative flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionTag tone="inv">{t.closingLabel}</SectionTag>
            <h2 className="mt-6 max-w-[20ch] font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] md:text-[3rem]">
              {t.closingHeading.replace('{name}', property.name)}
            </h2>
            <p className="mt-5 max-w-[52ch] font-body text-[16px] leading-[1.7] text-bone/70">
              {t.closingParagraph.replace('{soldPct}', soldPct)}
            </p>
          </div>

          {/* PrimePill rather than the accent PillButton: this is the site's
              primary call to action and the one on the page that should look
              like it. Its solid variant is built from fixed pigments — the
              gradient and a white disc — so it is legible on this band in
              either theme, where anything keyed to --color-accent would shift
              underneath it. */}
          <PrimePill
            href="/contact"
            onClick={(e) => {
              e.preventDefault()
              go('/contact')
            }}
          >
            {t.closingCtaLabel}
          </PrimePill>
        </div>
      </section>
    </div>
  )
}
