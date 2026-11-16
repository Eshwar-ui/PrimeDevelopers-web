import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useProperty, usePropertiesLoaded } from '../context/ContentContext'
import { useHead } from '../hooks/useHead'
import { useScrollLock } from '../hooks/useScrollLock'
import { propertyHead, brandedTitle } from '../lib/seo'
import { sized, srcSetFor } from '../lib/images'
import { scrollToElement } from '../lib/scrollToElement'
import { collectGroups, flattenGroups } from '../lib/propertyGallery'

// Photographs per page. A property holds well over a hundred; one page of them
// is a long scroll of decoding images, and a page of 24 is a screen or three.
const PAGE_SIZE = 24

/**
 * One photograph in the grid. The well shimmers until the picture has arrived,
 * and holds a 4:3 box so the columns do not jump as frames land and take their
 * real shape.
 */
function Shot({ image, onOpen, label }) {
  const [loaded, setLoaded] = useState(false)
  const ref = useRef(null)
  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true)
  }, [])
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={`group mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${loaded ? '' : 'image-shimmer aspect-[4/3]'}`}
    >
      <img
        ref={ref}
        src={sized(image.src, 'card')}
        srcSet={srcSetFor(image.src, 'card')}
        sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-auto w-full transition-[opacity,transform] duration-500 ease-brand group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  )
}

/** The grid's loading state: the same columns, all shimmer. */
function GallerySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading photographs" className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={`image-shimmer mb-4 break-inside-avoid rounded-xl ${i % 3 === 1 ? 'aspect-[3/4]' : 'aspect-[4/3]'}`} />
      ))}
    </div>
  )
}

/** First, last, and a window around the current page, with gaps marked. */
function pageNumbers(page, pages) {
  const keep = new Set([1, pages, page - 1, page, page + 1])
  const out = []
  for (let n = 1; n <= pages; n++) {
    if (!keep.has(n)) continue
    if (out.length && n - out[out.length - 1] > 1) out.push('gap')
    out.push(n)
  }
  return out
}

