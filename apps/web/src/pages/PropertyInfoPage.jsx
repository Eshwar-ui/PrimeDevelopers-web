import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'
import { PROPERTY_INFO, flattenImages } from '../data/centroPlazaInfo'
import { useSection } from '../context/ContentContext'
import { rise, stagger, inViewOnce } from '../lib/motion'
import { sized } from '../lib/images'

// Section kicker — the accent dash and letter-spaced label the rest of the site
// uses. `inv` means "on one of the dark bands", not "dark mode": the bands it
// sits on are dark in both themes by design.
function SectionTag({ children, tone = 'light' }) {
  const inv = tone === 'inv'
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className={`h-px w-10 shrink-0 ${inv ? 'bg-accent-soft' : 'bg-accent'}`} />
      <span
        className={`font-body text-[13px] font-bold uppercase tracking-[0.28em] ${
          inv ? 'text-bone/80' : 'text-content/70'
        }`}
      >
        {children}
      </span>
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

/**
 * One plate in a band.
 *
 * A button rather than a figure with a click handler: opening the full-size
 * view is the whole point of these, and a floor plan nobody can reach from the
 * keyboard is a floor plan half the readers of this page cannot open.
 */
function Plate({ image, index, onOpen, layout, dark }) {
  // The two kinds want opposite things, and treating them alike is what made
  // the grid ragged. A photograph may be cropped to a shared rhythm — the frame
  // is not the information, and the full one is a click away. A floor plan may
  // not: crop a unit off a plan and the sheet is wrong, so those are contained
  // whole inside a fixed box, which lines the rows up just as well.
  const photo = layout === 'photo'
  const span = image.feature || image.wide ? 'sm:col-span-2' : undefined
  const ratio = photo
    ? image.feature
      ? 'aspect-[16/9]'
      : 'aspect-[4/3]'
    : image.wide
      ? 'aspect-[16/10]'
      : 'aspect-[4/5]'

  return (
    <motion.figure variants={rise} className={span}>
      <button
        type="button"
        onClick={() => onOpen(index)}
        className={`group block w-full overflow-hidden rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-base)] ${
          dark ? 'border-[var(--color-line-inv)] bg-white/5' : 'border-[var(--color-line)] bg-surface-alt'
        }`}
      >
        <span className="sr-only">Open full size: </span>
        <img
          src={sized(image.src, 'card')}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          className={`${ratio} w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] ${
            photo ? 'object-cover' : 'object-contain p-4'
          }`}
        />
      </button>
      <figcaption
        className={`mt-3 font-body text-[13.5px] leading-[1.5] ${dark ? 'text-bone-2' : 'text-content/60'}`}
      >
        {image.caption}
      </figcaption>
    </motion.figure>
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
        aria-label={image.alt}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-4 sm:px-6">
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
              className="grid size-10 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
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
          <img
            key={image.id}
            src={sized(image.src, 'full')}
            alt={image.alt}
            className="mx-auto h-auto w-auto max-w-full rounded-lg"
          />
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

export default function PropertyInfoPage() {
  const { slug } = useParams()
  const info = PROPERTY_INFO[slug]
  const t = useSection('property_info_page')

  useUnlisted(info ? `${info.name} — Property Information` : 'Property Information')

  const images = useMemo(() => (info ? flattenImages(info) : []), [info])
  // Resolved rather than stored, so a heroImageId that no longer matches
  // anything leaves the hero on its plain ground instead of a broken image.
  const heroImage = useMemo(
    () => images.find((image) => image.id === info?.heroImageId) ?? null,
    [images, info]
  )
  const [open, setOpen] = useState(null)

  // Wraps in both directions, so the arrow keys never dead-end on the first or
  // last plate.
  const step = useCallback(
    (delta) => setOpen((current) => (current == null ? current : (current + delta + images.length) % images.length)),
    [images.length]
  )
  const close = useCallback(() => setOpen(null), [])

  // Offsets into the flat list, so a plate in the third band knows its own
  // index without every band having to count the ones before it.
  const offsets = useMemo(() => {
    if (!info) return []
    let running = 0
    return info.groups.map((group) => {
      const start = running
      running += group.images.length
      return start
    })
  }, [info])

  // A slug with no media set is not a page. Sending it back to the listing is
  // kinder than a 404 for what is almost always a hand-typed URL.
  if (!info) return <Navigate to={slug ? `/properties/${slug}` : '/properties'} replace />

  return (
    <>
      <section className="relative isolate overflow-hidden bg-void px-gutter pb-20 pt-32 text-bone md:px-gutter-lg md:pb-24 md:pt-40">
        {/* The photograph carries the hero. Not lazy and not low priority: it
            is the largest paint on the page and it is above the fold, so
            deferring it would leave the section on bare `void` for the whole
            fetch. `bg-void` underneath is what it lands on until it does. */}
        {heroImage && (
          <img
            src={sized(heroImage.src, 'full')}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        )}
        {/* Two scrims rather than one flat wash, so the photograph stays bright
            where nothing sits on it. The horizontal one protects the copy on
            the left; the vertical one darkens the foot of the section, which is
            where the stat row runs full width and where this has to meet the
            band below without a seam. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-void via-void/78 to-void/35" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_50%_0%,rgba(0,115,164,0.20),transparent_62%)]"
        />
        <div className="relative mx-auto max-w-[1600px]">
          {/* No route back to the listing. This is an internal reference sheet
              reached by typing the URL, not a stop on the public journey, and a
              back link would both imply it is one and hand a recipient of the
              link the rest of the site. */}
          <p className="font-body text-[13px] font-bold uppercase tracking-[0.28em] text-accent-soft">
            {info.kicker}
          </p>
          <h1 className="mt-4 max-w-[18ch] text-[clamp(2.6rem,6vw,5.5rem)] font-bold leading-[1.04] tracking-[-0.04em]">
            {info.name}
          </h1>
          {/* White at 90% rather than `bone-2`, and a narrower measure than the
              54rem this ran to on a flat ground. Both are the photograph's
              doing: `bone-2` is a light grey that reads fine on solid `void`
              but drops under 2:1 against a lit sky showing through the scrim,
              and the shorter line keeps the copy inside the part of the hero
              the scrim actually protects. */}
          <p className="mt-6 font-body text-[clamp(1rem,1.15vw,1.2rem)] text-bone/90">{info.address}</p>
          <p className="mt-8 max-w-[40rem] font-body text-[clamp(1rem,1.1vw,1.15rem)] leading-[1.7] text-bone/90">
            {info.summary}
          </p>

          <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-9 border-t border-[var(--color-line-inv)] pt-10 md:grid-cols-4">
            {info.facts.map((fact) => (
              <div key={fact.label}>
                <dd className="text-[clamp(1.9rem,2.6vw,2.9rem)] font-bold leading-none tracking-[-0.045em] text-bone">
                  {fact.value}
                </dd>
                <dt className="mt-3 font-body text-[12.5px] uppercase tracking-[0.16em] text-accent-soft">
                  {fact.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* The bands alternate ground so the four groups read as separate
          chapters. `data-band="light"` is not decoration — the fixed header
          picks its chrome by observing these, and an untagged light band leaves
          the navbar dressed for a dark ground it is no longer standing on. */}
      {info.groups.map((group, groupIndex) => {
        const dark = groupIndex % 2 === 1
        return (
          <section
            key={group.id}
            id={group.id}
            data-band={dark ? undefined : 'light'}
            className={`px-gutter py-20 md:px-gutter-lg md:py-28 ${dark ? 'bg-void text-bone' : 'bg-base text-content'}`}
          >
            <div className="mx-auto max-w-[1600px]">
              <SectionTag tone={dark ? 'inv' : 'light'}>{group.tag}</SectionTag>
              <h2
                className={`mt-6 max-w-[20ch] text-[clamp(2rem,3.4vw,3.4rem)] font-bold leading-[1.1] tracking-[-0.035em] ${
                  dark ? 'text-bone' : 'text-content'
                }`}
              >
                {group.heading}
              </h2>
              <p
                className={`mt-5 max-w-[52rem] font-body text-[clamp(0.98rem,1.05vw,1.1rem)] leading-[1.7] ${
                  dark ? 'text-bone-2' : 'text-content/70'
                }`}
              >
                {group.body}
              </p>

              {/* `grid-flow-dense` because the feature tiles span two columns
                  and the column count changes twice on the way down. Without it
                  a two-wide tile that cannot fit the tail of a row leaves the
                  hole where it would have gone; dense backfills it with the
                  next tile that does fit, so no breakpoint ends up with gaps. */}
              <Reveal className="mt-14 grid grid-flow-dense grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {group.images.map((image, i) => (
                  <Plate
                    key={image.id}
                    image={image}
                    index={offsets[groupIndex] + i}
                    onOpen={setOpen}
                    layout={group.layout}
                    dark={dark}
                  />
                ))}
              </Reveal>
            </div>
          </section>
        )
      })}

      <section data-band="light" className="bg-surface-alt px-gutter py-20 text-content md:px-gutter-lg md:py-24">
        <div className="mx-auto grid max-w-[1600px] gap-14 lg:grid-cols-2">
          <div>
            <SectionTag>{t.listingsLabel}</SectionTag>
            <h2 className="mt-6 text-[clamp(1.7rem,2.4vw,2.4rem)] font-bold leading-[1.15] tracking-[-0.03em]">
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
              {info.links.map((link) => (
                <li key={link.href}>
                  <button
                    type="button"
                    onClick={() => window.open(link.href, '_blank', 'noopener,noreferrer')}
                    className="flex w-full items-center justify-between gap-6 border-b border-[var(--color-line)] py-4 text-left font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
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

          <div>
            <SectionTag>{t.enquiriesLabel}</SectionTag>
            <h2 className="mt-6 text-[clamp(1.7rem,2.4vw,2.4rem)] font-bold leading-[1.15] tracking-[-0.03em]">
              {t.talkToTeamHeading}
            </h2>
            <ul className="mt-8 flex flex-col">
              {info.contacts.map((contact) => (
                <li key={contact.tel}>
                  <a
                    href={`tel:${contact.tel}`}
                    className="flex items-center justify-between gap-6 border-b border-[var(--color-line)] py-4 font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
                  >
                    {contact.name}
                    <span className="shrink-0 tabular-nums text-content/60">{contact.phone}</span>
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={`mailto:${info.email}`}
                  className="flex items-center justify-between gap-6 border-b border-[var(--color-line)] py-4 font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
                >
                  {t.emailLinkLabel}
                  <span className="shrink-0 text-content/60">{info.email}</span>
                </a>
              </li>
            </ul>

            <p className="mt-8 max-w-[46rem] font-body text-[12.5px] leading-[1.6] text-content/50">
              {t.legalDisclaimer}
            </p>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {open != null && (
          <Lightbox images={images} index={open} onClose={close} onStep={step} />
        )}
      </AnimatePresence>
    </>
  )
}
