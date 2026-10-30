import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowSquareOut, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { STATUS_COPY, TENANTED, unitStatusMeta } from '../lib/unitStatus'
import { formatArea, formatUnitLabel, getUnitImages, unitLabelParts } from '../lib/units'
import { sized } from '../lib/images'



/**
 * A tenant's website as a safe absolute URL, or null.
 *
 * `tenantUrl` is free text an admin types, and two things go wrong if it
 * reaches `href` untouched. A bare "example.com" has no scheme, so the browser
 * resolves it against the current page and opens /properties/example.com — the
 * site's own 404 dressed up as the tenant's website. And a value beginning
 * `javascript:` would execute on click, which turns one CMS field into stored
 * XSS on every property page; only http and https are let through, so a
 * mistyped or hostile value renders as plain text instead of a link.
 */
function externalHref(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  // No scheme at all is the common admin typo, and it is unambiguous: these
  // are always external sites, never paths on this one.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

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
export default function UnitDetailCard({ unit, units = [], totals = null, aspect = null, onEnquire, onSelectUnit = null, maxHeight = '', emptyHint = '', detailsHref = null }) {
  if (!unit) return <EmptyPanel units={units} totals={totals} maxHeight={maxHeight} hint={emptyHint} />

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

  // The header chip already gives the status and the tenant block already
  // names who is in the space, so falling back to STATUS_COPY underneath both
  // of them stated one fact three times — and spent the card's most valuable
  // line doing it. ("Leased" · "TENANT Devi Liquors" · "Currently leased.")
  //
  // The fallback is kept for a unit with no tenant named, where it is the
  // only thing on the card that says what is going on.
  const showsTenant = isTenanted && Boolean(tenant)
  const body =
    unit.description ||
    (tenant && !isTenanted ? tenant : '') ||
    (showsTenant ? '' : STATUS_COPY[unit.status] ?? STATUS_COPY.available)

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface shadow-[0_20px_55px_-40px_rgba(20,28,33,.5)] ${maxHeight}`}>
      <div className="flex items-start justify-between gap-4 px-7 pb-5 pt-8 lg:px-8 lg:pt-9">
        <UnitLabel label={unit.label} />
        <span className={`mt-1 shrink-0 rounded-full px-4 py-2 font-body text-[12px] font-bold ${meta.chip}`}>{meta.label}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 lg:px-8">
        {images.length > 0 && <UnitGallery images={images} label={unit.label} />}

        {/* Directly under the photograph, and above the tenant block and the
            description. These are the figures the visitor clicked the unit to
            read, and they used to sit last — below all three — which on the
            one layout where the card cannot grow, beside a full-height plan,
            put them off the bottom of the screen.

            Two columns rather than the single column this used to collapse to
            at `lg`. A column of one fact per row turned four short values into
            a 400px stack; paired, the whole specification reads at a glance.
            Size keeps the full measure and the display size: it is the number
            every other one is judged against. */}
        {specs.length > 0 && (
          <dl className={`grid grid-cols-2 gap-x-6 gap-y-5 ${images.length > 0 ? 'mt-6' : ''}`}>
            {specs.map(([term, value]) => (
              <div key={term} className={`flex flex-col gap-1.5 ${term === 'Size' ? 'col-span-2' : ''}`}>
                <dt className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">{term}</dt>
                <dd
                  className={`font-display font-bold tracking-[-0.02em] break-words text-content ${
                    term === 'Size' ? 'text-[clamp(1.75rem,2.4vw,2.4rem)] leading-[1.05]' : 'text-lg'
                  }`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {isTenanted && tenant && (
          <TenantBlock
            name={tenant}
            logo={unit.logo}
            url={unit.tenantUrl}
            category={unit.tenantCategory}
            status={unit.status}
          />
        )}

        {body && (
          <p className={`font-body text-[15px] font-semibold leading-relaxed text-content/60 ${images.length > 0 || showsTenant || specs.length > 0 ? 'mt-6' : ''}`}>
            {body}
          </p>
        )}

        {/* The card is a summary squeezed beside the plan; the unit's own page
            has the full gallery, the plan and the rest of the building. */}
        {detailsHref && (
          <Link
            to={detailsHref}
            className="mt-7 inline-flex min-h-11 items-center gap-2 font-body text-[14px] font-bold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Full unit details
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
      {canEnquire ? (
        <div className="mt-auto px-7 pb-7 lg:px-8 lg:pb-8">
          <button type="button" onClick={() => onEnquire(unit)} className="primary-button-flood min-h-14 w-full rounded-full bg-accent px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-colors duration-300 hover:bg-prime-deep dark:text-void">
            Enquire about {formatUnitLabel(unit.label) || 'this unit'}
          </button>
        </div>
      ) : (
        <AlsoAvailable units={units} current={unit} onSelect={onSelectUnit} />
      )}
    </div>
  )
}

/**
 * What to do next on a unit nobody can take.
 *
 * The enquiry button is this card's pinned action, and a let or sold unit has
 * none — so the slot simply collapsed. Beside the 3D plan that is not a small
 * cosmetic gap: PANEL_MAX is a *height*, not a cap, so the card is held to the
 * full height of the viewer whatever is in it, and a sparsely filled let unit
 * ended in several hundred pixels of nothing. (Unit 202 at Centro Plaza is the
 * worst case and not a rare one: size, floor and frontage are all blank in the
 * CMS and its rate is withheld, so the specs list — the card's spine — renders
 * nothing at all.)
 *
 * The empty space was the symptom. The dead end was the problem: someone who
 * clicks a taken unit has just been told the one thing they cannot have, and
 * the card was already being handed every other unit in the building in
 * `units` — then throwing it away the moment anything was selected, showing it
 * only in the empty state that nobody sees twice.
 *
 * So the slot carries the answer to the question the status raises. Three at
 * most: this is the foot of a summary card, not a second listing, and both the
 * plan above and the unit list below still hold the full set.
 */
export function AlsoAvailable({ units = [], current, onSelect }) {
  // Matched on label rather than object identity. The 3D tier rebuilds its
  // unit objects as selection changes, so a reference check would list the
  // open unit back to itself.
  const free = units.filter((unit) => unit.status === 'available' && unit.label !== current?.label)

  // Same hairline the specs list divides on, so the foot reads as the last
  // row of the card rather than as a tray bolted underneath it.
  const shell = 'mt-auto border-t border-[var(--color-line)] px-7 pb-7 pt-6 lg:px-8 lg:pb-8'

  if (free.length === 0) {
    return (
      <div className={shell}>
        <p className="font-body text-[13px] leading-relaxed text-content/55">
          Every unit in this building is taken.{' '}
          <Link
            to="/contact"
            className="font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Talk to us
          </Link>{' '}
          about what is coming up.
        </p>
      </div>
    )
  }

  const shown = free.slice(0, 3)

  return (
    <div className={shell}>
      {/* Set like a spec term, because that is what it is — one more fact
          about where this unit sits, not a new section with its own voice. */}
      <p className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">
        {free.length === 1 ? 'Also available here' : `${free.length} others available here`}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {shown.map((unit) => {
          const size = formatArea(unit.size)
          const inside = (
            <>
              <span className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--color-status-available)]" />
                <span className="truncate font-display text-[15px] font-bold tracking-[-0.02em] text-content">
                  {formatUnitLabel(unit.label)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {size && <span className="font-body text-[13px] tabular-nums text-content/55">{size}</span>}
                {/* Without it the row is a dot and a number on a bordered
                    rectangle, which is what a static list item looks like.
                    Unit 201 has no size in the CMS either, so on that row the
                    caret is the only thing saying it can be clicked. */}
                {onSelect && (
                  <CaretRight
                    aria-hidden
                    weight="bold"
                    className="size-3.5 text-content/35 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                )}
              </span>
            </>
          )

          const shape =
            'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-surface-alt px-4 py-2 text-left'

          // Without a selector to call, the rows are still worth showing —
          // they say what is free — they just are not pretending to be
          // buttons. Both live call sites pass one.
          return onSelect ? (
            <button
              key={unit.label}
              type="button"
              onClick={() => onSelect(unit)}
              className={`${shape} group transition-colors duration-200 hover:border-accent/60 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
            >
              {inside}
            </button>
          ) : (
            <div key={unit.label} className={shape}>
              {inside}
            </div>
          )
        })}
      </div>

      {free.length > shown.length && (
        <p className="mt-3 font-body text-[12px] text-content/45">
          and {free.length - shown.length} more on the plan
        </p>
      )}
    </div>
  )
}

