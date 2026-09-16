import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Buildings, Camera, MapPin, Ruler, Stack, Tag } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { getBuildings, getUnits, formatArea, formatUnitLabel, getUnitImages } from '../lib/units'
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
// filters above filter this array, they don't rebuild it.
//
// Every unit, every status. The section used to carry availability alone,
// which meant a plaza that had let well showed four cards out of forty and
// read as an empty portfolio — the opposite of what a full plaza is evidence
// of. A let unit also has the thing an empty one doesn't: a tenant, a trade
// and photographs of the space in use, which is what a prospect weighing the
// unit next door is actually looking for.
//
// A unit with no size on file is still kept, but only ever appears under
// "Overview": the size tiers are a question it cannot answer, and dropping it
// outright hid real inventory over a blank admin field.
//
// `building` rides along because the unit link needs it — unit labels are
// unique only within a building, so a deep link naming "101" alone is
// ambiguous the moment a property has two.
function collectUnits(properties) {
  const rows = []
  for (const property of properties) {
    for (const building of getBuildings(property)) {
      for (const unit of getUnits(building)) {
        rows.push({ property, building, unit, sf: parseSF(unit.size) })
      }
    }
  }
  // Available first, then by size smallest-first within each status. Mixing
  // statuses into one size-ordered list would bury what is actually bookable
  // among what isn't; ordering by status keeps the section selling while the
  // rest stays browsable behind it.
  // Not UNIT_STATUSES' own order, which is the legend's (available, leased,
  // coming-soon, sold). Here the axis is how close a unit is to being
  // takeable, so "coming soon" belongs directly behind "available".
  const ORDER = ['available', 'coming-soon', 'leased', 'sold']
  const rank = (status) => {
    const i = ORDER.indexOf(status)
    return i === -1 ? ORDER.length : i
  }
  return rows.sort((a, b) => rank(a.unit.status) - rank(b.unit.status) || a.sf - b.sf)
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
  const allUnits = useMemo(() => collectUnits(properties), [properties])

  const sizeFiltered = useMemo(() => {
    const test = SIZE_TIERS.find((t) => t.id === tier)?.test ?? (() => true)
    return allUnits.filter((row) => test(row.sf))
  }, [allUnits, tier])

  /**
   * The four cards actually rendered: a round-robin across the statuses
   * present rather than the plain top four.
   *
   * Straight slicing looked right and wasn't: Centro has 20 available units
   * and 47 sold ones, and available sorts first, so the section rendered four
   * available units and no evidence that the other 47 existed. The
   * round-robin leads on availability — it takes the first bucket first — and
   * still puts a let unit on screen, which is what makes the rest of the
   * inventory discoverable at all.
   *
   * This carries more weight now that the status pills are gone: the mix is
   * the only thing telling a visitor the inventory is broader than four
   * vacancies.
   */
  const shown = useMemo(() => {
    const buckets = new Map()
    for (const row of sizeFiltered) {
      if (!buckets.has(row.unit.status)) buckets.set(row.unit.status, [])
      buckets.get(row.unit.status).push(row)
    }

    const queues = [...buckets.values()]
    const picked = []
    for (let round = 0; picked.length < TEASER_COUNT; round += 1) {
      // Every queue exhausted — fewer units than the cap, which is fine.
      if (queues.every((q) => round >= q.length)) break
      for (const queue of queues) {
        if (round < queue.length && picked.length < TEASER_COUNT) picked.push(queue[round])
      }
    }
    return picked
  }, [sizeFiltered])

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
    {
      scope,
      // Keyed on the property/unit pair, not the unit index alone: with every
      // status in the list, index 0 of two different buildings now collides
      // and the stagger would skip re-running on a filter change.
      dependencies: [
        shown.map((s) => `${s.property.slug}:${s.building?.building}:${s.unit.index}`).join(','),
        tier,
        status,
      ],
      revertOnUpdate: true,
    }
  )

  // No unit anywhere in the portfolio — the same call the other homepage
  // panels make: an empty shell is worse than no section at all.
  if (allUnits.length === 0) return null

  return (
    <section
      data-band="light"
      ref={scope}
      aria-labelledby="available-units-heading"
      className="bg-base px-gutter py-6 text-content"
    >
      <div className="mx-auto max-w-[1560px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
            <span aria-hidden className="h-px w-8 bg-accent/45" />
            Our Units
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
            Filter by size — every unit across the portfolio, including the ones already let.
          </p>
        </div>

        <div
          className="-mx-gutter mt-8 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-gutter pb-2 scroll-px-gutter sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0"
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
            No units match that size right now — try another size, or explore the full list
            below.
          </p>
        ) : (
          /* Was `sm:grid-cols-2 lg:grid-cols-4`, which skipped the three-up
             rung and put the whole jump on one pixel: 400px cards at 1023px
             became 188px at 1024px — a photograph, a name, a size and a price
             at 188px, on exactly the laptop width where the site starts
             reading as a desktop. `auto-fit` spaces the change out instead,
             holding a card at 15rem or better, which is where the name and
             price still sit comfortably on two lines. */
          <div className="-mx-gutter mt-10 grid auto-cols-[85%] grid-flow-col snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain px-gutter py-3 scroll-px-gutter md:mx-0 md:auto-cols-auto md:grid-flow-row md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] md:overflow-visible md:px-0 md:py-0">
            {shown.map(({ property, building, unit, sf }) => {
              // The card's whole job is to hand the visitor *this* unit, not
              // the property it happens to sit in. The plan section reads
              // both parameters, focuses the building, selects the unit and
              // scrolls itself into view — and falls back to the 2D plan, or
              // to the unit's details alone, for a property with no model.
              const href = `/properties/${property.slug}?${new URLSearchParams({
                building: building?.building ?? '',
                unit: unit.label ?? '',
              })}`
              // The media set still hangs off the bare slug.
              const propertyHref = `/properties/${property.slug}`
              const open = (e) => {
                e.preventDefault()
                navigate(href)
              }
              const area = formatArea(unit.size)
              const tierName = tierNameFor(sf)
              const chips = specChips(unit)
              const meta = unitStatusMeta(unit.status)
              // The unit's own photograph wins over the property's. A card
              // for unit 605 showing the plaza from the road is the same
              // picture as the three cards beside it; the storefront is what
              // tells them apart.
              const photo = getUnitImages(unit)[0] ?? property.image
              // Only a property with a real media set gets the button. Every
              // other slug redirects straight back to its own listing, so the
              // control would promise photographs and deliver the page the
              // visitor is already looking at.
              const hasPhotos = hasInfoSet(property.slug)

              return (
                // The building has to be in the key. `unit.index` is the
                // unit's position within *its own* building, so with every
                // building in the list now, unit 6 of B-06 and unit 6 of B-07
                // would collide on one key.
                <article
                  key={`${property.slug}-${building?.building}-${unit.index}`}
                  data-unit-card
                  className="group flex min-w-0 snap-start flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
                    {photo && (
                      <img
                        src={sized(photo, 'card')}
                        alt={photo === property.image ? property.name : `Unit ${unit.label || ''} at ${property.name}`.trim()}
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
                        style={{ backgroundColor: meta.hex }}
                      />
                      {/* "Available now" was the only wording this chip ever
                          had, because it was the only status that reached it.
                          With every status here the chip says the status and
                          nothing more — "Leased now" would be nonsense. */}
                      {unit.status === 'available' ? `${meta.label} now` : meta.label}
                    </PhotoChip>

                    {hasPhotos && (
                      <PhotoChip
                        onClick={(e) => {
                          // Stops the card's own navigation: this goes to the
                          // media set, not to the listing.
                          e.stopPropagation()
                          navigate(`${propertyHref}/info`)
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
                        {/* A unit with no size on file now reaches this card
                            rather than being dropped, so neither the tier nor
                            the area is guaranteed. The heading falls back to
                            the unit's own label — and when it does, the line
                            below drops the label rather than printing it
                            twice. */}
                        <h3 className="font-display text-lg font-bold leading-tight text-content">
                          {tierName ?? (unit.label ? `Unit ${formatUnitLabel(unit.label)}` : 'Unit')}
                        </h3>
                        {(area || (tierName && unit.label)) && (
                          <p className="mt-0.5 font-body text-[13px] text-content/70">
                            {area && <span className="numeral">{area}</span>}
                            {area && tierName && unit.label && (
                              <span aria-hidden className="px-1.5 text-content/40">
                                ·
                              </span>
                            )}
                            {tierName && unit.label && <span className="numeral">{formatUnitLabel(unit.label)}</span>}
                          </p>
                        )}
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
                      {unit.description ||
                        (unit.status === 'available' || unit.status === 'coming-soon'
                          ? `Flexible space at ${property.name}, ready to move in.`
                          : unit.tenant
                            ? `${unit.tenant} at ${property.name}.`
                            : `Part of ${property.name}.`)}
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
                      {/* Only while it is still an offer — see the same
                          rule on the detail card. What a let space went for
                          is not a price anyone can act on. */}
                      {unit.rate && (unit.status === 'available' || unit.status === 'coming-soon') && (
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

        {sizeFiltered.length > TEASER_COUNT && (
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