export default function PropertyGalleryPage() {
  const { slug } = useParams()
  const property = useProperty(slug)
  const loaded = usePropertiesLoaded()
  const groups = useMemo(() => collectGroups(property), [property])
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const [params, setParams] = useSearchParams()
  const gridTop = useRef(null)

  const visibleGroups = filter === 'all' ? groups : groups.filter((g) => g.key === filter)
  // One flat list for the lightbox, so its arrows walk on past a page's end.
  const flat = useMemo(() => flattenGroups(visibleGroups), [visibleGroups])
  const pages = Math.max(1, Math.ceil(flat.length / PAGE_SIZE))
  // In the URL, so a page of photographs can be linked and Back lands on it.
  const page = Math.min(Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1), pages)
  const start = (page - 1) * PAGE_SIZE
  const slice = flat.slice(start, start + PAGE_SIZE)
  // Consecutive photographs of one group share a heading.
  const runs = slice.reduce((acc, image, i) => {
    const last = acc[acc.length - 1]
    if (last && last.key === image.groupKey) last.items.push({ image, index: start + i })
    else acc.push({ key: image.groupKey, label: image.groupLabel, items: [{ image, index: start + i }] })
    return acc
  }, [])

  const goTo = (n) => {
    setParams(n <= 1 ? {} : { page: String(n) }, { replace: false })
    // After the new page has rendered, so the target exists at its new height.
    requestAnimationFrame(() => gridTop.current && scrollToElement(gridTop.current, { offset: -120 }))
  }
  const chooseFilter = (key) => {
    setFilter(key)
    setParams({}, { replace: true })
  }
  const total = groups.reduce((n, g) => n + g.images.length, 0)

  const base = propertyHead(property)
  useHead(
    base
      ? {
          ...base,
          path: `/properties/${property.slug}/gallery`,
          title: brandedTitle(`${property.name} Photo Gallery`),
          description: `${total} photographs of ${property.name}${property.address ? `, ${property.address}` : ''} — site, buildings and units.`,
        }
      : undefined,
  )

  const close = useCallback(() => setOpen(null), [])
  const step = useCallback(
    (delta) => setOpen((i) => (i == null ? i : (((i + delta) % flat.length) + flat.length) % flat.length)),
    [flat.length],
  )

  if (!loaded)
    return (
      <div className="min-h-[70vh] overflow-x-hidden bg-base px-gutter pt-32 md:pt-40">
        <div className="mx-auto max-w-[1560px]">
          <div className="image-shimmer h-10 w-72 rounded-lg" />
          <div className="mt-12">
            <GallerySkeleton />
          </div>
        </div>
      </div>
    )
  if (!property) return <Navigate to="/properties" replace />

  return (
    <div className="overflow-x-hidden bg-base text-content">
      <header data-band="light" className="px-gutter pb-8 pt-32 md:pb-12 md:pt-40">
        <div className="mx-auto max-w-[1560px]">
          <Link
            to={`/properties/${property.slug}`}
            className="group inline-flex min-h-11 items-center gap-3 font-body text-[12px] font-bold uppercase tracking-[0.16em] text-content/60 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
            {property.name}
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <h1 className="max-w-[20ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
              {property.name} gallery
            </h1>
            <p className="font-body text-[14px] tabular-nums text-content/60">
              {total} {total === 1 ? 'photograph' : 'photographs'}
            </p>
          </div>

          {groups.length > 1 && (
            <div
              role="group"
              aria-label="Filter photographs"
              className="-mx-gutter mt-8 flex snap-x gap-2 overflow-x-auto px-gutter pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
            >
              {[{ key: 'all', label: 'All', count: total }, ...groups.map((g) => ({ ...g, count: g.images.length }))].map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => chooseFilter(g.key)}
                  aria-pressed={filter === g.key}
                  className={`min-h-11 shrink-0 snap-start rounded-full border px-5 font-body text-[13px] font-bold transition-colors ${
                    filter === g.key ? 'border-accent bg-accent text-white dark:text-void' : 'border-content/20 hover:border-content/50'
                  }`}
                >
                  {g.label} <span className="font-normal tabular-nums opacity-70">{g.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div ref={gridTop} data-band="light" className="bg-surface-alt px-gutter py-10 md:py-14">
        <div className="mx-auto max-w-[1560px]">
          {total === 0 ? (
            <p className="py-16 text-center font-body text-content/60">Photographs of {property.name} are on the way.</p>
          ) : (
            runs.map((run, r) => (
              <section key={`${run.key}-${r}`} className="mb-14 last:mb-0" aria-labelledby={`gallery-${run.key}-${r}`}>
                <div className="mb-6 flex items-center gap-4">
                  <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
                  <h2 id={`gallery-${run.key}-${r}`} className="eyebrow font-body text-[13px] text-content/70">
                    {run.label}
                  </h2>
                </div>
                {/* CSS columns rather than a grid: site shots, portrait unit
                    frames and wide aerials sit together without cropping. */}
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
                  {run.items.map(({ image, index }) => (
                    <Shot
                      key={image.src}
                      image={image}
                      onOpen={() => setOpen(index)}
                      label={`Open photograph ${index + 1} of ${flat.length}${image.alt ? `: ${image.alt}` : ''}`}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {pages > 1 && (
            <nav aria-label="Gallery pages" className="mt-12 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => goTo(page - 1)}
                className="min-h-11 rounded-full border border-content/20 px-5 font-body text-[13px] font-bold transition-colors hover:border-content/50 disabled:opacity-30"
              >
                ← Prev
              </button>
              {pageNumbers(page, pages).map((n, i) =>
                n === 'gap' ? (
                  <span key={`gap-${i}`} aria-hidden className="px-1 text-content/40">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => goTo(n)}
                    aria-label={`Page ${n}`}
                    aria-current={n === page ? 'page' : undefined}
                    className={`size-11 rounded-full border font-body text-[13px] font-bold tabular-nums transition-colors ${
                      n === page ? 'border-accent bg-accent text-white dark:text-void' : 'border-content/20 hover:border-content/50'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={page === pages}
                onClick={() => goTo(page + 1)}
                className="min-h-11 rounded-full border border-content/20 px-5 font-body text-[13px] font-bold transition-colors hover:border-content/50 disabled:opacity-30"
              >
                Next →
              </button>
              <p className="basis-full text-center font-body text-[12px] tabular-nums text-content/50">
                Photographs {start + 1}–{start + slice.length} of {flat.length}
              </p>
            </nav>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open != null && flat[open] && (
          <Lightbox images={flat} index={open} onClose={close} onStep={step} />
        )}
      </AnimatePresence>
    </div>
  )
}

// Same chrome as the info page's lightbox, but the photograph is fitted to
// the viewport: these are photos to look at, not plans to read the small
// print on.
function Lightbox({ images, index, onClose, onStep }) {
  const dialog = useRef(null)
  const dragX = useRef(null)
  const image = images[index]
  useScrollLock()

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onStep(1)
      if (event.key === 'ArrowLeft') onStep(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onStep])

  // Warm the neighbours so an arrow press paints at once.
  useEffect(() => {
    for (const d of [1, -1]) {
      const next = images[(index + d + images.length) % images.length]
      if (next) new Image().src = sized(next.src, 'full')
    }
  }, [images, index])

  const btn =
    'grid size-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      data-lenis-prevent
      className="fixed inset-0 z-[100] flex flex-col overscroll-contain bg-charcoal/95 backdrop-blur-sm"
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
        <div className="flex shrink-0 items-center justify-between gap-4 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <p className="min-w-0 font-body text-[13px] uppercase tracking-[0.18em] text-white/70">
            <span className="block truncate">{image.caption}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-body text-[13px] tabular-nums text-white/50">
              {index + 1} / {images.length}
            </span>
            <button type="button" onClick={onClose} aria-label="Close" className={btn}>
              <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20"
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
          onTouchStart={(e) => {
            dragX.current = e.touches[0].clientX
          }}
          onTouchEnd={(e) => {
            if (dragX.current == null) return
            const dx = e.changedTouches[0].clientX - dragX.current
            dragX.current = null
            if (Math.abs(dx) >= 40) onStep(dx < 0 ? 1 : -1)
          }}
        >
          <img
            key={image.src}
            src={sized(image.src, 'full')}
            alt={image.alt}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          {images.length > 1 &&
            [
              { d: -1, label: 'Previous photograph', path: 'M15 5l-7 7 7 7', side: 'left-3 sm:left-5' },
              { d: 1, label: 'Next photograph', path: 'M9 5l7 7-7 7', side: 'right-3 sm:right-5' },
            ].map(({ d, label, path, side }) => (
              <button
                key={label}
                type="button"
                onClick={() => onStep(d)}
                aria-label={label}
                className={`absolute top-1/2 hidden -translate-y-1/2 border border-white/20 bg-black/30 sm:grid ${side} ${btn}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
              </button>
            ))}
        </div>

        <p className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center font-body text-[12px] text-white/45 sm:hidden">
          Swipe for more
        </p>
        <div className="hidden h-4 shrink-0 sm:block" />
      </div>
    </motion.div>
  )
}
