import { useState } from 'react'
import { motion } from 'motion/react'
import { useParams, Link } from 'react-router-dom'
import CountUp from '../components/CountUp'
import { rise, stagger, inViewOnce } from '../lib/motion'
import { useProperty, useSection } from '../context/ContentContext'
import { useSectionNav } from '../hooks/useSectionNav'
import PrimePill from '../components/PrimePill'
import FloorPlanSection from '../components/FloorPlanSection'
import SiteModelSection from '../components/SiteModelSection'
import { hasSiteModel } from '../lib/siteModel'
import { sized } from '../lib/images'
import PropertyHero from '../components/PropertyHero'
import { youtubeEmbedUrl } from '../lib/video'

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
  const [tab, setTab] = useState(0)
  const [galleryMain, setGalleryMain] = useState(0)
  const [openArea, setOpenArea] = useState(0)

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
      {d?.overview?.heading && (
        <section id="overview" data-band="light" className="bg-base px-6 py-24 md:px-gutter-lg md:py-36">
          <div className="grid grid-flow-dense gap-6 lg:grid-cols-12 lg:grid-rows-2">
            {/* Image collage */}
            {gallery.length >= 3 && (
              <div className="grid grid-cols-2 gap-3 lg:col-span-7 lg:row-span-2">
                <img src={gallery[0]} alt="" className="col-span-2 h-64 w-full rounded-2xl object-cover md:h-80" />
                <img src={gallery[1]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
                <img src={gallery[2]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
              </div>
            )}

            <div className="flex flex-col justify-center lg:col-span-5 lg:row-span-2 lg:pl-12">
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
              <p className="mt-6 max-w-[52ch] font-body text-[16px] leading-[1.7] text-content/70">
                {d.overview.body}
              </p>
              {d.overview.flyer && (
                <div className="mt-8 w-fit">
                  <PrimePill
                    href="/contact"
                    onClick={(event) => {
                      event.preventDefault()
                      go(`/contact?property=${property.id}&from=/properties/${property.slug}`)
                    }}
                  >
                    {t.overviewEnquireLabel}
                  </PrimePill>
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
                      {/* Ink numeral, accent label — the treatment the homepage
                          stats band uses. Saffron measures about 1.9:1 on this
                          ground and has been dropped from the light system. */}
                      <span className="numeral text-[1.35rem] text-content">{s.value}</span>
                      <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
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
        <section data-band="light" className="border-y border-[var(--color-line)] bg-base px-6 py-16 md:px-gutter-lg">
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
        <section data-band="light" className="bg-surface-alt px-6 pb-8 pt-16 md:px-gutter-lg md:pb-10 md:pt-20">
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
          className="bg-surface-alt px-gutter pb-16 pt-8 md:px-gutter-lg md:pb-20 md:pt-10"
        >
          <SiteModelSection property={property} />
        </section>
      ) : d?.floorPlans?.buildings?.length > 0 && (
        <section
          data-band="light"
          id="floor-plans"
          className="bg-surface-alt px-gutter pb-16 pt-8 md:px-gutter-lg md:pb-20 md:pt-10"
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
        <section data-band="light" className="bg-base px-6 py-20 md:px-gutter-lg md:py-28">
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
        <section data-band="light" className="bg-base px-6 pb-20 md:px-gutter-lg md:pb-28">
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
        <section className="bg-void px-6 py-20 text-bone md:px-gutter-lg md:py-28">
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
        <section data-band="light" className="bg-surface-alt px-6 py-20 md:px-gutter-lg md:py-28">
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
        <section data-band="light" className="bg-base px-6 py-20 md:px-gutter-lg md:py-28">
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
          visitor off-site before they had seen the property. */}
      {d?.resourceLinks?.length > 0 && (
        <section data-band="light" className="bg-surface-alt px-6 py-16 md:px-gutter-lg md:py-24">
          <SectionTag>{t.resourcesLabel}</SectionTag>
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
                    className="group flex items-center gap-4 rounded-2xl border border-[var(--color-line)] bg-surface p-4 transition-colors duration-300 hover:border-accent"
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
                )
            )}
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────── */}
      {/* ── Closing anchor ───────────────────────────────────────
          The band itself, not a card sitting on one. This was a dark panel
          inset on a ground of almost the same value, separated by a hairline —
          which read as a leftover component rather than the end of the page.
          Full-bleed, it closes the page the way the About page's final band
          does, and it is the second and last of the two dark anchors.

          No data-band, so the navbar keeps its light chrome over it. */}
      <section className="relative overflow-hidden bg-void px-6 py-24 text-bone md:px-gutter-lg md:py-32">
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
