import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowSquareOut, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { STATUS_COPY, TENANTED, UNIT_STATUSES, unitStatusMeta } from '../lib/unitStatus'
import { countByStatus, formatArea, formatClearHeight, formatUnitLabel, getUnitImages, unitLabelParts, unitPrices } from '../lib/units'
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
// It is laid out as a spec sheet: the unit's number and status, its photograph
// at the proportions it was taken at, then every fact it has, then who is in
// it, then the actions. One scroll, no tabs — the card is a third of the row
// beside the plan, and a fact one click away is a fact most visitors never
// see. The actions are pinned under the scroll so Enquire is always on screen.
//
// `height` is passed when the card sits in the column beside a fixed-height
// plan, and it is a height, not a cap: the card is the same frame whatever
// unit is open, so the photograph, the figures and the enquiry button sit in
// the same place from one unit to the next instead of the whole column
// resizing on every click. Everything that matters is laid out to fit that
// frame without scrolling — the photograph is a fixed band, the figures are
// fixed rows — and the free-text description gives way, filling what is left
// and fading out (with a link to the unit page) when it runs longer. On a
// short laptop window the photograph band shrinks to its floor next; only
// past that does the body scroll.
// Unset — stacked under the plan on narrow screens — the card simply grows to
// its content like any other.
export default function UnitDetailCard({
  unit,
  units = [],
  totals = null,
  breakdown = null,
  aspect = null,
  buildingLabel = '',
  onEnquire,
  onSelectUnit = null,
  height = '',
  emptyHint = '',
  detailsHref = null,
}) {
  if (!unit) return <EmptyPanel units={units} totals={totals} breakdown={breakdown} height={height} hint={emptyHint} />

  const meta = unitStatusMeta(unit.status)
  const area = formatArea(unit.size)
  const images = getUnitImages(unit)
  const tenant = String(unit.tenant ?? '').trim()
  const isTenanted = TENANTED.has(unit.status)

  // Every row is admin-editable and every row is optional — a blank field is
  // omitted rather than rendered as an empty label, so a sparsely filled unit
  // still reads as finished.
  //
  // The facts are identical across statuses. A sold unit's clear height and
  // frontage are the same facts they were the day before it sold, and hiding
  // them made half the inventory look like an error rather than like a let
  // space. Prices are the exception, and the API decides them: what a space
  // went for is commercially sensitive once it is gone, so a leased or sold
  // unit's price arrives only when the editor ticked "show the price" on it.
  // Whatever arrives is shown.
  //
  // Size is not in this list. It is the one fact a prospect filters on, so it
  // is set apart above the rest.
  const prices = unitPrices(unit)
  const facts = [
    ['Lease price', prices.lease],
    ['Sale price', prices.sale],
    ['Sold price', prices.sold],
    ['Clear height', formatClearHeight(unit.clearHeight)],
    ['Frontage', unit.frontage],
    // Measured off the model rather than typed in, so it appears only once a
    // model is loaded and an orientation is set. Sits with the typed facts
    // because to a tenant it reads as one — which way the shop looks out.
    ['Faces', aspect],
    ['Fronts', unit.facingRoad],
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
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface ${height}`}>
      <div className="shrink-0 px-5 pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <UnitLabel label={unit.label} compact />
          <span className={`mt-0.5 shrink-0 rounded-full px-3 py-1.5 font-body text-[11px] font-bold ${meta.chip}`}>{meta.label}</span>
        </div>

        {/* The way through to the unit's own page — the full gallery, the plan
            and the whole description — sits on the building line, where it
            costs no height and is there for every status. It used to be a
            full-width button at the foot of the body, which is the first thing
            a fixed-height card pushes out of view. */}
        {(buildingLabel || detailsHref) && (
          <div className="mt-2 flex items-center justify-between gap-3">
            {buildingLabel ? (
              <p className="min-w-0 truncate font-body text-[13px] font-semibold text-content/55">{buildingLabel}</p>
            ) : (
              <span />
            )}
            {detailsHref && (
              <Link
                to={detailsHref}
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full font-body text-[12px] font-bold text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Full unit details
                <ArrowRight
                  aria-hidden
                  weight="bold"
                  className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* A flex column so the description alone can give way. Every other
          block keeps its natural height; the description takes what is left
          and fades out when it runs longer. Scrolling is only the last resort,
          for the shortest windows where even the fixed blocks do not fit —
          and `data-lenis-prevent` is what lets that scroll happen at all,
          since Lenis otherwise turns every wheel event here into page scroll. */}
      <div data-lenis-prevent className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-4">
        {/* The band's height is fixed, but it is the second thing to give way
            (after the description) on a short laptop window: it may shrink to
            its floor rather than push the figures under a scrollbar. */}
        {images.length > 0 && (
          <div className={`shrink ${GALLERY_FRAME}`}>
            <UnitGallery images={images} label={unit.label} frameClassName="h-full" />
          </div>
        )}

        {/* Directly under the photograph, and above the tenant block and the
            description: these are the figures the visitor clicked the unit to
            read. Size is set apart at display size — it is the number every
            other one is judged against — and the rest pair up in two columns,
            so four short values read at a glance instead of as a tall stack. */}
        {area && (
          <div
            className={`flex shrink-0 items-baseline justify-between gap-3 border-y border-[var(--color-line)] py-2.5 ${images.length > 0 ? 'mt-4' : ''}`}
          >
            <span className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">Size</span>
            <span className="font-display text-[1.45rem] font-bold leading-none tracking-[-0.02em] text-content">{area}</span>
          </div>
        )}

        {facts.length > 0 && (
          <dl className={`grid shrink-0 grid-cols-2 gap-x-5 gap-y-3 ${area || images.length > 0 ? 'pt-3.5' : ''}`}>
            {facts.map(([term, value]) => (
              <div key={term} className="min-w-0">
                <dt className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">{term}</dt>
                <dd className="mt-0.5 break-words font-display text-[15px] font-semibold text-content">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {isTenanted && tenant && (
          <div className="shrink-0">
            <TenantBlock
              name={tenant}
              logo={unit.logo}
              url={unit.tenantUrl}
              category={unit.tenantCategory}
              status={unit.status}
              compact
            />
          </div>
        )}

        {body && <Description key={body} text={body} href={detailsHref} />}
      </div>

      {canEnquire ? (
        <div className="mt-auto shrink-0 border-t border-[var(--color-line)] px-5 py-4">
          <button
            type="button"
            onClick={() => onEnquire(unit)}
            className="primary-button-flood min-h-12 w-full rounded-full bg-accent px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-colors duration-300 hover:bg-prime-deep dark:text-void"
          >
            Enquire about {formatUnitLabel(unit.label) || 'this unit'}
          </button>
        </div>
      ) : (
        <AlsoAvailable units={units} current={unit} onSelect={onSelectUnit} />
      )}
    </div>
  )
}

// The photograph's band in the card. A fixed height rather than the shape of
// each photograph, so stepping through a unit's pictures — or from one unit to
// the next — never moves the figures underneath. Scaled with the window from
// `lg`, where the card shares the screen's height with the plan beside it: a
// short laptop window gets a shorter band and keeps every figure in view.
//
// `min-h` is an explicit floor so the band can shrink at all: a flex item's
// automatic minimum is its content, which here is the frame's own height.
const GALLERY_FRAME = 'h-52 min-h-[6.5rem] sm:h-60 lg:h-[clamp(7rem,19dvh,12.5rem)]'

/**
 * The unit's free-text description, the one block in the card that gives way.
 *
 * In the fixed-height card it takes whatever height the figures above and the
 * action below leave it. When the text runs longer, its last lines fade out
 * rather than end on a hard cut, and a link to the unit page — where it is
 * printed in full — appears under it. The fade is only applied once the text
 * actually overflows: masked unconditionally, a two-line description would
 * have its last line dimmed for nothing.
 *
 * Outside the fixed card (stacked under the plan on a phone) nothing bounds
 * it, so it never overflows and reads as an ordinary paragraph.
 */
function Description({ text, href }) {
  const boxRef = useRef(null)
  const textRef = useRef(null)
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    const inner = textRef.current
    if (!box || !inner || typeof ResizeObserver === 'undefined') return undefined
    const check = () => setClipped(inner.offsetHeight - box.clientHeight > 1)
    const observer = new ResizeObserver(check)
    observer.observe(box)
    observer.observe(inner)
    check()
    return () => observer.disconnect()
  }, [])

  return (
    // The two-line floor is on the text itself, not the column, so the link
    // that appears under clipped text never eats into it. The fade is a fixed
    // 1.4rem at the foot rather than a share of the height, so at that floor it
    // dims the tail of the second line, not all of it.
    // An explicit floor on the column too: left to `auto`, a flex column's
    // minimum is its content, which is the whole unclipped paragraph.
    <div className={`mt-4 flex flex-1 flex-col ${clipped && href ? 'min-h-[4.55rem]' : 'min-h-[2.9rem]'}`}>
      <div
        ref={boxRef}
        data-lenis-prevent
        className={`min-h-[2.9rem] flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          clipped ? '[mask-image:linear-gradient(to_bottom,#000_calc(100%_-_1.4rem),transparent)]' : ''
        }`}
      >
        <p ref={textRef} className="font-body text-[14px] leading-relaxed text-content/65">
          {text}
        </p>
      </div>
      {clipped && href && (
        <Link
          to={href}
          className="group mt-2 inline-flex shrink-0 items-center gap-1.5 self-start font-body text-[12px] font-bold text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Read the full description
          <ArrowRight aria-hidden weight="bold" className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

/**
 * What to do next on a unit nobody can take.
 *
 * The enquiry button is this card's pinned action, and a let or sold unit has
 * none — so the slot simply collapsed. Beside the 3D plan that is not a small
 * cosmetic gap: PANEL_HEIGHT is a *height*, not a cap, so the card is held to the
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
 * So the slot carries the answer to the question the status raises. Four at
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
  // px-5 / py-4 — the same insets as the card's header and Enquire foot.
  const shell = 'mt-auto shrink-0 border-t border-[var(--color-line)] px-5 py-4'

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

  // Chips that wrap rather than one full-width row each. Three stacked rows
  // were the tallest thing in a taken unit's card — taller than its figures —
  // and in the fixed-height card beside the plan they pushed the tenant and
  // the facts out of view. Two-up chips say the same thing in a third of the
  // height.
  const shown = free.slice(0, 4)

  return (
    <div className={shell}>
      {/* Set like a spec term, because that is what it is — one more fact
          about where this unit sits, not a new section with its own voice. */}
      <p className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">
        {free.length === 1 ? 'Also available here' : `${free.length} others available here`}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {shown.map((unit) => {
          const size = formatArea(unit.size)
          const inside = (
            <>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--color-status-available)]" />
              <span className="min-w-0 truncate font-display text-[14px] font-bold tracking-[-0.02em] text-content">
                {formatUnitLabel(unit.label)}
              </span>
              {size && <span className="shrink-0 font-body text-[12px] tabular-nums text-content/55">{size}</span>}
              {/* Without it the chip is a dot and a number on a bordered
                  pill, which is what a static tag looks like. Unit 201 has no
                  size in the CMS either, so on that chip the caret is the
                  only thing saying it can be clicked. */}
              {onSelect && (
                <CaretRight
                  aria-hidden
                  weight="bold"
                  className="size-3 shrink-0 text-content/35 transition-[color,translate] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                />
              )}
            </>
          )

          const shape =
            'flex min-h-10 max-w-full min-w-0 items-center gap-2 rounded-full border border-[var(--color-line)] bg-surface-alt px-3.5 py-1.5 text-left'

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
        <p className="mt-2.5 font-body text-[12px] text-content/45">
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
 *
 * `compact` is the scale for the detail card beside the plan, which has to fit
 * the photograph, the figures and the enquiry button into one screen height.
 * The number is still the largest thing on the card, one step down from the
 * unit page's heading, and a six-unit suite takes one line there instead of
 * two.
 */
const LABEL_SIZES = {
  page: ['text-[clamp(3rem,4vw,4.25rem)]', 'text-[clamp(2.1rem,2.9vw,2.9rem)]', 'text-[clamp(1.5rem,2.1vw,2.1rem)]'],
  compact: ['text-[clamp(2.5rem,3vw,3.25rem)]', 'text-[clamp(1.85rem,2.2vw,2.35rem)]', 'text-[clamp(1.3rem,1.55vw,1.65rem)]'],
}

export function UnitLabel({ label, compact = false }) {
  const parts = unitLabelParts(label)
  const text = parts.join('+')
  const [short, medium, long] = LABEL_SIZES[compact ? 'compact' : 'page']
  if (!text) return <span className={`font-display font-bold leading-none tracking-[-0.055em] text-content ${short}`}>Unit</span>

  const size = text.length <= 5 ? short : text.length <= 9 ? medium : long

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
 * illegible smudges. The count and the dots carry how many there are, which is
 * the only thing a second photograph needs to announce before someone asks for
 * it.
 *
 * The photograph is shown whole, never cropped. `object-cover` filled a fixed
 * 4:3 frame by cutting the sides off a storefront — the sign, the one thing the
 * photograph is for — and it read as zoomed in. So the frame takes the shape of
 * the photograph instead, within limits: no taller than 4:5, so a portrait shot
 * cannot take the whole card, and no wider than 16:9. Inside those limits the
 * picture fills the frame; beyond them it is contained, and a soft copy of the
 * same photograph fills what is left, so the spare space reads as part of the
 * picture rather than as bars.
 *
 * `frameClassName` fixes the frame's height instead (the detail card passes
 * one). The photograph is still shown whole inside it, over the same soft
 * fill, but the frame no longer changes shape from one photograph to the next,
 * so nothing below it moves. The dots move onto the photograph there, since a
 * row of their own under it is height the card does not have.
 */
export function UnitGallery({ images, label, frameClassName = '' }) {
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

  // Each photograph's own proportions, once it has loaded. 3:2 until then, which
  // is what most of these are, so the frame rarely has to move.
  const [shapes, setShapes] = useState({})

  const count = images.length
  const step = (delta) => setIndex((i) => (i + delta + count) % count)
  const shown = Math.min(index, count - 1)
  const current = images[shown]
  const shape = Math.min(Math.max(shapes[current] ?? 1.5, 0.8), 16 / 9)
  const fixed = Boolean(frameClassName)

  const dots = images.map((src, i) => (
    <button
      key={`${src}-${i}`}
      type="button"
      onClick={() => setIndex(i)}
      aria-label={`Photograph ${i + 1} of ${count}`}
      aria-current={i === shown}
      className={`h-1.5 rounded-full transition-all duration-300 ${
        fixed
          ? i === shown
            ? 'w-5 bg-white'
            : 'w-1.5 bg-white/45 hover:bg-white/75'
          : i === shown
            ? 'w-6 bg-accent'
            : 'w-1.5 bg-content/25 hover:bg-content/45'
      }`}
    />
  ))

  return (
    <div className={fixed ? 'h-full' : undefined}>
      <div
        className={`group relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-surface-alt ${frameClassName}`}
        // Capped, so a portrait photograph on the wide unit page does not run to
        // the height of the screen.
        style={fixed ? undefined : { aspectRatio: shape, maxHeight: '34rem' }}
      >
        <img
          src={sized(current, 'thumb')}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-xl"
        />
        <img
          src={sized(current, 'card')}
          alt={`Unit ${label || ''}`.trim()}
          loading="lazy"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth && naturalHeight) setShapes((known) => ({ ...known, [current]: naturalWidth / naturalHeight }))
          }}
          className="relative size-full object-contain"
        />

        {count > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => step(-1)} />
            <GalleryArrow side="right" onClick={() => step(1)} />
            {fixed ? (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-void/55 px-2.5 py-1.5 backdrop-blur-sm">
                {dots}
              </div>
            ) : (
              <span className="absolute bottom-2 right-2 rounded-full bg-void/70 px-2 py-0.5 font-body text-[10px] font-bold tabular-nums text-bone">
                {shown + 1} / {count}
              </span>
            )}
          </>
        )}
      </div>

      {count > 1 && !fixed && <div className="mt-3 flex items-center justify-center gap-2">{dots}</div>}
    </div>
  )
}

// Shown outright on a touch screen, where there is no hover to reveal them and
// a photograph with no visible way to the next one is a photograph with no
// next one; revealed on hover or focus everywhere else, where they would
// otherwise sit over the picture all the time.
function GalleryArrow({ side, onClick }) {
  const Icon = side === 'left' ? CaretLeft : CaretRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photograph' : 'Next photograph'}
      className={`absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-void/55 text-bone backdrop-blur-sm transition-opacity duration-200 hover:bg-void/75 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0 ${
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
 * Sits above the description rather than in the facts list: on a let unit
 * this is the answer to the question the visitor actually clicked with, and
 * a tenant name buried as the sixth row of a definition list reads as
 * metadata about a vacancy.
 *
 * `compact` trims the insets and the logo for the fixed-height detail card.
 */
export function TenantBlock({ name, logo, url, category, status, compact = false }) {
  const href = externalHref(url)
  const Wrapper = href ? 'a' : 'div'
  const linkProps = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <Wrapper
      {...linkProps}
      className={`flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-surface-alt px-3.5 ${
        compact ? 'mt-4 py-2.5' : 'mt-5 py-3'
      } ${href ? 'transition-colors duration-200 hover:border-accent/60' : ''}`}
    >
      {logo && (
        <img
          src={sized(logo, 'thumb')}
          alt=""
          loading="lazy"
          className={`shrink-0 rounded-lg bg-white object-contain p-1.5 ${compact ? 'size-10' : 'size-11'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <span className="block font-body text-[10px] font-bold uppercase tracking-[0.16em] text-content/45">
          {status === 'sold' ? 'Owner' : 'Tenant'}
        </span>
        <span className="mt-0.5 block truncate font-display text-[16px] font-bold tracking-[-0.02em] text-content">{name}</span>
        {category && <span className="mt-0.5 block truncate font-body text-[13px] text-content/60">{category}</span>}
      </div>
      {href && <ArrowSquareOut aria-hidden className="size-4 shrink-0 text-content/45" />}
    </Wrapper>
  )
}

// Beside the plan this space exists whether or not anything is selected, so it
// earns its keep by answering the question a visitor arrives with — how much
// is actually free here, and how the rest is spoken for — rather than sitting
// empty until they click.
//
// `totals` overrides the headline count with figures from elsewhere. Across a
// whole site the unit list undercounts — a combined suite like
// "201+202+203+204" is one row — so the site view passes the tracker's
// headline totals instead, the same ones the hero and overview show.
// `breakdown` does the same for the rows beneath it, for the same reason.
function EmptyPanel({ units, totals = null, breakdown = null, height = '', hint = '' }) {
  const total = totals?.total ?? units.length
  const available = totals?.available ?? units.filter((unit) => unit.status === 'available').length

  let rows = breakdown
  if (!rows) {
    const counts = countByStatus(units)
    rows = UNIT_STATUSES.filter((s) => counts[s.value] > 0).map((s) => ({ ...s, count: counts[s.value] }))
  }

  return (
    <div
      data-lenis-prevent
      className={`flex min-h-[18rem] flex-col gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-line)] bg-surface px-5 py-6 ${height}`}
    >
      <span className="eyebrow text-content/55">Unit details</span>

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

      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {rows.map((row) => (
            <li key={row.value} className="flex items-center justify-between gap-3 py-2.5">
              <span className="inline-flex items-center gap-2.5 font-body text-[14px] font-semibold text-content/80">
                <span aria-hidden className={`size-2 rounded-full ${row.swatch}`} />
                {row.label}
              </span>
              <span className="font-display text-[15px] font-bold tabular-nums text-content">{row.count}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto font-body text-sm leading-relaxed text-content/70">
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