/**
 * The unit number, at a size that fits it.
 *
 * Two things were wrong with rendering the raw label at a fixed
 * clamp(3rem,4vw,4.25rem). A combined suite — "101+102+103+106" — is one
 * unbreakable word, since `+` is not a break opportunity in CSS, so
 * `break-words` had nothing to act on; and as a flex child with no `min-w-0`
 * it could not shrink below that width either. The result ran straight out of
 * the card and was clipped mid-number.
 *
 * So: an explicit `<wbr/>` before each joiner gives the line somewhere to
 * break, `min-w-0` lets the column shrink, and the type steps down as the
 * label grows. A plain "605" keeps the display size it always had — the step
 * only bites on the long combined labels that actually need it.
 */
export function UnitLabel({ label }) {
  const parts = unitLabelParts(label)
  const text = parts.join('+')
  if (!text) return <span className="font-display text-[clamp(3rem,4vw,4.25rem)] font-bold leading-none tracking-[-0.055em] text-content">Unit</span>

  const size =
    text.length <= 5
      ? 'text-[clamp(3rem,4vw,4.25rem)]'
      : text.length <= 9
        ? 'text-[clamp(2.1rem,2.9vw,2.9rem)]'
        : 'text-[clamp(1.5rem,2.1vw,2.1rem)]'

  return (
    <span
      className={`min-w-0 font-display font-bold leading-[1.04] tracking-[-0.04em] text-content [overflow-wrap:anywhere] ${size}`}
    >
      {parts.map((part, i) => (
        <Fragment key={`${part}-${i}`}>
          {part}
          {/* The joiner stays with the number before it and the break comes
              after, so a wrapped label reads "101+102+ / 103+106" rather than
              starting a line on a stray plus sign. */}
          {i < parts.length - 1 && (
            <>
              <span className="px-[0.06em] text-content/35">+</span>
              <wbr />
            </>
          )}
        </Fragment>
      ))}
    </span>
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
export function UnitGallery({ images, label }) {
  const [index, setIndex] = useState(0)

  // Selecting a different unit reuses this component rather than remounting
  // it, so without this the new unit opens on photograph 3 of the old one —
  // or on an index it does not have.
  //
  // Keyed on the contents, not on the array. `images` is built by
  // getUnitImages() during the parent's render, so it is a fresh array every
  // time UnitDetailCard re-renders for any reason at all — and on identity
  // this reset fired on each of them, snapping a visitor on photograph 3 back
  // to the first one whenever anything else on the page updated (toggling
  // "Hide other buildings" was enough). A join is exact here: these lists are
  // a handful of URLs, and two different sets cannot share one signature.
  const signature = images.join('\u0000')
  useEffect(() => setIndex(0), [signature])

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
export function TenantBlock({ name, logo, url, category, status }) {
  const href = externalHref(url)
  const Wrapper = href ? 'a' : 'div'
  const linkProps = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <Wrapper
      {...linkProps}
      className={`mt-5 flex items-center gap-4 rounded-xl border border-[var(--color-line)] bg-surface-alt px-4 py-4 ${
        href ? 'transition-colors duration-200 hover:border-accent/60' : ''
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
      {href && <ArrowSquareOut aria-hidden className="size-4 shrink-0 text-content/45" />}
    </Wrapper>
  )
}

// Beside the plan this space exists whether or not anything is selected, so it
// earns its keep by answering the question a visitor arrives with — how much
// is actually free here — rather than sitting empty until they click.
//
// `totals` overrides the count with figures from elsewhere. Across a whole site
// the unit list undercounts — a combined suite like "201+202+203+204" is one
// row — so the site view passes the tracker's headline totals instead, the
// same ones the hero and overview show.
function EmptyPanel({ units, totals = null, maxHeight = '', hint = '' }) {
  const total = totals?.total ?? units.length
  const available = totals?.available ?? units.filter((unit) => unit.status === 'available').length

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
