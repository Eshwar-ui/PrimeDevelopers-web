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
  // Use several gallery frames so the overview feels like a property tour
  // rather than a single hero followed by an empty reserved area.
  const overviewImages = gallery.filter((src) => src && src !== property.image).slice(0, 6)
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
      {/* Three full-width blocks stacked down the section: the photography,
          the argument, the figures. Nothing sits beside anything else at the
          top level, so each block gets the whole measure and the eye moves
          straight down — show the place, explain it, then prove it.

          The copy and the figures stand on panels rather than on the section
          ground. They are two objects, and a hairline between them read as one
          continuous column of text. `surface-alt` is the fill because it
          separates from `base` in both themes (#eeeeee on white, #10191f on
          #0b1216); a `surface` panel would have been the same white as the
          ground in light and a raised card only in dark, which is the
          one-idiom-two-themes failure DESIGN.md §1 warns about.

          The figures stay out of the copy block, as they always have: they
          describe the development rather than the frontages above them, and in
          a half-width column at 1024px three unwrappable numerals had ~390px
          and overflowed their own panel. On their own row they have room for a
          fourth. */}
      {d?.overview?.heading && (
        <section id="overview" data-band="light" className="bg-base px-gutter py-20 md:py-28">
          <div className="mx-auto max-w-[1560px]">
            {/* Each photo has its own frame. The lead image spans the first
                two desktop columns, while the remaining views fill the grid
                so no image depends on an absolutely positioned sibling for
                its height. */}
            {overviewImages.length > 0 && (
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="show"
                viewport={inViewOnce}
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {overviewImages.map((image, index) => (
                  <motion.div
                    key={`${image}-${index}`}
                    variants={rise}
                    className={`overflow-hidden rounded-panel border border-line bg-surface-alt ${
                      index === 0 ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2' : ''
                    }`}
                  >
                    <img
                      src={sized(image, index === 0 ? 'full' : 'card')}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={`w-full object-cover transition-transform duration-700 ease-brand hover:scale-[1.04] ${
                        index === 0 ? 'aspect-[4/3] sm:aspect-[16/10]' : 'aspect-[16/9]'
                      }`}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
            {/* The argument and its figures, on one panel under the mosaic.

                They were two panels with a gap between them, which set the
                figures up as a separate object that happened to follow — and
                they are not a separate object: "150,638 SFT" is the evidence
                for the sentence directly above it, and the pill is what the
                whole panel is asking you to do about it. One card with a rule
                across it says that; two cards said the reader had finished
                something and started something else.

                Inside, two parts. The copy runs as two columns — what the place
                is on the left, what that means on the right — split 0.9/1.25
                rather than evenly, because the heading is a two-line statement
                and the body is a paragraph, and an even split leaves the left
                column half empty while squeezing the right one under its
                measure. The body drops to meet the heading's first line when
                there is an eyebrow above it, and sits flush with the heading
                when there isn't; aligned to the eyebrow instead, it floated
                above the sentence it answers. */}
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={inViewOnce}
              className="mt-6 rounded-panel bg-surface-alt px-6 py-10 sm:px-10 md:px-12 md:py-14"
            >
              {/* Three children of one grid rather than a column beside a
                  paragraph, and that is what aligns the two.

                  The eyebrow takes row 1 on its own; the heading and the body
                  share row 2. So the body starts exactly where the heading
                  starts, whatever the eyebrow's height and whatever the
                  heading's clamp has resolved to at this width. It was a
                  `lg:mt-10` guess at that offset before, fitted to one viewport
                  — and since the heading is sized in `vw` and the eyebrow in
                  `px`, the gap it was compensating for changes with the window,
                  so the two texts drifted apart on either side of wherever the
                  guess happened to be right.

                  `mt-4` on both of them, not a `gap-y`: it is the space under
                  the eyebrow on a phone, where this is one column, and inside
                  row 2 it lands on the heading and the body equally and cancels
                  out. Only one `lg:mt-*` is ever written, because two would
                  resolve by stylesheet order rather than by the order they are
                  listed here. */}
              <div className="grid gap-x-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] lg:items-start">
                {d.overview.eyebrow && (
                  <motion.div variants={rise} className="lg:col-start-1 lg:row-start-1">
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
                  className={`max-w-[22ch] text-balance font-display font-bold leading-[1.08] tracking-[-0.02em] text-content [font-size:clamp(1.9rem,3.4vw,3rem)] lg:col-start-1 lg:row-start-2 ${
                    d.overview.eyebrow ? 'mt-4' : ''
                  }`}
                >
                  {d.overview.heading}
                </motion.h2>
                {/* 62ch, not the 34rem this carried: that measure was set when
                    the paragraph ran under the heading in a single column, and
                    in a column of its own it left the text stopping halfway
                    across its own half of the panel. */}
                <motion.p
                  variants={rise}
                  className={`mt-8 max-w-[62ch] font-body text-[17px] leading-[1.75] text-content/70 md:text-[18px] lg:col-start-2 lg:row-start-2 ${
                    d.overview.eyebrow ? 'lg:mt-4' : 'lg:mt-0'
                  }`}
                >
                  {d.overview.body}
                </motion.p>
              </div>

              {/* The figures and the call to action, on one row under a rule,
                  because they make the same argument as the copy above: this is
                  the scale of the place, here is how you ask about it.

                  A hairline rather than the gap between two cards. It divides
                  the panel without breaking it — the two halves stay one
                  object, which is the point of merging them.

                  Ink numerals with quiet labels, and the pill the only
                  saturated mass on the row. The labels were accent blue, which
                  was defensible while the button lived up with the copy — with
                  the two side by side, a dozen blue words next to the one blue
                  thing you can click is a dozen reasons not to notice it.

                  The row renders whether or not there are figures. It was gated
                  on `stats.length` when the pill lived elsewhere; gating it now
                  would take the section's only call to action away with them. */}
              <div className="mt-10 flex flex-col gap-8 border-t border-line pt-8 md:mt-12 md:pt-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
                {/* A divided list at phone width, a single wrapping row from
                    `sm` up.

                    Not a grid. Two columns held three figures as two and then
                    an orphan with half a row of dead space beside it, and the
                    count is CMS copy — three today, two or four as easily, so
                    any fixed column count is one entry away from that same
                    hole. Three across doesn't fit either: at 375px each column
                    is ~93px and "150,638" alone sets 98.

                    So on a phone each figure takes the full width as its own
                    ruled row, numeral against label on one baseline. The rules
                    are what let the two sit apart at opposite edges and still
                    read as a pair, and the rows stay tidy at any number of
                    figures or any length of label. */}
                {d.overview.stats?.length > 0 && (
                  <div className="w-full sm:flex sm:w-auto sm:flex-wrap sm:items-start sm:gap-x-14">
                    {d.overview.stats.map((s, i) => (
                      <motion.div
                        key={`${s.label ?? ''}-${i}`}
                        variants={rise}
                        className="flex min-w-0 items-baseline justify-between gap-5 border-b border-line py-3.5 first:pt-0 last:border-b-0 last:pb-0 sm:block sm:border-b-0 sm:py-0"
                      >
                        <CountUp
                          value={s.value}
                          className="numeral block text-content [font-size:clamp(1.6rem,2.1vw,2.1rem)]"
                        />
                        {/* Right-aligned only while it is sitting opposite the
                            numeral; under it from `sm`, the measure caps it. */}
                        <span className="block max-w-[18ch] text-right font-body text-[13px] leading-snug text-content/60 sm:mt-1.5 sm:text-left">
                          {s.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
                {/* Unconditional. This was gated on `d.overview.flyer`, an
                    unrelated CMS field for a downloadable sheet, so a property
                    whose row simply had no flyer URL lost the section's only
                    call to action — invisible today because the seed sets it to
                    '#', and one blank field away from a persuade section with
                    nothing to click. */}
                {/* Full width on a phone, its drawn width from `sm`. Sitting at
                    its content width under a row of full-width figures, the
                    pill read as a loose object dropped into the corner of the
                    panel rather than as the thing the panel is asking you to
                    do. `justify-between` is what makes the stretched version
                    work: the flood pill is `pl-7 pr-1.5` around a label and a
                    disc, so widening it without it would leave both stranded at
                    the left edge with the rest of the lozenge empty. */}
                <motion.div variants={rise} className="w-full shrink-0 sm:w-fit">
                  <PrimePill
                    href="/contact"
                    className="w-full justify-between sm:w-auto sm:justify-start"
                    onClick={(event) => {
                      event.preventDefault()
                      go(`/contact?property=${property.id}&from=/properties/${property.slug}`)
                    }}
                  >
                    {t.overviewEnquireLabel}
                  </PrimePill>
                </motion.div>
              </div>
            </motion.div>
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
