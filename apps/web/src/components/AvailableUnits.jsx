import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Buildings, Camera, MapPin, Ruler, Stack, Tag } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { getBuildings, getUnits, formatArea } from '../lib/units'
import { unitStatusMeta } from '../lib/unitStatus'
import { hasInfoSet } from '../lib/infoSets'
import { sized } from '../lib/images'
import ActionButton from './ActionButton'
import ArrowRight from './ArrowRight'

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

/**
 * The per-unit facts that fit under the description, at most two.
 *
 * These occupy the slot the comp draws as amenity chips ("Ample Parking",
 * "High Visibility"). No amenity field exists on a unit or a property, and
 * inventing one would put an unverified claim about real leasable space on
 * every card — so the slot is filled with what the CMS actually holds per
 * unit instead. That is also the better content: four cards at the same
 * address, with the same photograph and the same fallback sentence, need the
 * fields that *differ* between them, not two more that don't.
 *
 * Both fields are free text in the admin, so a bare value would read as a
 * number with no noun. Numeric-looking input gets the noun; anything else is
 * already prose and is left alone.
 */
const isNumeric = (value) => /^[\d.,\s]+$/.test(String(value ?? '').trim())

function specChips(unit) {
  const chips = []
  const floor = String(unit.floor ?? '').trim()
  const frontage = String(unit.frontage ?? '').trim()

  if (floor) chips.push({ Icon: Stack, text: isNumeric(floor) ? `Floor ${floor}` : floor })
  if (frontage) {
    chips.push({ Icon: Ruler, text: isNumeric(frontage) ? `${frontage} ft frontage` : frontage })
  }
  return chips.slice(0, 2)
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

/**
 * The chip that rides on the photograph — the status badge and "View photos"
 * are the same object in two places, so they are one component.
 *
 * A dark translucent lozenge rather than the solid status fill the leasing map
 * uses: these sit on an uncontrolled photograph, and a saturated green block
 * on a bright sky reads as a sticker rather than as part of the card. The
 * status keeps its colour as a dot, which is all it needs to carry here.
 */
function PhotoChip({ children, className = '', ...props }) {
  const Tag = props.onClick ? 'button' : 'span'
  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' } : {})}
      {...props}
      className={`inline-flex items-center gap-2 rounded-full bg-void/75 px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-bone backdrop-blur-sm ${className}`}
    >
      {children}
    </Tag>
  )
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
            Find your <span className="text-accent">ideal</span> space
          </h2>
          <p className="mt-3 font-body text-[15px] leading-relaxed text-content/70">
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
          <p className="mt-12 text-center font-body text-sm text-content/70">
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
              const chips = specChips(unit)
              // Only a property with a real media set gets the button. Every
              // other slug redirects straight back to its own listing, so the
              // control would promise photographs and deliver the page the
              // visitor is already looking at.
              const hasPhotos = hasInfoSet(property.slug)

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

                    {/* Both chips sit on an uncontrolled photograph. This is
                        the floor under them — without it a pale sky leaves
                        two translucent lozenges with nothing behind them. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/45 via-transparent to-void/30"
                    />

                    <PhotoChip className="absolute left-3 top-3">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: availableMeta.hex }}
                      />
                      {availableMeta.label} now
                    </PhotoChip>

                    {hasPhotos && (
                      <PhotoChip
                        onClick={(e) => {
                          // Stops the card's own navigation: this goes to the
                          // media set, not to the listing.
                          e.stopPropagation()
                          navigate(`${href}/info`)
                        }}
                        className="absolute bottom-3 right-3 outline-none transition-colors duration-200 ease-brand hover:bg-void focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <Camera aria-hidden className="size-3.5 shrink-0" weight="fill" />
                        View photos
                        <span className="sr-only"> of {property.name}</span>
                      </PhotoChip>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {/* Every unit reaching this card has a parsed size —
                            `collectAvailableUnits` drops the ones that don't —
                            so `tierName` and `area` are both guaranteed here. */}
                        <h3 className="font-display text-lg font-bold leading-tight text-content">
                          {tierName}
                        </h3>
                        <p className="mt-0.5 font-body text-[13px] text-content/70">
                          <span className="numeral">{area}</span>
                          {unit.label && (
                            <>
                              <span aria-hidden className="px-1.5 text-content/40">
                                ·
                              </span>
                              <span className="numeral">{unit.label}</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Property-level, so every card in a single-property
                          portfolio carries the same one — which is what the
                          comp draws. It earns its place the moment a second
                          property with a different use enters the list. */}
                      {property.category && (
                        <p className="flex shrink-0 items-center gap-1.5 pt-1 font-body text-[12px] text-content/70">
                          <Buildings aria-hidden className="size-4 shrink-0 text-content/50" />
                          {property.category}
                        </p>
                      )}
                    </div>

                    {property.address && (
                      <p className="flex items-start gap-1.5 font-body text-[13px] leading-relaxed text-content/70">
                        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-content/50" />
                        {property.address}
                      </p>
                    )}

                    <p className="line-clamp-2 font-body text-[13px] leading-relaxed text-content/65">
                      {unit.description || `Flexible space at ${property.name}, ready to move in.`}
                    </p>

                    {chips.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {chips.map(({ Icon, text }) => (
                          <li
                            key={text}
                            className="inline-flex items-center gap-1.5 rounded-full border border-content/20 px-3 py-1.5 font-body text-[12px] text-content/70"
                          >
                            <Icon aria-hidden className="size-3.5 shrink-0 text-content/50" />
                            {text}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto flex flex-col gap-3 pt-2">
                      {/* Kept above the action rather than dropped, as the comp
                          has it: the rate is the one field on this card that
                          reliably differs from the card beside it, and it is
                          what a tenant is scanning for. Guarded, because it is
                          optional in the admin and an empty "Base price" row
                          reads as a price of nothing. */}
                      {unit.rate && (
                        <p className="flex items-center gap-1.5 border-t border-content/10 pt-3 font-body text-[13px] text-content/70">
                          <Tag aria-hidden className="size-4 shrink-0 text-content/50" />
                          Base price
                          <span className="numeral ml-auto font-bold text-content">{unit.rate}</span>
                        </p>
                      )}

                      <ActionButton href={href} onClick={open} className="w-full">
                        Explore unit
                        <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 motion-reduce:transform-none" />
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
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </ActionButton>
          </div>
        )}
      </div>
    </section>
  )
}
