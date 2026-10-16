import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'
import { DEFAULT_INFO } from '../data/centroPlazaInfo'
import { useProperty, useSection } from '../context/ContentContext'
import { rise, stagger, inViewOnce } from '../lib/motion'
import { sized } from '../lib/images'
import { buildingKey, isInfoLive, resolveInfo, telHref } from '../lib/propertyInfo'
import { countByStatus, getBuildings, getUnits } from '../lib/units'

// Section kicker — the accent dash and letter-spaced label the rest of the site
// uses. `inv` means "on one of the dark bands", not "dark mode": the bands it
// sits on are dark in both themes by design.
function SectionTag({ children, tone = 'light' }) {
  const inv = tone === 'inv'
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className={`h-px w-10 shrink-0 ${inv ? 'bg-accent-soft' : 'bg-accent'}`} />
      <span className={`eyebrow font-body text-[13px] ${inv ? 'text-bone/80' : 'text-content/70'}`}>{children}</span>
    </div>
  )
}

/**
 * A block revealed as it is scrolled to.
 *
 * Driven by `useInView` into an `animate` variant label rather than by
 * `whileInView`, for the reason PropertiesPage documents at length: the prop
 * animates the element it sits on but does not put the subtree into a variant
 * state, so `variants` on the children resolve against nothing and the stagger
 * silently does nothing.
 */
