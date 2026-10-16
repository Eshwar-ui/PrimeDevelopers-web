import { useEffect, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useProperty } from '../context/ContentContext'
import { sized } from '../lib/images'
import { capFigures, capStatus, formatSf, unitLine } from '../lib/capListings'
import { getBuildings, getUnitImages, getUnits } from '../lib/units'
import PrimePill from '../components/PrimePill'
import { CapListingGrid, CapStatusBadge, TenantLogo, useCapListings, useCapListingsSection } from '../components/CapListings'
import { CapContactBand } from './CapListingsPage'

/** The linked unit's own photographs, when the listing names one the CMS knows. */
function useUnitPhotos(property, unitLabel) {
  return useMemo(() => {
    if (!property || !unitLabel) return []
    const key = String(unitLabel).trim().toLowerCase()
    for (const building of getBuildings(property)) {
      const unit = getUnits(building).find((u) => String(u.label ?? '').trim().toLowerCase() === key)
      if (unit) return getUnitImages(unit)
    }
    return []
  }, [property, unitLabel])
}

/**
 * One CAP / NNN deal: the photograph, the tenant, and the figures from the
 * client's sheet — laid out the way the sheet lays them out, so a reader who
 * has seen the flyer finds the same numbers in the same places.
 */
export default function CapListingPage() {
  const { slug } = useParams()
  const section = useCapListingsSection()
  const listings = useCapListings()
  const listing = listings.find((l) => l.slug === slug)
  const property = useProperty(listing?.propertySlug)
  const unitPhotos = useUnitPhotos(property, listing?.unitLabel)

  useEffect(() => {
    if (!listing) return
    const previous = document.title
    document.title = `${listing.tenant}${listing.units ? ` — Unit ${listing.units}` : ''} · CAP & NNN — Prime Developer`
    return () => {
      document.title = previous
    }
  }, [listing])

  // Others at the same address first — the reader is already looking at that
  // site — then the rest, in the admin's order.
  const more = useMemo(() => {
    if (!listing) return []
    const others = listings.filter((l) => l.slug !== listing.slug)
    const same = others.filter((l) => l.address === listing.address)
    return [...same, ...others.filter((l) => l.address !== listing.address)].slice(0, 3)
  }, [listings, listing])

  // An unknown or unpublished slug goes back to the list, not to a 404: these
  // links get forwarded, and a deal that was taken down should still land the
  // reader somewhere useful.
  if (!listing) return <Navigate to="/cap-properties" replace />

  const figures = capFigures(listing)
  const status = capStatus(listing.status)
  const highlights = (listing.highlights ?? []).filter((h) => String(h ?? '').trim())
  const photos = [...new Set([...(listing.photos ?? []), ...unitPhotos].filter(Boolean))].filter((src) => src !== listing.photo)
  const enquire = new URLSearchParams({ source: 'invest', from: `/cap-properties/${listing.slug}` })
  if (listing.units) enquire.set('unit', listing.units)
  if (property?.id) enquire.set('property', property.id)

  return (
    <div>
      <section className="bg-void px-gutter pb-16 pt-28 text-bone md:pb-20 md:pt-36">
        <div className="mx-auto max-w-[1360px]">
          <Link
            to="/cap-properties"
            className="group inline-flex min-h-11 w-fit items-center gap-3 font-body text-[12px] font-bold uppercase tracking-[0.16em] text-bone/70 transition-colors hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bone"
          >
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
            All CAP &amp; NNN listings
          </Link>

          {/* 5 / 7: the sheets put the photograph beside the figures, and the
              figures are what this page is read for, so they take the wider
              column. The photo is portrait — the sheets crop it that way. */}
          <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <div className="relative aspect-[4/5] overflow-hidden rounded-frame border border-[var(--color-line-inv)] bg-white/5">
                {listing.photo && (
                  <img
                    src={sized(listing.photo, 'card')}
                    alt={`${listing.tenant} at ${listing.address}`}
                    fetchPriority="high"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover"
                  />
                )}
                <CapStatusBadge status={listing.status} className="absolute left-5 top-5" />
              </div>
            </div>

            <div className="flex flex-col lg:col-span-7">
              <TenantLogo src={listing.logo} alt={`${listing.tenant} logo`} className="h-20 w-44" />
              <p className={`eyebrow font-body text-[13px] text-ember ${listing.logo ? 'mt-8' : ''}`}>CAP / NNN investment · {status.label}</p>
              <h1 className="mt-3 text-balance font-display font-bold leading-[1.05] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
                {listing.tenant}
              </h1>
              {listing.tagline && <p className="mt-2 font-body text-[16px] text-bone/75">{listing.tagline}</p>}
              {listing.address && <p className="mt-4 font-body text-[15px] text-bone/80">{listing.address}</p>}

              <div className="mt-6 flex flex-wrap gap-2">
                {[unitLine(listing.units), formatSf(listing.sf) && `Total ${formatSf(listing.sf)}`].filter(Boolean).map((chip) => (
                  <span key={chip} className="rounded-full border border-[var(--color-line-inv)] px-4 py-2 font-body text-sm font-bold tabular-nums text-bone">
                    {chip}
                  </span>
                ))}
              </div>

              {figures.length > 0 && (
                /* Wrapping tiles rather than a fixed grid: six figures fill two
                   rows of three, and a deal with fewer stretches its last row
                   instead of leaving an empty cell. */
                <dl className="mt-8 flex flex-wrap gap-px overflow-hidden rounded-2xl border border-bone/15 bg-bone/15">
                  {figures.map(({ key, label, value }) => (
                    <div key={key} className="min-w-[9.5rem] flex-1 basis-[45%] bg-void px-5 py-6 md:basis-[30%]">
                      <dt className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-bone/60">{label}</dt>
                      <dd className="numeral mt-2 font-display font-bold text-bone [font-size:clamp(1.4rem,2vw,1.9rem)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <PrimePill href={`/contact?${enquire.toString()}`}>
                  {listing.status === 'sold' ? 'Ask about similar deals' : 'Enquire about this investment'}
                </PrimePill>
                {listing.flyerUrl && (
                  <PrimePill variant="outline" href={listing.flyerUrl}>
                    Download the flyer
                  </PrimePill>
                )}
                {property && (
                  <Link
                    to={`/properties/${property.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 font-body text-[14px] font-semibold text-accent-soft underline-offset-4 hover:underline"
                  >
                    View {property.name} →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {(listing.summary || highlights.length > 0 || photos.length > 0) && (
        <section data-band="light" className="bg-base px-gutter py-16 text-content md:py-20">
          <div className="mx-auto grid max-w-[1360px] gap-12 lg:grid-cols-12">
            {(listing.summary || highlights.length > 0) && (
              <div className="lg:col-span-5">
                <p className="eyebrow font-body text-[13px] text-content/60">The investment</p>
                {listing.summary && (
                  <p className="mt-5 whitespace-pre-line font-body text-[16px] leading-relaxed text-content/80">{listing.summary}</p>
                )}
                {highlights.length > 0 && (
                  <ul className="mt-6 flex flex-col gap-3">
                    {highlights.map((h) => (
                      <li key={h} className="flex gap-3 font-body text-[15px] leading-relaxed text-content/80">
                        <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-ember" />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {photos.length > 0 && (
              <div className={listing.summary || highlights.length ? 'lg:col-span-7' : 'lg:col-span-12'}>
                <p className="eyebrow font-body text-[13px] text-content/60">The unit</p>
                <div className="mt-5 grid grid-cols-2 gap-3 md:gap-4">
                  {photos.slice(0, 6).map((src, i) => (
                    <img
                      key={src}
                      src={sized(src, 'card')}
                      alt={`${listing.tenant}, photo ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className={`w-full rounded-2xl object-cover ${i === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-[4/3]'}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section data-band="light" className="border-t border-line bg-base px-gutter py-16 text-content md:py-20">
          <div className="mx-auto max-w-[1360px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display font-bold leading-[1.08] tracking-[-0.02em] [font-size:clamp(1.6rem,2.6vw,2.4rem)]">More CAP &amp; NNN listings</h2>
              <Link to="/cap-properties" className="font-body text-[14px] font-semibold text-accent underline-offset-4 hover:underline">
                See all →
              </Link>
            </div>
            <CapListingGrid items={more} className="mt-10" />
          </div>
        </section>
      )}

      <CapContactBand section={section} />
    </div>
  )
}
