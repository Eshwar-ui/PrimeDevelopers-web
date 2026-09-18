import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, CaretLeft, CaretRight, Plus } from '@phosphor-icons/react'
import { useProperty, useSection } from '../context/ContentContext'
import { useSectionNav } from '../hooks/useSectionNav'
import { scrollToElement } from '../lib/scrollToElement'
import { sized } from '../lib/images'
import { hasSiteModel } from '../lib/siteModel'
import { youtubeEmbedUrl } from '../lib/video'
import {
  buildingFromResourceLabel,
  buildingSlug,
  isInvestmentLinkable,
} from '../lib/investment'
import PrimePill from '../components/PrimePill'
import PropertyDetailNav from '../components/PropertyDetailNav'
import FloorPlanSection from '../components/FloorPlanSection'
import SiteModelSection from '../components/SiteModelSection'
import BrochureRequestModal from '../components/BrochureRequestModal'

const SCREEN_SECTION = 'min-h-[100svh] md:min-h-[100dvh]'

function SectionLabel({ children, dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={`h-px w-9 shrink-0 ${dark ? 'bg-accent-soft' : 'bg-accent'}`} />
      <span
        className={`font-body text-[12px] font-bold uppercase tracking-[0.24em] ${
          dark ? 'text-bone/70' : 'text-content/60'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

function Stat({ label, value, tone = 'default', className = '' }) {
  return (
    <div className={`sm:border-l sm:border-line sm:pl-4 sm:first:border-l-0 sm:first:pl-0 ${className}`}>
      <p className={`font-display text-2xl font-bold tracking-[-0.03em] md:text-3xl ${tone === 'accent' ? 'text-accent' : 'text-content'}`}>
        {value}
      </p>
      <p className="mt-1 font-body text-[12px] leading-snug text-content/55">{label}</p>
    </div>
  )
}

function Hero({ property, soldPct, onEnquire, onTour }) {

  return (
    <section className={`relative isolate ${SCREEN_SECTION} overflow-hidden bg-void text-white`}>
      {property.image && (
        <img
          src={sized(property.image, 'full')}
          alt={`${property.name} exterior`}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,18,23,0.94)_0%,rgba(10,18,23,0.68)_42%,rgba(10,18,23,0.18)_100%)]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,18,23,0.92)_0%,transparent_58%)]" />

      <div className={`relative mx-auto flex ${SCREEN_SECTION} max-w-[1560px] flex-col px-gutter pb-8 pt-28 md:pb-12 md:pt-36 md:px-gutter-lg`}>
        <Link
          to="/properties"
          className="group inline-flex min-h-11 w-fit items-center gap-3 font-body text-[12px] font-bold uppercase tracking-[0.14em] text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <ArrowLeft aria-hidden weight="bold" className="size-4 transition-transform duration-300 ease-brand group-hover:-translate-x-1 motion-reduce:transform-none" />
          All properties
        </Link>

        <div className="mt-auto grid gap-12 pb-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-20">
          <div>
            <p className="font-body text-[12px] font-bold uppercase tracking-[0.2em] text-white/65">
              {[property.category, property.address].filter(Boolean).join(' · ')}
            </p>
            <h1 className="mt-5 max-w-[12ch] text-balance font-display text-[clamp(3rem,9vw,7rem)] font-bold leading-[0.9] tracking-[-0.06em]">
              {property.name}
            </h1>
            {property.detail?.tagline && (
              <p className="mt-7 max-w-[42rem] text-pretty font-body text-[16px] leading-[1.7] text-white/75 md:text-[18px]">
                {property.detail.tagline}
              </p>
            )}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onEnquire}
                className="primary-button-flood group inline-flex h-14 items-center gap-4 rounded-full bg-accent py-1.5 pl-7 pr-1.5 font-body text-[14px] font-bold uppercase tracking-[0.05em] text-white transition duration-300 hover:bg-prime-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white dark:text-void"
              >
                Enquire
                <span className="grid size-11 place-items-center rounded-full bg-white text-charcoal"><ArrowUpRight aria-hidden weight="bold" className="size-5" /></span>
              </button>
              <button
                type="button"
                onClick={onTour}
                className="inline-flex min-h-11 items-center font-body text-[13px] font-bold uppercase tracking-[0.12em] text-white/80 underline decoration-white/30 underline-offset-8 transition hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Book a tour
              </button>
            </div>
          </div>

          <aside className="border border-white/25 bg-charcoal/35 p-5 backdrop-blur-md md:p-7">
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Availability today</p>
            <div className="mt-6 grid grid-cols-2 gap-5 border-t border-white/15 pt-5">
              <div>
                <p className="font-display text-2xl font-bold leading-tight tabular-nums text-white md:text-3xl">{property.available > 0 ? property.available : '0'}</p>
                <p className="mt-1.5 font-body text-[11px] text-white/55">{property.available > 0 ? `units available of ${property.buildings || '—'}` : 'Fully reserved'}</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold leading-tight tabular-nums text-white md:text-3xl">{soldPct}%</p>
                <p className="mt-1.5 font-body text-[11px] text-white/55">Reserved to date</p>
              </div>
            </div>
            <p className="mt-6 border-t border-white/15 pt-5 font-body text-[14px] leading-relaxed text-white/65">
              Leasing and purchase enquiries are welcome. We can help you compare the available options.
            </p>
          </aside>
        </div>
      </div>
    </section>
  )
}

function AvailabilityEmptyState({ property, onEnquire }) {
  const reserved = property.available <= 0
  return (
    <div className="grid gap-8 border border-line bg-surface p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
      <div>
        <p className="font-display text-2xl font-bold tracking-[-0.03em] text-content">
          {reserved ? 'Currently fully reserved' : 'Availability is changing'}
        </p>
        <p className="mt-3 max-w-[55ch] font-body text-[16px] leading-relaxed text-content/65">
          {reserved
            ? 'Speak with our team about future releases, comparable properties, and purchase or leasing opportunities.'
            : 'Tell us what your business needs and our team will share the current options, pricing, and next steps.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onEnquire}
        className="min-h-12 rounded-full bg-accent px-6 font-body text-[13px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-prime-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent dark:text-void"
      >
        Ask about availability
      </button>
    </div>
  )
}

function ResourceCard({ resource, propertySlug, building }) {
  const internal = building && isInvestmentLinkable(building)
  const href = internal
    ? `/properties/${propertySlug}/investment/${buildingSlug(building.building)}`
    : resource.url
  const label = internal ? 'View investment details' : resource.label
  const content = (
    <>
      <div>
        <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/50">
          {internal ? 'Investment summary' : 'Property resource'}
        </p>
        <p className="mt-2 font-display text-lg font-bold tracking-[-0.02em] text-content">{building?.building || resource.label}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 font-body text-[12px] font-bold uppercase tracking-[0.1em] text-accent">
        {label}
        <ArrowUpRight aria-hidden weight="bold" className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
      </span>
    </>
  )

  return internal ? (
    <Link to={href} className="group flex min-h-36 flex-col justify-between border border-line bg-surface p-5 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {content}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className="group flex min-h-36 flex-col justify-between border border-line bg-surface p-5 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {content}
    </a>
  )
}

function SectionVisual({ src, alt, label, className = '' }) {
  if (!src) return null

  return (
    <figure className={`group relative isolate overflow-hidden bg-carbon ${className}`}>
      <img
        src={sized(src, 'full')}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.03]"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-transparent opacity-80" />
      {label && <figcaption className="absolute bottom-0 left-0 p-5 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">{label}</figcaption>}
    </figure>
  )
}

export default function PropertyDetailPage() {
  const { slug } = useParams()
  const property = useProperty(slug)
  const t = useSection('property_detail_page')
  const go = useSectionNav()
  const [searchParams] = useSearchParams()
  const [buildingIndex, setBuildingIndex] = useState(0)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [brochureOpen, setBrochureOpen] = useState(false)
  const cancelScroll = useRef(null)

  const buildings = useMemo(() => property?.detail?.floorPlans?.buildings ?? [], [property])
  const detail = property?.detail ?? {}
  const gallery = useMemo(
    () => [...new Set([property?.image, ...(property?.gallery ?? []), ...(detail.extFacade ?? [])].filter(Boolean))],
    [property, detail.extFacade],
  )
  const soldPct = property?.buildings > 0 ? Math.round((property.sold / property.buildings) * 100) : 0

  useEffect(() => {
    if (!property || !buildings.length) return
    const linkedBuilding = searchParams.get('building')
    if (!linkedBuilding) return
    const index = buildings.findIndex(
      (building) => String(building.building).trim().toLowerCase() === linkedBuilding.trim().toLowerCase(),
    )
    if (index >= 0) setBuildingIndex(index)
  }, [buildings, property, searchParams])

  useEffect(() => {
    if (!property) return undefined
    const linkedUnit = searchParams.get('unit')
    const linkedBuilding = searchParams.get('building')
    if ((!linkedUnit && !linkedBuilding) || hasSiteModel(property)) return undefined
    const section = document.getElementById('availability')
    if (!section) return undefined
    cancelScroll.current = scrollToElement(section, { offset: -144 })
    return () => cancelScroll.current?.()
  }, [property, searchParams])

  if (!property) {
    return (
      <section data-band="light" className={`flex ${SCREEN_SECTION} flex-col items-center justify-center gap-5 bg-base px-gutter text-center`}>
        <h1 className="font-display text-3xl font-bold text-content">{t.notFoundHeading}</h1>
        <Link to="/properties" className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-accent hover:text-prime-deep">
          {t.notFoundBackLabel}
        </Link>
      </section>
    )
  }

  const enquire = () => go(`/contact?property=${property.id}&intent=enquiry&from=/properties/${property.slug}`)
  const tour = () => go(`/contact?property=${property.id}&intent=tour&from=/properties/${property.slug}`)
  const activeBuilding = buildings[buildingIndex]
  const spaceCards = detail.highlights?.cards ?? []
  const resourceLinks = (detail.resourceLinks ?? []).filter((resource) => resource?.url && resource?.label)
  const ratedResources = resourceLinks
    .map((resource) => ({ resource, building: buildingFromResourceLabel(resource.label, buildings) }))
    .filter(({ building }) => building)
  const otherResources = resourceLinks.filter((resource) => !buildingFromResourceLabel(resource.label, buildings))

  return (
    <div className="bg-base text-content">
      <Hero property={property} soldPct={soldPct} onEnquire={enquire} onTour={tour} />
      <PropertyDetailNav property={property} onEnquire={enquire} />

      <section id="summary" data-band="light" className={`flex ${SCREEN_SECTION} scroll-mt-[144px] flex-col justify-center border-b border-line bg-base px-gutter py-16 md:px-gutter-lg md:py-24`}>
        <div className="mx-auto grid max-w-[1560px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
          <div>
            <SectionLabel>At a glance</SectionLabel>
            <h2 className="mt-6 max-w-[14ch] text-balance font-display text-[clamp(2.4rem,4vw,4.4rem)] font-bold leading-[0.94] tracking-[-0.055em]">
              Space to make your next move.
            </h2>
            <p className="mt-6 max-w-[36ch] font-body text-[16px] leading-[1.7] text-content/65">
              Flexible commercial space at a visible, connected address.
            </p>
          </div>
          <div className="grid gap-8">
            <SectionVisual src={gallery[1] ?? property.image} alt={`${property.name} exterior and surroundings`} label="The property in context" className="min-h-[18rem] md:min-h-[26rem]" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-7 border-t border-line pt-7 sm:grid-cols-4">
              <Stat label="Available units" value={property.available || 'None'} tone="accent" />
              <Stat label="Total units" value={property.buildings || 'Not listed'} />
              <Stat label="Reserved" value={`${soldPct}%`} />
              <Stat label="Property type" value={property.category || 'Commercial'} />
            </div>
          </div>
        </div>
      </section>

      <section id="availability" data-band="light" className={`flex ${SCREEN_SECTION} flex-col justify-center scroll-mt-[144px] bg-surface-alt px-gutter py-16 md:px-gutter-lg md:py-24`}>
        <div className="mx-auto max-w-[1560px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <SectionLabel>Lease or buy</SectionLabel>
              <h2 className="mt-5 max-w-[18ch] text-balance font-display text-[clamp(2.2rem,3.8vw,3.7rem)] font-bold leading-[1] tracking-[-0.045em]">
                Find a space that fits the way you work.
              </h2>
            </div>
            <p className="max-w-[32ch] font-body text-[16px] leading-[1.7] text-content/65">
              Choose a building, then explore the units.
            </p>
          </div>

          <div className="mt-12">
            {hasSiteModel(property) ? (
              <SiteModelSection property={property} />
            ) : buildings.length > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Total area', `${activeBuilding?.area ?? 'Not listed'} sq ft`],
                    ['Total units', activeBuilding?.units ?? 'Not listed'],
                    ['Available', activeBuilding?.available ?? 'Not listed'],
                    ['Parking', activeBuilding?.parking ?? 'Ask the team'],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-line bg-surface p-5 md:p-6">
                      <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/50">{label}</p>
                      <p className="mt-3 font-display text-2xl font-bold tracking-[-0.03em] text-content">{value}</p>
                    </div>
                  ))}
                </div>
                {buildings.length > 1 && (
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Choose a building">
                    {buildings.map((building, index) => (
                      <button
                        key={building.building}
                        type="button"
                        onClick={() => setBuildingIndex(index)}
                        aria-pressed={buildingIndex === index}
                        className={`min-h-11 shrink-0 rounded-full border px-5 font-body text-[13px] font-bold uppercase tracking-[0.1em] transition-colors ${
                          buildingIndex === index
                            ? 'border-accent bg-accent text-white dark:text-void'
                            : 'border-line text-content/60 hover:border-content/35 hover:text-content'
                        }`}
                      >
                        {building.building}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  {activeBuilding?.planImage || activeBuilding?.model?.url || activeBuilding?.unitList?.length ? (
                    <FloorPlanSection key={buildingIndex} building={activeBuilding} propertyId={property.id} />
                  ) : (
                    <AvailabilityEmptyState property={property} onEnquire={enquire} />
                  )}
                </div>
              </>
            ) : (
              <AvailabilityEmptyState property={property} onEnquire={enquire} />
            )}
          </div>
        </div>
      </section>

      {spaceCards.length > 0 && (
        <section id="spaces" data-band="light" className={`flex ${SCREEN_SECTION} flex-col justify-center scroll-mt-[144px] bg-base px-gutter py-16 md:px-gutter-lg md:py-24`}>
          <div className="mx-auto grid max-w-[1560px] gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-16">
            <div className="grid gap-7">
              <div>
                <SectionLabel>Space options</SectionLabel>
                <h2 className="mt-6 max-w-[13ch] text-balance font-display text-[clamp(2.4rem,4vw,4.3rem)] font-bold leading-[0.94] tracking-[-0.055em]">
                  {detail.highlights.heading || 'Built around your business'}
                </h2>
              </div>
              <SectionVisual src={gallery[2] ?? gallery[0] ?? property.image} alt={`${property.name} space exterior`} label="Built for daily use" className="min-h-[18rem] md:min-h-[25rem]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {spaceCards.map((card) => (
                <article key={card.title} className="border border-line bg-surface-alt p-6 md:p-7">
                  <Plus aria-hidden weight="bold" className="size-5 text-accent" />
                  <h3 className="mt-8 font-display text-xl font-bold tracking-[-0.02em] text-content">{card.title}</h3>
                  <p className="mt-3 font-body text-[15px] leading-[1.7] text-content/65">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {detail.overview?.heading && (
        <section id="overview" data-band="light" className={`flex ${SCREEN_SECTION} flex-col justify-center scroll-mt-[144px] bg-surface-alt px-gutter py-16 md:px-gutter-lg md:py-24`}>
          <div className="mx-auto grid max-w-[1560px] gap-10 lg:grid-cols-[0.75fr_0.8fr_1fr] lg:items-center lg:gap-14">
            <div>
              <SectionLabel>Property overview</SectionLabel>
              <h2 className="mt-6 max-w-[13ch] text-balance font-display text-[clamp(2.4rem,4vw,4.3rem)] font-bold leading-[0.94] tracking-[-0.055em]">
                {detail.overview.heading}
              </h2>
            </div>
            <SectionVisual src={gallery[3] ?? gallery[1] ?? property.image} alt={`${property.name} property view`} label="A closer look" className="min-h-[20rem] md:min-h-[28rem]" />
            <div>
              <p className="max-w-[48ch] font-body text-[16px] leading-[1.75] text-content/70">{detail.overview.body}</p>
              {detail.overview.stats?.length > 0 && (
                <div className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
                  {detail.overview.stats.map((stat) => <Stat key={stat.label} label={stat.label} value={stat.value} className="sm:[&:nth-child(3n+1)]:border-l-0 sm:[&:nth-child(3n+1)]:pl-0" />)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {detail.location?.heading && (
        <section id="location" data-band="light" className={`flex ${SCREEN_SECTION} flex-col justify-center scroll-mt-[144px] bg-base px-gutter py-16 md:px-gutter-lg md:py-24`}>
          <div className="mx-auto max-w-[1560px]">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-20">
              <div>
                <SectionLabel>Location</SectionLabel>
                <h2 className="mt-6 max-w-[15ch] text-balance font-display text-[clamp(2.3rem,4vw,4rem)] font-bold leading-[0.98] tracking-[-0.05em]">{detail.location.heading}</h2>
                {detail.location.sub && <p className="mt-5 font-display text-xl font-bold text-accent">{detail.location.sub}</p>}
                <p className="mt-5 max-w-[36ch] font-body text-[16px] leading-[1.75] text-content/65">{detail.location.body}</p>
              </div>
              {detail.neighborhoods?.mapQuery && (
                <div className="min-h-[320px] overflow-hidden border border-line bg-surface-alt md:min-h-[420px]">
                  <iframe
                    title={`${property.name} location map`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(detail.neighborhoods.mapQuery)}&output=embed`}
                    className="h-full min-h-[320px] w-full grayscale md:min-h-[420px] dark:invert-[0.9]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
            {detail.neighborhoods?.items?.length > 0 && (
              <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {detail.neighborhoods.items.map((item) => (
                  <details key={item.name} className="group border-t border-line py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold text-content [&::-webkit-details-marker]:hidden">
                      {item.name}
                      <Plus aria-hidden weight="bold" className="size-4 shrink-0 text-accent transition-transform duration-300 ease-brand group-open:rotate-45 motion-reduce:transition-none" />
                    </summary>
                    {item.note && <p className="mt-3 font-body text-[14px] leading-relaxed text-content/60">{item.note}</p>}
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section id="media" className={`flex ${SCREEN_SECTION} flex-col justify-center scroll-mt-[144px] bg-void px-gutter py-16 text-bone md:px-gutter-lg md:py-24`}>
          <div className="mx-auto max-w-[1560px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <SectionLabel dark>Gallery</SectionLabel>
                <h2 className="mt-6 max-w-[14ch] text-balance font-display text-[clamp(2.3rem,4vw,4rem)] font-bold leading-[0.98] tracking-[-0.05em]">See the property before you visit.</h2>
              </div>
              <p className="max-w-[24ch] font-body text-[15px] leading-[1.7] text-bone/60">Buildings, frontages, and spaces.</p>
            </div>
            <div className="mt-10 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.36fr)]">
              <div className="relative h-[clamp(20rem,60svh,38rem)] overflow-hidden bg-carbon">
                <img src={sized(gallery[galleryIndex], 'full')} alt={`${property.name} view ${galleryIndex + 1}`} loading={galleryIndex === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />
                {gallery.length > 1 && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-[linear-gradient(0deg,rgba(11,18,22,0.75)_0%,transparent_100%)] p-4">
                    <p className="font-body text-[12px] font-bold tabular-nums tracking-[0.12em] text-white/80">
                      {galleryIndex + 1} / {gallery.length}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length)} aria-label="Previous photograph" className="grid size-11 place-items-center rounded-full border border-white/25 bg-void/45 text-white backdrop-blur-md transition-colors hover:border-white/60 hover:bg-void/70">
                        <CaretLeft aria-hidden weight="bold" className="size-4" />
                      </button>
                      <button type="button" onClick={() => setGalleryIndex((i) => (i + 1) % gallery.length)} aria-label="Next photograph" className="grid size-11 place-items-center rounded-full border border-white/25 bg-void/45 text-white backdrop-blur-md transition-colors hover:border-white/60 hover:bg-void/70">
                        <CaretRight aria-hidden weight="bold" className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Wraps below lg so nothing needs scrolling on a phone; a single
                  scrolling column at lg, masked at the foot because the site
                  paints no scrollbars and the rail would otherwise end on a
                  hard edge that reads as the last image. */}
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:h-[clamp(20rem,60svh,38rem)] lg:auto-rows-[8.5rem] lg:grid-cols-1 lg:overflow-y-auto lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]">
                {gallery.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setGalleryIndex(index)}
                    aria-pressed={galleryIndex === index}
                    aria-label={`Show photograph ${index + 1} of ${gallery.length}`}
                    className={`aspect-[4/3] overflow-hidden border transition-opacity duration-300 lg:aspect-auto ${galleryIndex === index ? 'border-accent-soft opacity-100' : 'border-transparent opacity-55 hover:opacity-100'}`}
                  >
                    <img src={sized(image, 'card')} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            {detail.videos?.filter((video) => video?.url).length > 0 && (
              <div className="mt-12 grid gap-4 sm:grid-cols-2">
                {detail.videos.filter((video) => video?.url).map((video, index) => (
                  <div key={video.url} className="aspect-video overflow-hidden bg-carbon">
                    <iframe title={`${property.name} video ${index + 1}`} src={youtubeEmbedUrl(video.url)} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {resourceLinks.length > 0 && (
        <section id="resources" data-band="light" className={`flex ${SCREEN_SECTION} flex-col justify-center scroll-mt-[144px] bg-surface-alt px-gutter py-16 md:px-gutter-lg md:py-24`}>
          <div className="mx-auto grid max-w-[1560px] gap-10 lg:grid-cols-[0.55fr_1.45fr] lg:items-start lg:gap-16">
            <SectionVisual src={gallery[4] ?? gallery[0] ?? property.image} alt={`${property.name} resource preview`} label="Property information" className="min-h-[20rem] md:min-h-[31rem]" />
            <div>
              <SectionLabel>Resources</SectionLabel>
              <h2 className="mt-6 max-w-[13ch] text-balance font-display text-[clamp(2.4rem,4vw,4.3rem)] font-bold leading-[0.94] tracking-[-0.055em]">Keep the details close.</h2>
              {ratedResources.length > 0 && (
                <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ratedResources.map(({ resource, building }) => <ResourceCard key={resource.label} resource={resource} propertySlug={property.slug} building={building} />)}
                </div>
              )}
              {otherResources.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {otherResources.map((resource) => <ResourceCard key={resource.label} resource={resource} propertySlug={property.slug} />)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section data-band="dark" className={`relative flex ${SCREEN_SECTION} flex-col justify-center overflow-hidden border-t border-line-inv bg-void px-gutter py-20 text-bone md:px-gutter-lg md:py-28`}>
        {property.image && <img src={sized(property.image, 'full')} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" />}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,18,22,0.98)_0%,rgba(11,18,22,0.8)_48%,rgba(11,18,22,0.5)_100%)]" />
        <div className="relative mx-auto grid max-w-[1560px] gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-20">
          <div>
            <SectionLabel dark>Next step</SectionLabel>
            <h2 className="mt-6 max-w-[14ch] text-balance font-display text-[clamp(2.5rem,5vw,5rem)] font-bold leading-[0.92] tracking-[-0.055em]">Let’s talk about the right way in.</h2>
            <p className="mt-6 max-w-[34ch] font-body text-[16px] leading-[1.75] text-bone/65">Leasing, buying, or comparing options? Let’s talk.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimePill href="/contact" onClick={(event) => { event.preventDefault(); enquire() }}>Start an enquiry</PrimePill>
            <button type="button" onClick={() => setBrochureOpen(true)} className="min-h-14 rounded-full border border-bone/25 px-7 font-body text-[13px] font-bold uppercase tracking-[0.1em] text-bone transition hover:border-bone/60 hover:bg-bone/5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">Request brochure</button>
          </div>
        </div>
      </section>

      {brochureOpen && <BrochureRequestModal property={property} onClose={() => setBrochureOpen(false)} />}
    </div>
  )
}
