import { useEffect, useState } from 'react'
import { ArrowSquareOut, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { unitStatusMeta } from '../lib/unitStatus'
import { formatArea, getUnitImages } from '../lib/units'
import { sized } from '../lib/images'

const STATUS_COPY = {
  available: 'Available for lease. Contact our team for pricing and tour availability.',
  leased: 'Currently leased.',
  'coming-soon': 'Coming soon — leasing details available shortly.',
  sold: 'This unit has been sold.',
}

// A unit nobody can lease today still has to be worth reading. These two
// statuses put the tenant at the top of the card rather than treating them as
// a footnote to an availability that no longer exists — for a retail plaza the
// tenant mix *is* the pitch, and a wall of "Currently leased." says nothing
// about the place a prospect is deciding to join.
const TENANTED = new Set(['leased', 'sold'])

// Every tier — 3D viewer, 2D pin plan, DOM unit list — converges on this one
// card, so a copy change or a new field lands everywhere at once and the
// tiers cannot drift into describing the same unit differently.
//
// `maxHeight` is passed when the card sits in the column beside a fixed-height
// plan. The card is a header / scrolling body / pinned action stack either
// way; the cap is what makes the scrolling body do anything, and it keeps a
// long description from pushing the enquiry button past the bottom of the
// plan beside it. Unset — stacked under the plan on narrow screens — the card
// simply grows to its content like any other.
export default function UnitDetailCard({ unit, units = [], aspect = null, onEnquire, maxHeight = '', emptyHint = '' }) {
  if (!unit) return <EmptyPanel units={units} maxHeight={maxHeight} hint={emptyHint} />

  const meta = unitStatusMeta(unit.status)
  const area = formatArea(unit.size)
  const images = getUnitImages(unit)
  const tenant = String(unit.tenant ?? '').trim()
  const isTenanted = TENANTED.has(unit.status)

  // Every row is admin-editable and every row is optional — a blank field is
  // omitted rather than rendered as an empty label, so a sparsely filled unit
  // still reads as finished.
  //
  // The specs are identical across statuses now. A sold unit's size, floor and
  // frontage are the same facts they were the day before it sold, and hiding
  // them made half the inventory look like an error rather than like a let
  // space. Rate is the one exception and is handled below.
  const specs = [
    ['Size', area],
    ['Floor', unit.floor],
    // What the space went for is commercially sensitive once it is gone, and
    // it is also no longer an offer — so it is published only while it is
    // still something a visitor could actually take.
    isTenanted ? null : ['Rate', unit.rate],
    ['Frontage', unit.frontage],
    // Measured off the model rather than typed in, so it appears only once a
    // model is loaded and an orientation is set. Sits with the typed specs
    // because to a tenant it reads as one — which way the shop looks out.
    ['Aspect', aspect],
  ].filter((row) => row && row[1])

  const canEnquire = onEnquire && !isTenanted

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface shadow-[0_20px_55px_-40px_rgba(20,28,33,.5)] ${maxHeight}`}>
      <div className="flex items-start justify-between gap-4 px-7 pb-5 pt-8 lg:px-8 lg:pt-9">
        <span className="font-display text-[clamp(3rem,4vw,4.25rem)] font-bold leading-none tracking-[-0.055em] break-words text-content">{unit.label || 'Unit'}</span>
        <span className={`mt-1 shrink-0 rounded-full px-4 py-2 font-body text-[12px] font-bold ${meta.chip}`}>{meta.label}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 lg:px-8">
        {images.length > 0 && <UnitGallery images={images} label={unit.label} />}

        {isTenanted && tenant && (
          <TenantBlock
            name={tenant}
            logo={unit.logo}
            url={unit.tenantUrl}
            category={unit.tenantCategory}
            status={unit.status}
          />
        )}

        <p className={`font-body text-[15px] font-semibold leading-relaxed text-content/60 ${images.length > 0 || (isTenanted && tenant) ? 'mt-6' : ''}`}>
          {unit.description || (tenant && !isTenanted ? tenant : STATUS_COPY[unit.status] ?? STATUS_COPY.available)}
        </p>

        {specs.length > 0 && (
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[var(--color-line)] pt-7 lg:grid-cols-1">
            {specs.map(([term, value]) => (
              <div key={term} className="flex flex-col gap-1.5">
                <dt className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">{term}</dt>
                <dd className={`font-display font-bold tracking-[-0.02em] break-words text-content ${term === 'Size' ? 'text-[clamp(1.75rem,2.4vw,2.4rem)]' : 'text-lg'}`}>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {canEnquire && (
        <div className="mt-auto px-7 pb-7 lg:px-8 lg:pb-8">
          <button type="button" onClick={() => onEnquire(unit)} className="primary-button-flood min-h-14 w-full rounded-full bg-accent px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-colors duration-300 hover:bg-prime-deep dark:text-void">
            Enquire about {unit.label || 'this unit'}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * The unit's own photographs.
 *
 * One frame at a time rather than a grid: the card is as narrow as 18rem in
 * the column beside the plan, and three thumbnails at that width are three
 * illegible smudges. The dots carry the count, which is the only thing a
 * second photograph needs to announce before someone asks for it.
 */
function UnitGallery({ images, label }) {
  const [index, setIndex] = useState(0)

  // Selecting a different unit reuses this component rather than remounting
  // it, so without this the new unit opens on photograph 3 of the old one —
  // or on an index it does not have.
  useEffect(() => setIndex(0), [images])

  const count = images.length
  const step = (delta) => setIndex((i) => (i + delta + count) % count)
  const current = images[Math.min(index, count - 1)]

  return (
    <div className="mb-2">
      <div className="group relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-surface-alt">
        <img
          src={sized(current, 'card')}
          alt={`Unit ${label || ''}`.trim()}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />

        {count > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => step(-1)} />
            <GalleryArrow side="right" onClick={() => step(1)} />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Photograph ${i + 1} of ${count}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-accent' : 'w-1.5 bg-content/25 hover:bg-content/45'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GalleryArrow({ side, onClick }) {
  const Icon = side === 'left' ? CaretLeft : CaretRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photograph' : 'Next photograph'}
      className={`absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-void/55 text-bone opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-void/75 focus-visible:opacity-100 group-hover:opacity-100 ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      <Icon aria-hidden className="size-4" weight="bold" />
    </button>
  )
}

