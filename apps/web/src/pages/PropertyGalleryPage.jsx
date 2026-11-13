import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useProperty, usePropertiesLoaded } from '../context/ContentContext'
import { useHead } from '../hooks/useHead'
import { useScrollLock } from '../hooks/useScrollLock'
import { propertyHead, brandedTitle } from '../lib/seo'
import { imageAlt, sized, srcSetFor } from '../lib/images'
import { formatUnitLabel, getBuildings, getUnitImages, getUnits } from '../lib/units'

/**
 * Every photograph a property holds, on one page.
 *
 * The property page's carousel shows one frame at a time, which is right for
 * a section halfway down a listing and wrong for someone who came to look:
 * with 100+ frames, "show me everything" is a page, not a strip of chips.
 *
 * Two kinds of photograph are gathered here: the property's own gallery (site
 * and exterior photography), and each unit's shoot, grouped by building. A
 * frame that appears in both is shown once, in the property group.
 */
function collectGroups(property) {
  if (!property) return []
  const seen = new Set()
  const take = (src) => {
    if (!src || seen.has(src)) return false
    seen.add(src)
    return true
  }

  const groups = []
  const site = [property.image, ...(property.gallery ?? [])]
    .filter(take)
    .map((src) => ({ src, alt: imageAlt(property, src), caption: property.name }))
  if (site.length) groups.push({ key: 'property', label: 'The property', images: site })

  for (const building of getBuildings(property)) {
    const images = getUnits(building).flatMap((unit) => {
      // A sold unit's tenant may be a private owner (see PropertyDetailPage's
      // establishedAlt), so only a leased unit names its business.
      const unitName = `Unit ${formatUnitLabel(unit.label)}`
      const tenant = unit.status === 'leased' && String(unit.tenant ?? '').trim()
      const caption = [building.building, unitName, tenant].filter(Boolean).join(' · ')
      return getUnitImages(unit)
        .filter(take)
        .map((src) => ({
          src,
          alt: imageAlt(property, src) || `${tenant || unitName}, ${building.building ?? ''} at ${property.name}`,
          caption,
        }))
    })
    if (images.length) {
      groups.push({ key: `b-${building.building}`, label: building.building || 'Units', images })
    }
  }
  return groups
}

export default function PropertyGalleryPage() {
  const { slug } = useParams()
  const property = useProperty(slug)
  const loaded = usePropertiesLoaded()
  const groups = useMemo(() => collectGroups(property), [property])
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)

  const visibleGroups = filter === 'all' ? groups : groups.filter((g) => g.key === filter)
  // One flat list for the lightbox, so its arrows walk on past a group's end.
  const flat = useMemo(() => visibleGroups.flatMap((g) => g.images), [visibleGroups])
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

  if (!loaded) return <div className="min-h-[70vh] bg-base" aria-busy="true" />
  if (!property) return <Navigate to="/properties" replace />

  let offset = 0

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
                  onClick={() => setFilter(g.key)}
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

      <div data-band="light" className="bg-surface-alt px-gutter py-10 md:py-14">
        <div className="mx-auto max-w-[1560px]">
          {total === 0 ? (
            <p className="py-16 text-center font-body text-content/60">Photographs of {property.name} are on the way.</p>
          ) : (
            visibleGroups.map((group) => {
              const start = offset
              offset += group.images.length
              return (
                <section key={group.key} className="mb-14 last:mb-0" aria-labelledby={`gallery-${group.key}`}>
                  <div className="mb-6 flex items-center gap-4">
                    <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
                    <h2 id={`gallery-${group.key}`} className="eyebrow font-body text-[13px] text-content/70">
                      {group.label}
                    </h2>
                    <span className="font-body text-[13px] tabular-nums text-content/45">{group.images.length}</span>
                  </div>
                  {/* CSS columns rather than a grid: site shots, portrait unit
                      frames and wide aerials sit together without cropping. */}
                  <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
                    {group.images.map((image, i) => (
                      <button
                        key={image.src}
                        type="button"
                        onClick={() => setOpen(start + i)}
                        aria-label={`Open photograph ${start + i + 1} of ${flat.length}${image.alt ? `: ${image.alt}` : ''}`}
                        className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <img
                          src={sized(image.src, 'card')}
                          srcSet={srcSetFor(image.src, 'card')}
                          sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-auto w-full transition-transform duration-500 ease-brand group-hover:scale-[1.03]"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )
            })
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
