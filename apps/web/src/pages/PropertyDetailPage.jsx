import { useState } from 'react'
import { motion } from 'motion/react'
import { useParams, Link } from 'react-router-dom'
import CountUp from '../components/CountUp'
import { rise, stagger, inViewOnce } from '../lib/motion'
import { useProperty } from '../context/ContentContext'
import { useSectionNav } from '../hooks/useSectionNav'
import PillButton from '../components/PillButton'
import PrimePill from '../components/PrimePill'
import SocialIcon from '../components/SocialIcon'
import FloorPlanSection from '../components/FloorPlanSection'
import MaskedHeading from '../components/MaskedHeading'
import { invertedCorner } from '../lib/notch'
import { youtubeEmbedUrl } from '../lib/video'

// Eyebrow section label with the accent dash, matching the site system.
function SectionTag({ children, tone = 'inv' }) {
  const inv = tone === 'inv'
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className={`h-px w-10 shrink-0 ${inv ? 'bg-accent-soft' : 'bg-accent'}`} />
      <span
        className={`font-body text-[13px] font-bold uppercase tracking-[0.28em] ${
          inv ? 'text-bone/80' : 'text-ink/70'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

// The pair that flanks the bay holding the social buttons, so the page white
// steps down into the photograph instead of butting against it. The bay hangs
// from a top edge, so both curves sweep away from the bottom of their square.
const cornerLeft = invertedCorner('0% 100%')
const cornerRight = invertedCorner('100% 100%')

// A faint lattice tucked into each top corner of the hero, dissolving as it
// travels inward. Drawn rather than shipped as an image: two 1px gradients
// repeat into a grid and a radial mask fades it out, so it costs nothing to
// download and re-tints itself from --color-line in either theme — a flat PNG
// would have to be produced twice and would still be wrong at other widths.
const GRID_CELL = '60px'

const cornerGrid = (origin) => {
  const fade = `radial-gradient(circle at ${origin}, #000 0%, rgba(0,0,0,0.5) 45%, transparent 80%)`
  return {
    backgroundImage:
      'linear-gradient(to right, var(--color-line) 1px, transparent 1px),' +
      ' linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
    backgroundSize: `${GRID_CELL} ${GRID_CELL}`,
    maskImage: fade,
    WebkitMaskImage: fade,
  }
}

// Glyphs for the highlight rows. The titles are free text an admin typed, so
// the icon is chosen by what the title says and falls back to a neutral mark —
// a wrong icon reads as a data error, a neutral one reads as a bullet.
const HIGHLIGHT_ICONS = [
  [/\b(expansive|project|size|acre|sq|square|area)\b/i, 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5'],
  [/\b(mezzanine|floor|plan|layout|level)\b/i, 'M3 3h18v18H3zM3 9h18M9 9v12'],
  [/\b(premium|feature|balcon|glass|finish)\b/i, 'M12 3l2.2 5.6L20 10l-4.4 3.4L16.8 19 12 16l-4.8 3 1.2-5.6L4 10l5.8-1.4z'],
  [/\b(traffic|location|road|access|highway|hwy)\b/i, 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  [/\b(park|vehicle|car)\b/i, 'M3 13l2-6h14l2 6v6h-3v-2H6v2H3zM7 16h.01M17 16h.01'],
]
const HIGHLIGHT_FALLBACK = 'M12 4l8 8-8 8-8-8 8-8Z'

// Each row's tile takes a different wash so the column reads as a set of
// distinct facts rather than one repeated badge. Cycled by position, not by
// meaning — the titles are CMS text and carry no category to colour by.
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
  const go = useSectionNav()
  const [tab, setTab] = useState(0)
  const [galleryMain, setGalleryMain] = useState(0)
  const [openArea, setOpenArea] = useState(0)

  if (!property) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-void px-6 text-center">
        <h1 className="font-display text-3xl font-medium text-bone">Property not found</h1>
        <Link to="/properties" className="eyebrow text-accent-soft">
          ← Back to all properties
        </Link>
      </section>
    )
  }

  const d = property.detail
  const gallery = property.gallery ?? []
  // Guarded: a property with no buildings yet would divide 0 by 0 and render
  // "(NaN% currently reserved.)" in the enquiry copy.
  const soldPct = property.buildings > 0 ? Math.round((property.sold / property.buildings) * 100) : 0

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="properties-hero"
        data-band="light"
        // pb is not decoration here: the social buttons straddle the top edge of
        // the photograph below, so they reach up into whatever space this
        // section leaves. With none, they land on the tagline.
        className="relative overflow-hidden bg-surface px-6 pb-16 pt-32 text-center md:px-gutter-lg md:pt-36"
      >
        {/* Anchored to the section's own top corners, which sit under the fixed
            header — the lattice reads as the page's ground showing through
            rather than as a band beneath the navigation. */}
        <span
          aria-hidden
          style={cornerGrid('top left')}
          className="pointer-events-none absolute left-0 top-0 size-[42rem] max-w-[42%]"
        />
        <span
          aria-hidden
          style={cornerGrid('top right')}
          className="pointer-events-none absolute right-0 top-0 size-[42rem] max-w-[42%]"
        />

        {/* Lifted above the lattice; without it the grid paints over the type. */}
        <div className="relative">
          <p className="font-body text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
            {[property.category, property.address].filter(Boolean).join(' · ')}
          </p>

          {/* Same scale as the /properties heading. That page's clamp also
              carries a dvh term because it shares a fixed one-screen fold with
              the band beneath it; nothing here is height-bound, so this one is
              measured on width alone and otherwise matches value for value. */}
          <h1 className="mx-auto mt-5 max-w-[22ch] font-display font-bold leading-[1.03] tracking-tight text-content [font-size:clamp(1.85rem,4.2vw,3.4rem)]">
            <MaskedHeading text={property.name} />
          </h1>

          {d?.tagline && (
            <p className="mx-auto mt-5 max-w-[46rem] font-body text-[17px] leading-relaxed text-content/60">
              {d.tagline}
            </p>
          )}
        </div>
      </section>

      {/* ── Hero photograph, with the socials sitting in a bay cut from its
          top edge. The bay is page-white carried down into the picture, closed
          at both ends by an inverted corner so the join is a curve rather than
          a step — the same idiom the homepage hero uses against its visual. */}
      {property.image && (
        <div data-band="light" className="bg-surface px-6 pb-16 md:px-gutter-lg md:pb-20">
          {/* Two layers, and the split matters: the frame clips its own corners,
              so anything that has to cross the photograph's top edge cannot live
              inside it. The bay is decoration and sits within the clip; the
              buttons are real links and sit outside it, centred on the edge —
              which is the whole reason the bay is cut in the first place. */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-frame bg-surface-alt [--notch-r:var(--radius-notch)]">
              <img
                src={property.image}
                alt={property.name}
                className="h-[300px] w-full object-cover md:h-[460px]"
              />

              {d?.socials?.length > 0 && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-center"
                >
                  <span style={cornerLeft} className="size-(--notch-r) shrink-0" />
                  {/* Held at a set width rather than sized to the buttons: the
                      bay is a shape in the composition, and letting three icons
                      dictate it would shrink the gesture to a tab. */}
                  <span className="h-[58px] w-[min(26rem,60vw)] shrink-0 rounded-b-[36px] bg-surface" />
                  <span style={cornerRight} className="size-(--notch-r) shrink-0" />
                </div>
              )}
            </div>

            {d?.socials?.length > 0 && (
              <div className="absolute inset-x-0 top-0 flex -translate-y-1/2 justify-center gap-3">
                {d.socials.map(
                  (s, i) =>
                    s.url && (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={s.platform}
                        className="flex size-10 items-center justify-center rounded-full border border-[var(--color-line)] bg-surface text-content/70 transition-colors duration-300 hover:border-accent hover:text-accent"
                      >
                        <SocialIcon platform={s.platform} className="size-4" />
                      </a>
                    )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Resource links — flyers, listings, floor plan PDFs ─── */}
      {d?.resourceLinks?.length > 0 && (
        <section className="bg-carbon px-6 py-14 text-bone md:px-[75px] md:py-20">
          <SectionTag>Resources</SectionTag>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.resourceLinks.map(
              (link, i) =>
                link.url &&
                link.label && (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-4 rounded-2xl border border-[var(--color-line-inv)] bg-ink p-4 transition-colors hover:border-bone/25"
                  >
                    {link.thumbnail ? (
                      <img src={link.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-void">
                        <span className="text-ember">→</span>
                      </span>
                    )}
                    <span className="font-body text-sm font-bold uppercase tracking-[0.1em] text-bone transition-colors group-hover:text-accent-soft">
                      {link.label}
                    </span>
                  </a>
                )
            )}
          </div>
        </section>
      )}

      {/* ── Overview ─────────────────────────────────────────── */}
      {d?.overview?.heading && (
        <section data-band="light" className="bg-surface px-6 pb-20 md:px-gutter-lg md:pb-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
            {/* Image collage */}
            {gallery.length >= 3 && (
              <div className="grid grid-cols-2 gap-4">
                <img src={gallery[0]} alt="" className="col-span-2 h-64 w-full rounded-2xl object-cover md:h-80" />
                <img src={gallery[1]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
                <img src={gallery[2]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
              </div>
            )}

            <div className="flex flex-col justify-center">
              {d.overview.eyebrow && (
                <div className="flex items-center gap-4">
                  <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
                  <span className="font-body text-[13px] font-bold uppercase tracking-[0.22em] text-content/70">
                    {d.overview.eyebrow}
                  </span>
                </div>
              )}
              <h2 className="mt-6 font-display font-bold leading-[1.08] tracking-[-0.02em] text-content [font-size:clamp(1.9rem,3.4vw,3rem)]">
                {d.overview.heading}
              </h2>
              <p className="mt-6 max-w-[52ch] font-body text-[16px] leading-[1.7] text-content/60">
                {d.overview.body}
              </p>
              {d.overview.flyer && (
                <div className="mt-8 w-fit">
                  <PrimePill href={d.overview.flyer}>View flyer</PrimePill>
                </div>
              )}

              {/* One bordered strip rather than three cards: these are three
                  readings of a single project, and separating them into boxes
                  invites them to be read as unrelated. The hairlines between
                  come from the container's own background showing through a
                  1px grid gap. */}
              {d.overview.stats?.length > 0 && (
                <div
                  className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)]"
                  style={{ gridTemplateColumns: `repeat(${d.overview.stats.length}, minmax(0,1fr))` }}
                >
                  {d.overview.stats.map((s, i) => (
                    <div
                      key={`${s.label ?? ''}-${i}`}
                      className="flex flex-col gap-1.5 bg-surface px-3 py-6 text-center"
                    >
                      <span className="numeral text-[1.35rem] text-ember">{s.value}</span>
                      <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/45">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Tenants ──────────────────────────────────────────── */}
      {d?.tenants?.length > 0 && (
        <section data-band="light" className="border-y border-[var(--color-line)] bg-surface px-6 py-12 md:px-gutter-lg">
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

      {/* ── Property highlights ───────────────────────────────── */}
      {d?.highlights?.heading && (
        <section data-band="light" className="bg-surface-alt px-6 py-20 md:px-gutter-lg md:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            {/* whileInView rather than animate: this sits well down the page, so
                a mount-time entrance would have played to nobody. `once` — a
                block that re-enters every time it passes reads as a glitch. */}
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={inViewOnce}
            >
              <motion.div variants={rise} className="flex items-center gap-4">
                <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
                <span className="font-body text-[13px] font-bold uppercase tracking-[0.22em] text-content/70">
                  Property Highlights
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
                className="mt-6 max-w-[48ch] font-body text-[16px] leading-[1.7] text-content/60"
              >
                {d.highlights.body}
              </motion.p>
              {d.highlights.bigStats?.length > 0 && (
                <motion.div variants={rise} className="mt-10 flex flex-wrap gap-12">
                  {d.highlights.bigStats.map((s, i) => (
                    <div key={`${s.label ?? ''}-${i}`} className="flex flex-col gap-1.5">
                      {/* .numeral sets tabular figures, which is what stops the
                          label beneath from shivering as the digits change. */}
                      <CountUp
                        value={s.value}
                        className="numeral text-[2.4rem] leading-none text-ember"
                      />
                      <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/45">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            {/* One card holding a list, not a grid of cards. Each row is a
                sentence about the same building, so a dashed rule between them
                reads as a continuation where a gap reads as a change of
                subject. */}
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
                    // A group, not a control: there is nowhere for a click to
                    // go, so the row responds to the pointer without claiming
                    // to be a button. The negative margin lets the tint bleed
                    // past the card's padding so the whole row lights, not a
                    // panel floating inside it.
                    className={`group -mx-4 flex items-start justify-between gap-6 rounded-xl px-4 py-6 transition-colors duration-300 hover:bg-content/4 ${
                      i > 0 ? 'border-t border-dashed border-[var(--color-line)]' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <h3 className="font-display text-[1.15rem] font-bold tracking-[-0.01em] text-content transition-colors duration-300 group-hover:text-accent">
                        {c.title}
                      </h3>
                      <p className="mt-1.5 font-body text-[15px] leading-relaxed text-content/55">
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
      {d?.floorPlans?.buildings?.length > 0 && (
        <section
          data-band="light"
          className="bg-surface px-gutter py-20 md:px-gutter-lg md:py-24"
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['Total Area', `${d.floorPlans.buildings[tab].area} sq ft`],
              ['Total Units', d.floorPlans.buildings[tab].units],
              ['Available Units', d.floorPlans.buildings[tab].available],
              ['Parking', d.floorPlans.buildings[tab].parking],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[var(--color-line)] bg-surface px-6 py-5"
              >
                <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/45">
                  {label}
                </span>
                <p className="mt-2 font-display text-[1.5rem] font-bold tracking-[-0.01em] text-content">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {d.floorPlans.buildings.length > 1 && (
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {d.floorPlans.buildings.map((b, i) => (
                <button
                  key={b.building}
                  type="button"
                  onClick={() => setTab(i)}
                  aria-pressed={i === tab}
                  className={`rounded-xl border px-6 py-3 font-body text-[15px] font-medium transition-colors duration-300 ${
                    i === tab
                      ? 'border-accent text-accent'
                      : 'border-[var(--color-line)] text-content/70 hover:border-content/35 hover:text-content'
                  }`}
                >
                  {b.building}
                </button>
              ))}
            </div>
          )}

          {/* Interactive floor plan, or a placeholder until one is uploaded */}
          <div className="mt-8">
            {d.floorPlans.buildings[tab].planImage ||
            d.floorPlans.buildings[tab].model?.url ||
            d.floorPlans.buildings[tab].unitList?.length ? (
              <FloorPlanSection key={tab} building={d.floorPlans.buildings[tab]} propertyId={property.id} />
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl border border-[var(--color-line)] bg-surface-alt md:h-[380px]">
                <span className="eyebrow text-content/35">
                  Floor plan — {d.floorPlans.buildings[tab].building}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Gateway for growth — light intermission ──────────── */}
      {d?.location?.heading && (
        <section data-band="light" className="bg-bone px-6 py-20 text-ink md:px-[75px] md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            {/* Image + thumbnails */}
            {gallery.length > 0 && (
              <div>
                <img
                  src={gallery[galleryMain]}
                  alt=""
                  className="h-[300px] w-full rounded-2xl object-cover md:h-[420px]"
                />
                <div className="mt-4 flex gap-3">
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

            <div className="flex flex-col justify-center">
              <SectionTag tone="ink">{d.location.eyebrow}</SectionTag>
              <h2 className="mt-6 font-display text-h2 font-light leading-[1.05] tracking-[-0.02em] text-ink">
                {d.location.heading}
              </h2>
              <p className="mt-3 font-display text-lg font-medium text-accent">{d.location.sub}</p>
              <p className="mt-6 max-w-[58ch] font-body text-base leading-relaxed text-muted">
                {d.location.body}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Established sites gallery — light intermission ────── */}
      {d?.establishedSites?.heading && gallery.length > 0 && (
        <section data-band="light" className="bg-bone px-6 pb-20 text-ink md:px-[75px] md:pb-28">
          <SectionTag tone="ink">Established Sites</SectionTag>
          <h2 className="mt-6 max-w-[24ch] font-display text-h2 font-light leading-[1.05] tracking-[-0.02em] text-ink">
            {d.establishedSites.heading}
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {gallery.slice(0, 4).map((src, i) => (
              <div key={i} className="group overflow-hidden rounded-2xl bg-bone-deep">
                <img
                  src={src}
                  alt=""
                  className="h-48 w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0 md:h-56"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Ext. Facade photo strip ──────────────────────────── */}
      {d?.extFacade?.length > 0 && (
        <section className="bg-void px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag>Ext. Facade</SectionTag>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {d.extFacade.map(
              (src, i) =>
                src && (
                  <div key={i} className="overflow-hidden rounded-2xl bg-carbon">
                    <img src={src} alt="" className="h-48 w-full object-cover md:h-56" />
                  </div>
                )
            )}
          </div>
        </section>
      )}

      {/* ── Neighborhoods + map ──────────────────────────────── */}
      {d?.neighborhoods?.items?.length > 0 && (
        <section className="bg-ink px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag>Head by Areas</SectionTag>
          <h2 className="mt-6 font-display text-h2 font-light tracking-[-0.02em]">Neighborhoods</h2>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            {/* Accordion */}
            <div className="divide-y divide-[var(--color-line-inv)] border-y border-[var(--color-line-inv)]">
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
                      <span className="font-display text-lg font-medium text-bone">{n.name}</span>
                      <span className={`text-ember transition-transform ${open ? 'rotate-45' : ''}`}>
                        +
                      </span>
                    </span>
                    {open && n.note && (
                      <span className="max-w-[46ch] font-body text-sm leading-relaxed text-bone/55">
                        {n.note}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Map */}
            {d.neighborhoods.mapQuery && (
              <div className="h-[300px] overflow-hidden rounded-2xl border border-[var(--color-line-inv)] md:h-[380px]">
                <iframe
                  title="Location map"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(d.neighborhoods.mapQuery)}&output=embed`}
                  className="h-full w-full grayscale invert-[0.92]"
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
        <section className="bg-void px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag>YouTube</SectionTag>
          <h2 className="mt-6 font-display text-h2 font-light tracking-[-0.02em]">Videos</h2>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {d.videos.map(
              (v, i) =>
                v.url && (
                  <div
                    key={i}
                    className="relative aspect-video overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-ink"
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

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="bg-void px-6 pb-20 md:px-[75px] md:pb-28">
        <div className="flex flex-col items-start gap-8 rounded-3xl border border-[var(--color-line-inv)] bg-carbon p-10 text-bone md:flex-row md:items-center md:justify-between md:p-14">
          <div>
            <h3 className="font-display text-3xl font-medium leading-[1.05] tracking-[-0.01em] md:text-4xl">
              Interested in {property.name}?
            </h3>
            <p className="mt-3 font-body text-base text-bone/60">
              Talk to our team about availability, pricing, and tours. ({soldPct}% currently reserved.)
            </p>
          </div>
          <PillButton
            href="/contact"
            variant="accent"
            onClick={(e) => {
              e.preventDefault()
              go('/contact')
            }}
          >
            Enquire now
          </PillButton>
        </div>
      </section>
    </div>
  )
}