function Reveal({ className, children }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const inView = useInView(ref, inViewOnce)

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={reduced ? undefined : stagger}
      initial={reduced ? undefined : 'hidden'}
      animate={reduced ? undefined : inView ? 'show' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

function useContainerWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Split images into rows that share a height and fill the width exactly.
 *
 * This is the fix for the page's sizing. The bands used to be a three-column
 * grid, and these sheets come in every shape — a 1:1 site plan, a 1.5:1 trade
 * map, 0.77:1 floor plans — so each tile took its own height, rows ended
 * ragged, and a sheet that didn't fit the tail of a row left a hole where it
 * would have gone. Sized by ratio instead, every image in a row is the same
 * height, nothing is cropped, and the row is flush at both edges.
 *
 * Rows are chosen together rather than one at a time. Filling greedily strands
 * a lone sheet on the last row — the trade-area map, held short at `max` with
 * a hole beside it — when all three sheets sit comfortably in one row. So every
 * way of breaking the list into rows is scored by how far each row's height
 * lands from `target` (in log terms, so twice too tall and half too short cost
 * the same), a row that would run past `max` is penalised and then held at it,
 * and the cheapest set of breaks wins. A small dynamic program; the lists here
 * are a dozen images at most.
 */
function justify(ratios, width, { gap, target, max }) {
  const n = ratios.length
  const MAX_PER_ROW = 6
  const span = (i, j) => {
    let sum = 0
    for (let k = i; k < j; k++) sum += ratios[k]
    return { sum, height: (width - gap * (j - i - 1)) / sum }
  }
  const cost = (height) => {
    const off = Math.log(height / target) ** 2
    return height > max ? off * 4 : off
  }

  const best = [0]
  const from = [0]
  for (let j = 1; j <= n; j++) {
    best[j] = Infinity
    for (let i = Math.max(0, j - MAX_PER_ROW); i < j; i++) {
      const total = best[i] + cost(span(i, j).height)
      if (total < best[j]) {
        best[j] = total
        from[j] = i
      }
    }
  }

  const rows = []
  for (let j = n; j > 0; j = from[j]) {
    const i = from[j]
    const { sum, height } = span(i, j)
    const items = Array.from({ length: j - i }, (_, k) => i + k)
    rows.unshift(height > max ? { items, sum, height: max, capped: true } : { items, sum, height })
  }
  return rows
}

// Until an image has loaded its real shape is unknown; these hold its place.
const FALLBACK_RATIO = { photo: 3 / 2, sheet: 4 / 5 }

/**
 * A band's images, in justified rows. Photographs may crop to their frame —
 * the full picture is a click away. Sheets may not: crop a unit off a plan and
 * the sheet is wrong, so they are always shown whole.
 */
function ImageRows({ images, kind, startIndex, onOpen, dark }) {
  const [ref, width] = useContainerWidth()
  const [ratios, setRatios] = useState({})
  const onRatio = useCallback(
    (src, ratio) => setRatios((prev) => (prev[src] === ratio ? prev : { ...prev, [src]: ratio })),
    [],
  )

  const phone = width > 0 && width < 560
  const gap = phone ? 16 : 24
  // Sheets are the information here, so they run taller than photographs.
  const target = kind === 'sheet' ? Math.min(Math.max(width * 0.34, 260), 480) : Math.min(Math.max(width * 0.26, 220), 380)
  const list = images.map((image) => ratios[image.src] ?? FALLBACK_RATIO[kind])
  // A phone gets one image per row, held short of a full screen.
  const rows = phone
    ? list.map((ratio, i) => {
        const height = width / ratio
        const max = width * 1.25
        return { items: [i], sum: ratio, height: Math.min(height, max), capped: height > max }
      })
    : width
      ? justify(list, width, { gap, target, max: target * 1.3 })
      : []

  return (
    <div ref={ref}>
      <Reveal className="flex flex-col gap-y-8 md:gap-y-10">
        {rows.map((row) => (
          <div
            key={row.items.join('-')}
            className="flex items-start"
            style={{ gap, maxWidth: row.capped ? row.sum * row.height + gap * (row.items.length - 1) : undefined }}
          >
            {row.items.map((i) => (
              <Plate
                key={`${i}-${images[i].src}`}
                image={images[i]}
                ratio={list[i]}
                onRatio={onRatio}
                kind={kind}
                dark={dark}
                onOpen={() => onOpen(startIndex + i)}
                style={{ flex: `${list[i]} 1 0%` }}
              />
            ))}
          </div>
        ))}
      </Reveal>
    </div>
  )
}

/**
 * One plate in a band.
 *
 * A button rather than a figure with a click handler: opening the full-size
 * view is the whole point of these, and a floor plan nobody can reach from the
 * keyboard is a floor plan half the readers of this page cannot open.
 */
function Plate({ image, ratio, onRatio, kind, dark, onOpen, style }) {
  return (
    <motion.figure variants={rise} style={style} className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className={`group block w-full cursor-zoom-in overflow-hidden rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-base)] ${
          dark ? 'border-[var(--color-line-inv)] bg-white/5' : 'border-[var(--color-line)] bg-surface-alt'
        }`}
      >
        <span className="sr-only">Open full size: </span>
        <img
          src={sized(image.src, 'card')}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          onLoad={(e) => onRatio(image.src, e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          style={{ aspectRatio: ratio }}
          className={`block w-full transition-transform duration-[900ms] ease-brand group-hover:scale-[1.03] ${
            kind === 'photo' ? 'object-cover' : 'object-contain'
          }`}
        />
      </button>
      {image.caption && (
        <figcaption className={`mt-3 font-body text-sm leading-snug ${dark ? 'text-bone-2' : 'text-content/60'}`}>
          {image.caption}
        </figcaption>
      )}
    </motion.figure>
  )
}

/** A frame with nothing in it yet — said plainly rather than filled with a neighbour's picture. */
function EmptyFrame({ children, className = '' }) {
  return (
    <div
      className={`grid place-items-center rounded-2xl border border-dashed border-[var(--color-line-inv)] bg-white/[0.03] p-6 text-center ${className}`}
    >
      <p className="max-w-[24ch] font-body text-sm leading-relaxed text-bone-2">{children}</p>
    </div>
  )
}

/**
 * Every building, one at a time: its photograph beside its floor plan.
 *
 * Tabs rather than a stack, so each building gets the same generous frame —
 * nine of them in a grid put every sheet at thumbnail size and the page ran to
 * twice the length — and the visitor picks the building they are asking about
 * instead of scrolling past the other eight.
 *
 * The counts come from the property's own Floor plans data, matched by label,
 * so they move with every sale and letting without anyone editing this page.
 */
function BuildingExplorer({ items, unitsFor, indexOf, onOpen }) {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion()
  const tabs = useRef([])
  const current = items[Math.min(active, items.length - 1)]
  const stats = unitsFor(current.label)

  // Frames pulse until their picture lands, then the picture fades in — a
  // blank frame on a slow connection otherwise reads as a missing photo.
  const [loaded, setLoaded] = useState(() => new Set())
  const markLoaded = (src) => setLoaded((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))

  // Warm the buildings either side, so stepping through them is instant
  // rather than a wait on every press.
  useEffect(() => {
    for (const step of [-1, 1]) {
      const next = items[(active + step + items.length) % items.length]
      for (const src of [next?.photo, next?.plan]) if (src) new Image().src = sized(src, 'card')
    }
  }, [active, items])

  const select = (i) => {
    const next = (i + items.length) % items.length
    setActive(next)
    return next
  }

  // WAI-ARIA tabs: arrows move focus and selection together, Home/End jump.
  const onKeyDown = (e) => {
    const moves = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: items.length - 1 }
    if (!(e.key in moves)) return
    e.preventDefault()
    const next = select(moves[e.key])
    tabs.current[next]?.focus()
    tabs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const photoIndex = indexOf(`building:${active}:photo`)
  const planIndex = indexOf(`building:${active}:plan`)
  const arrow = 'grid size-11 shrink-0 place-items-center rounded-full border border-[var(--color-line-inv)] text-bone/80 transition-colors hover:bg-white/10 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft'

  return (
    <div className="mt-12">
      {/* Bleeds to the screen edge on a phone so the rail can scroll under the
          gutter rather than stopping short of it. */}
      <div
        role="tablist"
        aria-label="Buildings"
        onKeyDown={onKeyDown}
        className="-mx-gutter flex snap-x gap-2 overflow-x-auto px-gutter pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((b, i) => {
          const selected = i === active
          const open = unitsFor(b.label)?.available > 0
          return (
            <button
              key={`${b.label}-${i}`}
              ref={(el) => (tabs.current[i] = el)}
              id={`building-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="building-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 font-body text-sm font-bold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft ${
                selected
                  ? 'border-bone bg-bone text-void'
                  : 'border-[var(--color-line-inv)] text-bone/80 hover:border-bone/50 hover:text-bone'
              }`}
            >
              {b.label}
              {open && (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-status-available)]" />
                  <span className="sr-only">, units available</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          id="building-panel"
          role="tabpanel"
          aria-labelledby={`building-tab-${active}`}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -8, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <h3 className="font-display font-bold leading-[1.08] tracking-[-0.02em] text-bone [font-size:clamp(1.6rem,2.6vw,2.4rem)]">
                {current.label}
              </h3>
              {/* Availability only, never a total. A unit record can be a
                  combined suite — Building 1's "101+102+103+106" is one — so a
                  count of records reads as "2 units" beside a sheet showing
                  six. What a prospect acts on is whether anything is free. */}
              {stats?.total > 0 &&
                (stats.available > 0 ? (
                  <p className="mt-2 flex items-center gap-2 font-body text-[15px] text-[var(--color-status-available)]">
                    <span aria-hidden className="size-2 rounded-full bg-current" />
                    <span>
                      <span className="tabular-nums">{stats.available}</span> {stats.available === 1 ? 'unit' : 'units'} available
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 font-body text-[15px] text-bone-2">No units currently available</p>
                ))}
              {current.note && <p className="mt-3 max-w-[44rem] font-body text-[15px] leading-relaxed text-bone-2">{current.note}</p>}
            </div>
            {items.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="font-body text-sm tabular-nums text-bone-2">
                  {active + 1} / {items.length}
                </span>
                {[
                  { step: -1, label: 'Previous building', path: 'M15 5l-7 7 7 7' },
                  { step: 1, label: 'Next building', path: 'M9 5l7 7-7 7' },
                ].map(({ step, label, path }) => (
                  <button key={label} type="button" onClick={() => select(active + step)} aria-label={label} className={arrow}>
                    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={path} />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 7 / 5, photograph first: the building is what a visitor
              recognises, the sheet is what they read. On a wide screen the
              plan's frame is stretched to the photograph's height, so the
              pair always lands as one level block. */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
            <figure className="lg:col-span-7">
              {current.photo ? (
                <button
                  type="button"
                  onClick={() => onOpen(photoIndex)}
                  className={`group block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-accent-soft ${
                    loaded.has(current.photo) ? '' : 'motion-safe:animate-pulse'
                  }`}
                >
                  <span className="sr-only">Open full size: </span>
                  <img
                    src={sized(current.photo, 'card')}
                    alt={current.photoAlt || `${current.label} exterior`}
                    decoding="async"
                    onLoad={() => markLoaded(current.photo)}
                    onError={() => markLoaded(current.photo)}
                    className={`aspect-[4/3] w-full object-cover transition-[transform,opacity] duration-[900ms] ease-brand group-hover:scale-[1.03] ${
                      loaded.has(current.photo) ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </button>
              ) : (
                <EmptyFrame className="aspect-[4/3]">No photograph of this building yet.</EmptyFrame>
              )}
              <figcaption className="sr-only">{current.label} — photograph</figcaption>
            </figure>

            <figure className="flex flex-col lg:col-span-5">
              {current.plan ? (
                <button
                  type="button"
                  onClick={() => onOpen(planIndex)}
                  className={`group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-charcoal outline-none focus-visible:ring-2 focus-visible:ring-accent-soft lg:aspect-auto lg:flex-1 ${
                    loaded.has(current.plan) ? '' : 'motion-safe:animate-pulse'
                  }`}
                >
                  <span className="sr-only">Open full size: </span>
                  <img
                    src={sized(current.plan, 'card')}
                    alt={current.planAlt || `${current.label} floor plan`}
                    decoding="async"
                    onLoad={() => markLoaded(current.plan)}
                    onError={() => markLoaded(current.plan)}
                    className={`absolute inset-0 size-full object-contain transition-[transform,opacity] duration-[900ms] ease-brand group-hover:scale-[1.03] ${
                      loaded.has(current.plan) ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </button>
              ) : (
                <EmptyFrame className="aspect-[4/5] lg:aspect-auto lg:flex-1">
                  No floor plan published for this building yet — ask the team below for the latest sheet.
                </EmptyFrame>
              )}
              <figcaption className="sr-only">{current.label} — floor plan</figcaption>
            </figure>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * Full-size viewer.
 *
 * These are floor plans and rate sheets — the unit numbers and the square
 * footages are the content, and at grid size they are unreadable. The page is
 * not really usable without this.
 */
function Lightbox({ images, index, onClose, onStep }) {
  const dialog = useRef(null)
  const image = images[index]

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onStep(1)
      if (event.key === 'ArrowLeft') onStep(-1)
    }
    document.addEventListener('keydown', onKey)
    // Matches BrochureRequestModal: Lenis drives the window scroller, and
    // locking the body is what stops the page creeping behind the overlay.
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, onStep])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex flex-col bg-charcoal/92 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={image.alt || image.caption}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        {/* The close button is the only way out of the lightbox, so the top
            row insets for the notch the way the controls below already inset
            for the home indicator. */}
        <div className="flex shrink-0 items-center justify-between gap-4 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <p className="min-w-0 font-body text-[13px] uppercase tracking-[0.18em] text-white/70">
            <span className="block truncate">{image.caption}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-body text-[13px] tabular-nums text-white/50">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* `overflow-auto` rather than a fitted image: a Building 8 plan is
            twenty units tall, and shrinking it to the viewport puts the square
            footages back out of reach. */}
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-6">
          <img key={image.src} src={sized(image.src, 'full')} alt={image.alt} className="mx-auto h-auto w-auto max-w-full rounded-lg" />
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {[
            { step: -1, label: 'Previous image', path: 'M15 5l-7 7 7 7' },
            { step: 1, label: 'Next image', path: 'M9 5l7 7-7 7' },
          ].map(({ step, label, path }) => (
            <button
              key={label}
              type="button"
              onClick={() => onStep(step)}
              aria-label={label}
              className="grid size-11 place-items-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={path} />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Keeps the page out of search results for as long as it is mounted.
 *
 * "Unlisted" is not the same as "not public": nothing links here, but the URL
 * is handed to prospects, and a link that gets forwarded or pasted into a chat
 * is enough for a crawler to find it. There is no robots.txt on this site and
 * no per-route meta anywhere, so the tag is written directly and torn down on
 * the way out — leaving it behind would mark every page navigated to next as
 * noindex, since the SPA never reloads the document.
 *
 * The document title moves with it. These links get sent out and sat in tabs,
 * and every one of them reading "Prime Developers — We build the landmarks of
 * Texas" is no use to whoever has four of them open.
 */
function useUnlisted(title) {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)

    const previousTitle = document.title
    document.title = title

    return () => {
      meta.remove()
      document.title = previousTitle
    }
  }, [title])
}

const hasImages = (band) => band?.images?.some((image) => image?.src)
const withSrc = (images) => (images ?? []).filter((image) => image?.src)

export default function PropertyInfoPage() {
  const { slug } = useParams()
  const property = useProperty(slug)
  const info = useMemo(() => resolveInfo(property, slug, DEFAULT_INFO), [property, slug])
  const t = useSection('property_info_page')

  const name = info?.name || property?.name || 'Property'
  useUnlisted(info ? `${name} — Property Information` : 'Property Information')

  const buildings = useMemo(
    () => (info?.buildings?.items ?? []).filter((b) => b?.label && (b.photo || b.plan)),
    [info],
  )

  // Live unit counts for a building on this page, from the matching building
  // in the property's Floor plans data.
  const unitsFor = useMemo(() => {
    const byKey = new Map(getBuildings(property).map((b) => [buildingKey(b.building), b]))
    return (label) => {
      const match = byKey.get(buildingKey(label))
      if (!match) return null
      const units = getUnits(match)
      return { total: units.length, available: countByStatus(units).available ?? 0 }
    }
  }, [property])

  // The bands, in page order, skipping any with nothing in it. Their ground
  // alternates from this list rather than from fixed positions, so removing a
  // band in the admin never leaves two of the same ground side by side.
  const bands = useMemo(() => {
    if (!info) return []
    return [
      hasImages(info.site) && { id: 'overview', kind: 'sheet', band: info.site },
      buildings.length > 0 && { id: 'buildings', kind: 'buildings', band: info.buildings },
      hasImages(info.gallery) && { id: 'photography', kind: 'photo', band: info.gallery },
      hasImages(info.investment) && { id: 'investment', kind: 'sheet', band: info.investment },
    ].filter(Boolean)
  }, [info, buildings])

  // One flat list for the lightbox, in page order, so the arrows walk the
  // whole set. `keys` lets each band find its own entries' positions.
  const { images, keys } = useMemo(() => {
    const images = []
    const keys = new Map()
    for (const b of bands) {
      if (b.kind === 'buildings') {
        buildings.forEach((item, i) => {
          if (item.photo) {
            keys.set(`building:${i}:photo`, images.length)
            images.push({ src: item.photo, alt: item.photoAlt || `${item.label} exterior`, caption: `${item.label} — photograph` })
          }
          if (item.plan) {
            keys.set(`building:${i}:plan`, images.length)
            images.push({ src: item.plan, alt: item.planAlt || `${item.label} floor plan`, caption: `${item.label} — floor plan` })
          }
        })
      } else {
        keys.set(b.id, images.length)
        images.push(...withSrc(b.band.images))
      }
    }
    return { images, keys }
  }, [bands, buildings])
  const indexOf = useCallback((key) => keys.get(key) ?? 0, [keys])

  // The building explorer is drawn for a dark ground, so the alternation is
  // phased to land it on one — wherever it falls once empty bands drop out.
  const buildingsAt = bands.findIndex((b) => b.kind === 'buildings')
  const groundOffset = buildingsAt >= 0 && buildingsAt % 2 === 0 ? 1 : 0

  const [open, setOpen] = useState(null)
  // Wraps in both directions, so the arrow keys never dead-end on the first or
  // last plate.
  const step = useCallback(
    (delta) => setOpen((current) => (current == null ? current : (current + delta + images.length) % images.length)),
    [images.length],
  )
  const close = useCallback(() => setOpen(null), [])

  // A slug with no page — or one switched off in the admin — is not a page.
  // Sending it back to the listing is kinder than a 404 for what is almost
  // always a hand-typed URL.
  if (!isInfoLive(info)) return <Navigate to={slug ? `/properties/${slug}` : '/properties'} replace />

  const address = info.address || property?.address
  const links = (info.links ?? []).filter((l) => l?.label && l?.href)
  const contacts = (info.contacts ?? []).filter((c) => c?.name && c?.phone)
  const facts = (info.facts ?? []).filter((f) => f?.value)
  const hasEnquiries = contacts.length > 0 || info.email

  return (
    <>
      <section className="relative isolate overflow-hidden bg-void px-gutter pb-16 pt-32 text-bone md:pb-20 md:pt-40">
        {/* The photograph carries the hero. Not lazy and not low priority: it
            is the largest paint on the page and it is above the fold, so
            deferring it would leave the section on bare `void` for the whole
            fetch. `bg-void` underneath is what it lands on until it does. */}
        {info.heroImage && (
          <img
            src={sized(info.heroImage, 'full')}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
            className="bleed-fill pointer-events-none object-cover"
          />
        )}
        {/* Two scrims rather than one flat wash, so the photograph stays bright
            where nothing sits on it. The horizontal one protects the copy on
            the left; the vertical one darkens the foot of the section, which is
            where the stat row runs full width and where this has to meet the
            band below without a seam. */}
        <div aria-hidden className="bleed-fill pointer-events-none bg-gradient-to-r from-void via-void/78 to-void/35" />
        <div aria-hidden className="bleed-fill pointer-events-none bg-gradient-to-t from-void via-void/40 to-transparent" />
        <div
          aria-hidden
          className="bleed-fill pointer-events-none bg-[radial-gradient(100%_70%_at_50%_0%,rgba(0,115,164,0.20),transparent_62%)]"
        />
        <div className="relative mx-auto max-w-[1600px]">
          {/* No route back to the listing. This is an internal reference sheet
              reached by typing the URL, not a stop on the public journey, and a
              back link would both imply it is one and hand a recipient of the
              link the rest of the site. */}
          {info.kicker && <p className="eyebrow font-body text-[13px] text-accent-soft">{info.kicker}</p>}
          {/* The site's shared hero scale (DESIGN.md §2). This ran to 5.5rem —
              half as large again as the property page a visitor arrives from. */}
          <h1 className="mt-4 max-w-[18ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            {name}
          </h1>
          {/* White at 90% rather than `bone-2`: a light grey reads fine on solid
              `void` but drops under 2:1 against a lit sky showing through the
              scrim. */}
          {address && <p className="mt-5 font-body text-[15px] text-bone/90 md:text-[16px]">{address}</p>}
          {info.summary && <p className="mt-6 max-w-[40rem] font-body text-[15px] leading-relaxed text-bone/90 md:text-[16px]">{info.summary}</p>}

          {facts.length > 0 && (
            <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-[var(--color-line-inv)] pt-8 md:grid-cols-4">
              {facts.map((fact) => (
                <div key={`${fact.label}-${fact.value}`} className="flex flex-col-reverse">
                  <dt className="mt-3 font-body text-xs uppercase tracking-[0.16em] text-accent-soft">{fact.label}</dt>
                  <dd className="numeral font-display font-bold text-bone [font-size:clamp(1.6rem,2.2vw,2.25rem)]">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* The bands alternate ground so the groups read as separate chapters.
          `data-band="light"` is not decoration — the fixed header picks its
          chrome by observing these, and an untagged light band leaves the
          navbar dressed for a dark ground it is no longer standing on.

          The hairline is for the dark theme, where `base` and `void` are the
          same colour and the alternation alone no longer separates anything. */}
      {bands.map((b, bandIndex) => {
        const dark = (bandIndex + groundOffset) % 2 === 1
        return (
          <section
            key={b.id}
            id={b.id}
            data-band={dark ? undefined : 'light'}
            className={`border-t border-[var(--color-line)] px-gutter py-16 md:py-24 ${dark ? 'bg-void text-bone' : 'bg-base text-content'}`}
          >
            <div className="mx-auto max-w-[1600px]">
              {b.band.tag && <SectionTag tone={dark ? 'inv' : 'light'}>{b.band.tag}</SectionTag>}
              {b.band.heading && (
                <h2
                  className={`mt-6 max-w-[22ch] text-balance font-display font-bold leading-[1.08] tracking-[-0.02em] [font-size:clamp(1.9rem,3.4vw,3rem)] ${
                    dark ? 'text-bone' : 'text-content'
                  }`}
                >
                  {b.band.heading}
                </h2>
              )}
              {b.band.body && (
                <p className={`mt-5 max-w-[44rem] font-body text-[15px] leading-relaxed ${dark ? 'text-bone-2' : 'text-content/70'}`}>
                  {b.band.body}
                </p>
              )}

              {b.kind === 'buildings' ? (
                <BuildingExplorer items={buildings} unitsFor={unitsFor} indexOf={indexOf} onOpen={setOpen} />
              ) : (
                <div className="mt-12">
                  <ImageRows images={withSrc(b.band.images)} kind={b.kind} startIndex={indexOf(b.id)} onOpen={setOpen} dark={dark} />
                </div>
              )}
            </div>
          </section>
        )
      })}

      {(links.length > 0 || hasEnquiries) && (
        <section data-band="light" className="bg-surface-alt px-gutter py-16 text-content md:py-24">
          <div className={`mx-auto grid max-w-[1600px] gap-14 ${links.length && hasEnquiries ? 'lg:grid-cols-2' : ''}`}>
            {links.length > 0 && (
              <div>
                <SectionTag>{t.listingsLabel}</SectionTag>
                <h2 className="mt-6 font-display font-bold leading-[1.15] tracking-[-0.02em] [font-size:clamp(1.6rem,2.4vw,2.25rem)]">
                  {t.elsewhereHeading}
                </h2>
                <ul className="mt-8 flex flex-col">
                  {/* A button, not an anchor, and deliberately so: this page is
                      handed to named prospects, and an <a href> puts the
                      destination in the status bar, in the right-click menu and
                      in anything that copies the link. Opening it from script
                      keeps the address off the page while the link still works.
                      The trade is real — no middle-click, no "open in new tab",
                      and a control that navigates is worse for a screen reader
                      than a link — which is why it is scoped to this unlisted
                      page and not applied to the public property pages. */}
                  {links.map((link) => (
                    <li key={`${link.label}-${link.href}`}>
                      <button
                        type="button"
                        onClick={() => window.open(link.href, '_blank', 'noopener,noreferrer')}
                        className="flex min-h-14 w-full items-center justify-between gap-6 border-b border-[var(--color-line)] py-4 text-left font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
                      >
                        {link.label}
                        <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17L17 7M8 7h9v9" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasEnquiries && (
              <div>
                <SectionTag>{t.enquiriesLabel}</SectionTag>
                <h2 className="mt-6 font-display font-bold leading-[1.15] tracking-[-0.02em] [font-size:clamp(1.6rem,2.4vw,2.25rem)]">
                  {t.talkToTeamHeading}
                </h2>
                <ul className="mt-8 flex flex-col">
                  {contacts.map((contact) => (
                    <li key={`${contact.name}-${contact.phone}`}>
                      <a
                        href={telHref(contact.phone)}
                        className="flex min-h-14 items-center justify-between gap-6 border-b border-[var(--color-line)] py-4 font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
                      >
                        {contact.name}
                        <span className="shrink-0 tabular-nums text-content/60">{contact.phone}</span>
                      </a>
                    </li>
                  ))}
                  {info.email && (
                    <li>
                      <a
                        href={`mailto:${info.email}`}
                        className="flex min-h-14 items-center justify-between gap-6 border-b border-[var(--color-line)] py-4 font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
                      >
                        {t.emailLinkLabel}
                        <span className="min-w-0 truncate text-content/60">{info.email}</span>
                      </a>
                    </li>
                  )}
                </ul>

                <p className="mt-8 max-w-[46rem] font-body text-xs leading-relaxed text-content/50">{t.legalDisclaimer}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <AnimatePresence>
        {open != null && images[open] && <Lightbox images={images} index={open} onClose={close} onStep={step} />}
      </AnimatePresence>
    </>
  )
}