/**
 * Who is in the space, for a unit that is no longer on offer.
 *
 * Sits above the description rather than in the specs list: on a let unit
 * this is the answer to the question the visitor actually clicked with, and
 * a tenant name buried as the sixth row of a definition list reads as
 * metadata about a vacancy.
 */
function TenantBlock({ name, logo, url, category, status }) {
  const Wrapper = url ? 'a' : 'div'
  const linkProps = url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <Wrapper
      {...linkProps}
      className={`mt-5 flex items-center gap-4 rounded-xl border border-[var(--color-line)] bg-surface-alt px-4 py-4 ${
        url ? 'transition-colors duration-200 hover:border-accent/60' : ''
      }`}
    >
      {logo && (
        <img
          src={sized(logo, 'thumb')}
          alt=""
          loading="lazy"
          className="size-12 shrink-0 rounded-lg bg-white object-contain p-1.5"
        />
      )}
      <div className="min-w-0 flex-1">
        <span className="block font-body text-[10px] font-bold uppercase tracking-[0.16em] text-content/45">
          {status === 'sold' ? 'Owner' : 'Tenant'}
        </span>
        <span className="mt-1 block truncate font-display text-lg font-bold tracking-[-0.02em] text-content">{name}</span>
        {category && <span className="mt-0.5 block truncate font-body text-[13px] text-content/60">{category}</span>}
      </div>
      {url && <ArrowSquareOut aria-hidden className="size-4 shrink-0 text-content/45" />}
    </Wrapper>
  )
}

// Beside the plan this space exists whether or not anything is selected, so it
// earns its keep by answering the question a visitor arrives with — how much
// is actually free here — rather than sitting empty until they click.
function EmptyPanel({ units, maxHeight = '', hint = '' }) {
  const total = units.length
  const available = units.filter((unit) => unit.status === 'available').length

  return (
    <div className={`relative flex min-h-[18rem] flex-col justify-end gap-4 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface px-7 py-8 shadow-[0_20px_55px_-40px_rgba(20,28,33,.5)] ${maxHeight}`}>
      <span aria-hidden className="absolute -right-5 -top-10 font-display text-[8rem] font-bold leading-none text-accent/[0.07]">{available}</span>
      <span className="eyebrow relative text-content/55">Unit details</span>

      {total > 0 && (
        <p className="font-display text-2xl leading-snug font-medium text-content/85">
          {available > 0 ? (
            <>
              <span className="text-accent">{available}</span> of {total}{' '}
              {total === 1 ? 'unit' : 'units'} available
            </>
          ) : (
            <>All {total} {total === 1 ? 'unit' : 'units'} currently leased</>
          )}
        </p>
      )}

      <p className="font-body text-sm leading-relaxed text-content/70">
        {/* Every unit is selectable now, not just the free ones — so the
            instruction says "a unit", and a visitor who taps a let one gets
            its tenant and photographs rather than a dead end.

            `hint` exists because the same panel now sits beside a whole-site
            plan, where there are no units to select yet and the default
            sentence would point at a list that isn't there. */}
        {hint ||
          'Select any unit on the plan — or from the list below — to see its size, floor, availability and who is in it.'}
      </p>
    </div>
  )
}
