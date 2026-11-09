import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Buildings, Camera, MapPin, Ruler, Stack, Tag } from '@phosphor-icons/react'
import { formatArea, formatUnitLabel, getUnitImages, unitPath } from '../lib/units'
import { tierNameFor } from '../lib/unitTiers'
import { unitStatusMeta } from '../lib/unitStatus'
import { hasInfoPage } from '../lib/infoSets'
import { sized } from '../lib/images'
import { coverImage } from '../lib/covers'
import { attachTilt } from '../lib/tilt'
import ActionButton from './ActionButton'
import ArrowRight from './ArrowRight'

// One unit, as a card. The homepage teaser and the unit-wise view of
// /properties both render this, so a unit looks and links the same wherever it
// is met — a row from `collectUnits()` in, a card out.

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

export default function UnitCard({ property, building, unit, sf, className = '' }) {
  const navigate = useNavigate()
  // The card's whole job is to hand the visitor *this* unit, not the property
  // it happens to sit in. The plan section reads both parameters, focuses the
  // building, selects the unit and scrolls itself into view — and falls back
  // to the 2D plan, or to the unit's details alone, for a property with no
  // model.
  const href = unitPath(property.slug, building?.building, unit.label)
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
  // The unit's own photograph wins over the property's. A card for unit 605
  // showing the plaza from the road is the same picture as the three cards
  // beside it; the storefront is what tells them apart.
  const photo = getUnitImages(unit)[0] ?? coverImage(property, 'unitFallback')
  // Only a property with a real media set gets the button. Every other slug
  // redirects straight back to its own listing, so the control would promise
  // photographs and deliver the page the visitor is already looking at.
  const hasPhotos = hasInfoPage(property)

  // The same perspective shift as the homepage property cards (lib/tilt),
  // scaled for a card that is narrow and tall: more side-to-side lean, less
  // vertical, and a shorter photo slide to stay inside the 1.04 hover zoom's
  // headroom on a ~370px photograph.
  const cardRef = useRef(null)
  useEffect(() => attachTilt(cardRef.current, { maxX: 3.5, maxY: 6, shift: 7 }), [])

  return (
    <article
      ref={cardRef}
      data-unit-card
      className={`group flex min-w-0 flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)] ${className}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
        {photo && (
          <img
            src={sized(photo, 'card')}
            alt={!getUnitImages(unit).length ? property.name : `Unit ${unit.label || ''} at ${property.name}`.trim()}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
          />
        )}

        {/* Both chips sit on an uncontrolled photograph. This is the floor
            under them — without it a pale sky leaves two translucent lozenges
            with nothing behind them. */}
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
          {/* "Available now" was the only wording this chip ever had, because
              it was the only status that reached it. With every status here
              the chip says the status and nothing more — "Leased now" would be
              nonsense. */}
          {unit.status === 'available' ? `${meta.label} now` : meta.label}
        </PhotoChip>

        {hasPhotos && (
          <PhotoChip
            onClick={(e) => {
              // Stops the card's own navigation: this goes to the media set,
              // not to the listing.
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
            {/* A unit with no size on file reaches this card rather than being
                dropped, so neither the tier nor the area is guaranteed. The
                heading falls back to the unit's own label — and when it does,
                the line below drops the label rather than printing it
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

          {/* Property-level, so every card in a single-property portfolio
              carries the same one — which is what the comp draws. It earns its
              place the moment a second property with a different use enters
              the list. */}
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
          {/* Kept above the action rather than dropped, as the comp has it: the
              rate is the one field on this card that reliably differs from the
              card beside it, and it is what a tenant is scanning for. Guarded,
              because it is optional in the admin and an empty "Base price" row
              reads as a price of nothing.

              Only while it is still an offer — see the same rule on the detail
              card. What a let space went for is not a price anyone can act
              on. */}
          {unit.rate && (unit.status === 'available' || unit.status === 'coming-soon') && (
            <p className="flex items-center gap-1.5 border-t border-content/10 pt-3 font-body text-[13px] text-content/70">
              <Tag aria-hidden className="size-4 shrink-0 text-content/50" />
              Base price
              <span className="numeral ml-auto font-bold text-content">{unit.rate}</span>
            </p>
          )}

          {/* Label left, arrow disc right: a full-width bar with its content
              huddled in the middle read as a banner, not a control. The disc
              fills white on hover and the arrow slides, so the whole card's
              one action answers the pointer at its point of contact. */}
          <ActionButton href={href} onClick={open} className="w-full justify-between! pr-1.5 pl-5 text-[14px]">
            Explore unit
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-white/15 transition-[background-color,color] duration-200 ease-brand group-hover:bg-white group-hover:text-[#0073a4]"
            >
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </span>
          </ActionButton>
        </div>
      </div>
    </article>
  )
}
