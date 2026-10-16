import { useEffect, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useProperty, usePropertiesLoaded } from '../context/ContentContext'
import { sized } from '../lib/images'
import { STATUS_COPY, TENANTED, unitStatusMeta } from '../lib/unitStatus'
import { findUnitBySlugs, formatArea, formatUnitLabel, getUnitImages, getUnits, unitPath } from '../lib/units'
import PrimePill from '../components/PrimePill'
import { TenantBlock, UnitGallery, UnitLabel } from '../components/UnitDetailCard'
import { useCapListings } from '../components/CapListings'

/**
 * One unit, on its own page — everything the floor-plan card shows beside the
 * plan, with room to read it: the full gallery, the building's plan with the
 * unit marked, the rest of the building, and a way to ask about it.
 *
 * Addressed by building and unit label (`/units/building-7/701`), never by
 * index, for the reason `?building=` gives on the property page: indexes move
 * when the admin reorders, and these are links people send.
 */
export default function UnitPage() {
  const { slug, building: buildingParam, unit: unitParam } = useParams()
  const property = useProperty(slug)
  const loaded = usePropertiesLoaded()
  const found = useMemo(() => findUnitBySlugs(property, buildingParam, unitParam), [property, buildingParam, unitParam])
  const capListings = useCapListings()

  const unit = found?.unit
  const building = found?.building
  const label = formatUnitLabel(unit?.label) || 'Unit'

  useEffect(() => {
    if (!unit) return
    const previous = document.title
    document.title = `Unit ${label} — ${building.building} · ${property.name}`
    return () => {
      document.title = previous
    }
  }, [unit, label, building, property])

  // A unit that was renamed or removed sends the visitor to its property
  // rather than to a 404 — the link was to a space at that address.
  // Nothing to decide until the property list is in — see propertiesLoaded.
  if (!loaded) return <div className="min-h-[70vh] bg-void" aria-busy="true" />
  if (!property) return <Navigate to="/properties" replace />
  if (!found) return <Navigate to={`/properties/${slug}`} replace />

  const meta = unitStatusMeta(unit.status)
  const isTenanted = TENANTED.has(unit.status)
  const tenant = String(unit.tenant ?? '').trim()
  const images = getUnitImages(unit)
  const area = formatArea(unit.size)
  const specs = [
    ['Size', area],
    ['Floor', unit.floor],
    // Published only while it is still an offer — see UnitDetailCard.
    isTenanted ? null : ['Rate', unit.rate],
    ['Frontage', unit.frontage],
  ].filter((row) => row && row[1])

  const planHref = `/properties/${property.slug}?${new URLSearchParams({ building: building.building ?? '', unit: unit.label ?? '' })}`
  const enquireHref = `/contact?${new URLSearchParams({
    unit: unit.label ?? '',
    building: building.building ?? '',
    status: unit.status ?? '',
    property: property.id ?? '',
    from: unitPath(property.slug, building.building, unit.label),
  })}`
  const capDeal = capListings.find(
    (l) => l.propertySlug === property.slug && String(l.unitLabel ?? '').trim().toLowerCase() === String(unit.label ?? '').trim().toLowerCase(),
  )
  const neighbours = getUnits(building).filter((u) => u.index !== unit.index)
  const hasPin = building.planImage && !building.model?.url && unit.x != null && unit.y != null

  return (
    <div>
      <section className="bg-void px-gutter pb-16 pt-28 text-bone md:pb-20 md:pt-36">
        <div className="mx-auto max-w-[1360px]">
          <Link
            to={`/properties/${property.slug}`}
            className="group inline-flex min-h-11 w-fit items-center gap-3 font-body text-[12px] font-bold uppercase tracking-[0.16em] text-bone/70 transition-colors hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bone"
          >
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
            {property.name}
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              {images.length > 0 ? (
                <UnitGallery images={images} label={unit.label} />
              ) : (
                // No photographs of this space yet. The property's own photo
                // stands in, captioned as what it is rather than passed off
                // as the unit.
                property.image && (
                  <figure>
                    <img
                      src={sized(property.image, 'card')}
                      alt={property.name}
                      className="aspect-[4/3] w-full rounded-xl border border-[var(--color-line-inv)] object-cover"
                    />
                    <figcaption className="mt-3 font-body text-[13px] text-bone/60">{property.name} — photographs of this unit are on the way.</figcaption>
                  </figure>
                )
              )}
            </div>

            <div className="flex flex-col lg:col-span-5">
              <p className="eyebrow font-body text-[13px] text-accent-soft">
                {building.building} · {property.name}
              </p>
              <h1 className="mt-3 flex flex-wrap items-center gap-4 [--color-content:var(--color-bone)]">
                <UnitLabel label={unit.label} />
                <span className={`rounded-full px-4 py-2 font-body text-[12px] font-bold ${meta.chip}`}>{meta.label}</span>
              </h1>
              {property.address && <p className="mt-4 font-body text-[15px] text-bone/75">{property.address}</p>}

              {isTenanted && tenant && (
                <div className="mt-6">
                  <TenantBlock name={tenant} logo={unit.logo} url={unit.tenantUrl} category={unit.tenantCategory} status={unit.status} />
                </div>
              )}

              <p className="mt-6 font-body text-[16px] leading-relaxed text-bone/80">
                {unit.description || (tenant && !isTenanted ? tenant : STATUS_COPY[unit.status] ?? STATUS_COPY.available)}
              </p>

              {specs.length > 0 && (
                // Wrapping tiles, so one spec fills the row instead of sitting
                // beside an empty cell.
                <dl className="mt-8 flex flex-wrap gap-px overflow-hidden rounded-2xl border border-bone/15 bg-bone/15">
                  {specs.map(([term, value]) => (
                    <div key={term} className="min-w-[9rem] flex-1 basis-[45%] bg-void px-5 py-5">
                      <dt className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-bone/60">{term}</dt>
                      <dd className="mt-2 break-words font-display text-xl font-bold tracking-[-0.02em] text-bone">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {!isTenanted && <PrimePill href={enquireHref}>Enquire about this unit</PrimePill>}
                <Link
                  to={planHref}
                  className="inline-flex min-h-11 items-center gap-2 font-body text-[14px] font-semibold text-accent-soft underline-offset-4 hover:underline"
                >
                  {building.model?.url ? 'See it in 3D' : 'See it on the plan'} →
                </Link>
              </div>

              {capDeal && (
                <Link
                  to={`/cap-properties/${capDeal.slug}`}
                  className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-ember/40 bg-ember/10 px-5 py-4 font-body text-[14px] text-bone transition-colors hover:border-ember"
                >
                  <span>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-ember">CAP / NNN investment</span>
                    This unit is offered with its lease in place
                  </span>
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {(building.planImage || neighbours.length > 0) && (
        <section data-band="light" className="bg-base px-gutter py-16 text-content md:py-20">
          <div className="mx-auto grid max-w-[1360px] gap-12 lg:grid-cols-12">
            {building.planImage && (
              <div className={neighbours.length ? 'lg:col-span-7' : 'lg:col-span-12'}>
                <p className="eyebrow font-body text-[13px] text-content/60">{building.building} plan</p>
                <div className="relative mt-5 overflow-hidden rounded-2xl border border-line bg-surface-alt">
                  <img src={sized(building.planImage, 'card')} alt={`${building.building} floor plan`} loading="lazy" className="block w-full" />
                  {hasPin && (
                    <span
                      aria-label={`Unit ${label}`}
                      style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent px-2.5 py-1 font-body text-[12px] font-bold text-white shadow-lg ring-4 ring-accent/30"
                    >
                      {label}
                    </span>
                  )}
                </div>
              </div>
            )}

            {neighbours.length > 0 && (
              <div className={building.planImage ? 'lg:col-span-5' : 'lg:col-span-12'}>
                <p className="eyebrow font-body text-[13px] text-content/60">Also in {building.building}</p>
                <ul className="mt-5 flex flex-col">
                  {neighbours.map((u) => {
                    const m = unitStatusMeta(u.status)
                    return (
                      <li key={`${u.label}-${u.index}`}>
                        <Link
                          to={unitPath(property.slug, building.building, u.label)}
                          className="flex min-h-14 items-center justify-between gap-4 border-b border-line py-3 font-body text-[15px] text-content transition-colors hover:text-accent"
                        >
                          <span className="min-w-0">
                            <span className="font-bold">Unit {formatUnitLabel(u.label)}</span>
                            {u.tenant && <span className="text-content/60"> · {u.tenant}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            {formatArea(u.size) && <span className="tabular-nums text-content/60">{formatArea(u.size)}</span>}
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${m.pill}`}>{m.label}</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
