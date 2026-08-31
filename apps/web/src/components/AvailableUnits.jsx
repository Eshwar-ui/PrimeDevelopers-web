import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useProperties } from '../context/ContentContext'
import { getBuildings, getUnits, formatArea } from '../lib/units'
import { unitStatusMeta } from '../lib/unitStatus'
import { sized } from '../lib/images'
import ActionButton from './ActionButton'

gsap.registerPlugin(ScrollTrigger)

// Four cards, matching the Properties teaser's own cap (`TEASER_COUNT` there)
// — this is a taste of what's available, not the leasing index. "View all
// properties" is the door to the rest.
const TEASER_COUNT = 4

// `name` is the card-facing size tier — the plain-English label a tenant
// scans for ("Small", "Medium"...) — separate from `label`, the filter
// pill's own wording. `all` carries no `name`: the overview tab shows every
// unit under its own tier, not one shared name.
const SIZE_TIERS = [
  { id: 'all', label: 'Overview', name: null, test: () => true },
  { id: 'xs', label: 'Under 500 SF', name: 'Small', test: (sf) => sf > 0 && sf < 500 },
  { id: 'sm', label: 'Under 1,000 SF', name: 'Medium', test: (sf) => sf >= 500 && sf < 1000 },
  { id: 'md', label: '1,000 – 2,000 SF', name: 'Large', test: (sf) => sf >= 1000 && sf < 2000 },
  { id: 'lg', label: '2,000 – 4,000 SF', name: 'X-Large', test: (sf) => sf >= 2000 && sf < 4000 },
  { id: 'xl', label: '4,000+ SF', name: 'XX-Large', test: (sf) => sf >= 4000 },
]

const tierNameFor = (sf) => SIZE_TIERS.slice(1).find((t) => t.test(sf))?.name ?? null

const parseSF = (size) => {
  const n = Number(String(size ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// Flattened once per render of the property list, not per filter click — the
// tiers above filter this array, they don't rebuild it.
//
// A unit with no size on file is skipped outright. The whole point of this
// section is browsing by square footage, and a card with no square footage
// has nothing to browse by — it would fall back to a bare unit code ("102"),
// which reads as a broken tier rather than as a unit that simply hasn't had
// its size entered in the admin yet.
function collectAvailableUnits(properties) {
  const rows = []
  for (const property of properties) {
    for (const building of getBuildings(property)) {
      for (const unit of getUnits(building)) {
        if (unit.status !== 'available') continue
        const sf = parseSF(unit.size)
        if (sf <= 0) continue
        rows.push({ property, unit, sf })
      }
    }
  }
  // Smallest first, so the teaser reads Small → X-Large the way the section's
  // own filter pills are ordered, rather than in whatever order the CMS
  // happens to store buildings and units.
  return rows.sort((a, b) => a.sf - b.sf)
}

export default function AvailableUnits() {
  const properties = useProperties()
  const navigate = useNavigate()
  const scope = useRef(null)
  const [tier, setTier] = useState('all')

  const allUnits = useMemo(() => collectAvailableUnits(properties), [properties])

  const filtered = useMemo(() => {
    const test = SIZE_TIERS.find((t) => t.id === tier)?.test ?? (() => true)
    return allUnits.filter((row) => test(row.sf))
  }, [allUnits, tier])

  const shown = filtered.slice(0, TEASER_COUNT)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-unit-card]', {
        y: 32,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.1,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: scope.current, start: 'top 78%' },
      })
    },
    { scope, dependencies: [shown.map((s) => s.unit.index).join(','), tier], revertOnUpdate: true }
  )

  // No available unit anywhere in the portfolio — the same call the other
  // homepage panels make: an empty shell is worse than no section at all.
  if (allUnits.length === 0) return null

  const availableMeta = unitStatusMeta('available')

  return (
    <section
      data-band="light"
      ref={scope}
      aria-labelledby="available-units-heading"
      className="bg-base px-gutter py-6 text-content md:px-gutter-lg"
    >
      <div className="mx-auto max-w-[1560px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
            <span aria-hidden className="h-px w-8 bg-accent/45" />
            Available Units
            <span aria-hidden className="h-px w-8 bg-accent/45" />
          </p>
          <h2
            id="available-units-heading"
            className="mt-4 text-balance font-display font-bold leading-[1.1] tracking-[-0.02em] text-content"
            style={{ fontSize: 'clamp(1.7rem, 3vw, 2.5rem)' }}
          >
            Find your ideal space
          </h2>
          <p className="mt-3 font-body text-[15px] leading-relaxed text-content/60">
            Filter by size and see what's ready for your business today.
          </p>
        </div>

        <div
          className="-mx-gutter mt-8 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-gutter pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0"
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
                onClick={() => setTier(t.id)}
                className={`min-h-11 shrink-0 snap-start rounded-full border px-5 font-body text-[13px] font-bold transition-colors duration-200 ease-brand ${
                  isActive
                    ? 'border-accent bg-accent text-white'
                    : 'border-content/20 text-content/70 hover:border-accent hover:text-accent'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {shown.length === 0 ? (
          <p className="mt-12 text-center font-body text-sm text-content/60">
            No units in this range right now — try another size or explore the full list below.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map(({ property, unit, sf }) => {
              const href = `/properties/${property.slug}`
              const open = (e) => {
                e.preventDefault()
                navigate(href)
              }
              const area = formatArea(unit.size)
              const tierName = tierNameFor(sf)

              return (
                <article
                  key={`${property.slug}-${unit.index}`}
                  data-unit-card
                  className="group flex flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
                    {property.image && (
                      <img
                        src={sized(property.image, 'card')}
                        alt={property.name}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
                      />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      {/* Every unit reaching this card has a parsed size —
                          `collectAvailableUnits` drops the ones that don't —
                          so `tierName` and `area` are both guaranteed here. */}
                      <h3 className="font-display text-lg font-bold leading-tight text-content">{tierName}</h3>
                      <p className="mt-0.5 font-body text-[12px] text-content/50">
                        {[area, unit.label].filter(Boolean).join(' · ')}
                      </p>
                    </div>

                    {property.address && (
                      <p className="font-body text-[13px] italic leading-relaxed text-content/60">
                        {property.address}
                      </p>
                    )}

                    <p className="line-clamp-3 font-body text-[13px] leading-relaxed text-content/65">
                      {unit.description || `Flexible space at ${property.name}, ready to move in.`}
                    </p>

                    <div className="mt-auto flex flex-col gap-3 pt-2">
                      {unit.rate && (
                        <p className="font-body text-[13px] text-content/70">
                          Base price <span className="font-bold text-content">{unit.rate}</span>
                        </p>
                      )}

                      <span
                        className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.08em] ${availableMeta.chip}`}
                      >
                        {availableMeta.label} now
                      </span>

                      <ActionButton href={href} onClick={open} className="w-full">
                        Explore unit
                      </ActionButton>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {filtered.length > TEASER_COUNT && (
          <div className="mt-8 flex justify-center">
            <ActionButton tone="ghost" href="/properties">
              View all properties
            </ActionButton>
          </div>
        )}
      </div>
    </section>
  )
}
