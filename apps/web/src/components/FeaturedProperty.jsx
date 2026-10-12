import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
import ActionButton from './ActionButton'
import ArrowRight from './ArrowRight'

const CARD_INTERVAL = 9000
const IMAGE_INTERVAL = 5200

/** `n` folded into 0…length-1, negatives included. */
const wrap = (n, length) => ((n % length) + length) % length

/**
 * The cards this panel cycles through.
 *
 * `cards` is the list the admin edits. A row saved before the list existed
 * holds a single feature as top-level fields instead, and that row is still
 * live, so with no list it becomes the only card. A card with no heading is a
 * card switched off.
 */
function featuredCards(f) {
  const cards = f.cards?.length ? f.cards : [f]
  return cards.filter((card) => card?.heading)
}

/**
 * The property a card features — the one it names in `propertySlug`, or the
 * one its primary button links to. That property's own photographs then fill
 * the panel, so a card needs no upload of its own and never drifts out of date
 * with the listing.
 */
function linkedProperty(card, properties) {
  const slug = card.propertySlug || card.ctaHref?.match(/^\/properties\/([^/?#]+)/)?.[1]
  return slug ? properties.find((property) => property.slug === slug) : undefined
}

/**
 * Properties lifted out of the list and given a panel of their own.
 *
 * The list below this section is deliberately uniform — three cards that look
 * alike so they can be compared. That uniformity is exactly why a feature has
 * to sit outside it: a card made bigger than its neighbours reads as a layout
 * bug, while a card lifted out of the row entirely reads as a choice. This is
 * the one place on the page with a hairline border, and that is the whole of
 * its emphasis. With more than one feature the panel becomes a carousel rather
 * than a stack, so the emphasis stays on one property at a time.
 */
export default function FeaturedProperty() {
  const f = useSection('featured_home')
  const properties = useProperties()
  const cards = featuredCards(f)
  const count = cards.length
  const reducedMotion = useReducedMotion()
  // Three runs of the cards back to back, the strip parked in the middle one.
  // There is then always a card to either side to peek in, and when the strip
  // comes to rest in an outer run it hops a whole run back to the middle —
  // onto an identical card, so the hop cannot be seen — and the loop has no
  // end in either direction.
  const slides = count > 1 ? [...cards, ...cards, ...cards] : cards
  const strip = useRef(null)
  const [at, setAt] = useState(count)
  const atRef = useRef(count)
  const settle = useRef(0)
  const touching = useRef(false)
  // Opacity eases as the centre card changes hands, but not across a hop: the
  // card in the middle is swapped for its twin, and fading the twin up from
  // dim would flash the very card the hop is meant to hide.
  const [hopping, setHopping] = useState(false)
  const [paused, setPaused] = useState(false)
  // Someone swiping is driving; the timer stops for good rather than fight
  // them for the strip.
  const [touched, setTouched] = useState(false)
  // Which photograph each card is on, held here rather than in the card so a
  // card and its twins in the other runs always show the same one.
  const [imageAt, setImageAt] = useState({})
  const current = count ? wrap(at, count) : 0

  const stepOf = (el) => el.children[1].offsetLeft - el.children[0].offsetLeft

  const scrollToSlide = (index) => {
    const el = strip.current
    el.scrollTo({ left: index * stepOf(el), behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  // The dots name a card, not a slide, so take the short way round to it.
  const showCard = (index) => {
    let step = wrap(index - current, count)
    if (step > count / 2) step -= count
    scrollToSlide(at + step)
  }

  const scheduleSettle = () => {
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const el = strip.current
      if (!el || touching.current) return
      const step = stepOf(el)
      const index = Math.round(el.scrollLeft / step)
      const home = count + wrap(index, count)
      if (home === index) return
      atRef.current = home
      setHopping(true)
      setAt(home)
      el.scrollLeft += (home - index) * step
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setHopping(false)))
    }, 160)
  }

  const onScroll = () => {
    const el = strip.current
    const index = Math.round(el.scrollLeft / stepOf(el))
    atRef.current = index
    setAt(index)
    scheduleSettle()
  }

  // Park on the middle run before first paint, and keep the same card centred
  // when a resize changes how far apart the cards are.
  useLayoutEffect(() => {
    const el = strip.current
    if (!el || count < 2) return
    atRef.current = count
    setAt(count)
    const place = () => {
      el.scrollLeft = atRef.current * stepOf(el)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(el)
    return () => observer.disconnect()
  }, [count])

  useEffect(() => () => window.clearTimeout(settle.current), [])

  // Held while the pointer or focus is inside, so nobody has a card pulled
  // out from under them mid-read or mid-click.
  useEffect(() => {
    if (count < 2 || paused || touched || reducedMotion) return
    const id = window.setTimeout(() => scrollToSlide(atRef.current + 1), CARD_INTERVAL)
    return () => window.clearTimeout(id)
  }, [at, count, paused, touched, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  // No heading on any card means no feature this month, and an empty bordered
  // slab is worse than no section.
  if (count === 0) return null

  const imageProps = (index) => ({
    activeImage: imageAt[index] ?? 0,
    onImage: (image) => setImageAt((images) => ({ ...images, [index]: image })),
  })

  if (count === 1) {
    return (
      <section data-band="light" className="bg-base px-gutter pb-6 pt-6 text-content">
        <div className="mx-auto max-w-[1560px]">
          <FeaturedCard card={cards[0]} property={linkedProperty(cards[0], properties)} active {...imageProps(0)} />
        </div>
      </section>
    )
  }

  return (
    <section
      data-band="light"
      aria-roledescription="carousel"
      aria-label="Featured properties"
      className="bg-base pb-6 pt-6 text-content"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
    >
      {/* A native scroller, so a swipe or a sideways trackpad gesture moves
          it and snapping lands each card in the centre. It runs the full
          width of the screen; the padding puts the centred card where the
          page column is, less `--peek` on each side, and that inset plus the
          gutter is what the neighbours show through.

          `data-lenis-prevent-horizontal` hands sideways gestures to the
          browser and leaves vertical ones to Lenis, so the page still scrolls
          smoothly over the strip but the strip itself can be swiped. */}
      <div
        ref={strip}
        data-lenis-prevent-horizontal
        onScroll={onScroll}
        onTouchStart={() => {
          touching.current = true
          setTouched(true)
        }}
        onTouchEnd={() => {
          touching.current = false
          scheduleSettle()
        }}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain [--peek:0.75rem] md:gap-5 md:[--peek:3rem] lg:gap-6 lg:[--peek:5rem]"
        style={{ paddingInline: 'calc(max(var(--spacing-gutter), (100% - 1560px) / 2) + var(--peek))' }}
      >
        {slides.map((card, index) => {
          const centred = index === at
          const cardIndex = wrap(index, count)
          return (
            <div
              key={index}
              aria-roledescription="slide"
              aria-label={`${cardIndex + 1} of ${count}`}
              aria-hidden={!centred}
              // Only the centred card is lit; the neighbours either side are
              // dimmed, there as a promise of more rather than to be read.
              className={`relative w-full shrink-0 snap-center snap-always ${
                hopping ? '' : 'transition-opacity duration-500 ease-brand motion-reduce:transition-none'
              } ${centred ? 'opacity-100' : 'opacity-45 hover:opacity-70'}`}
            >
              <div inert={!centred} className="h-full">
                <FeaturedCard
                  card={card}
                  property={linkedProperty(card, properties)}
                  active={centred}
                  {...imageProps(cardIndex)}
                />
              </div>
              {!centred && (
                // A peeking card is a way to it in its own right. Kept out of
                // the tab order and the accessibility tree: the dots below
                // already are that.
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => scrollToSlide(index)}
                  className="absolute inset-0 cursor-pointer rounded-frame"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4 px-gutter">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured properties">
          {cards.map((c, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={current === index}
              aria-label={`Show featured property ${index + 1}`}
              onClick={() => showCard(index)}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                current === index ? 'w-7 bg-accent' : 'w-1.5 bg-content/25 hover:bg-content/45'
              }`}
            />
          ))}
        </div>
        <span aria-live="polite" className="ml-1 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-content/50">
          {String(current + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </span>
      </div>
    </section>
  )
}

function FeaturedCard({ card: f, property, active, activeImage, onImage }) {
  // A linked property's own photographs; an uploaded image only when the card
  // points at nothing in the listings.
  const heroImages = property
    ? Array.from(new Set([property.image, ...(property.gallery ?? [])].filter(Boolean))).slice(0, 6)
    : [f.image].filter(Boolean)
  const heroName = property?.name ?? (f.imageAlt || 'Featured property')
  const safeActiveImage = heroImages.length ? activeImage % heroImages.length : 0
  const navigate = useNavigate()

  // Only the centred card cycles; a peeking or off-screen one holds still.
  useEffect(() => {
    if (!active || heroImages.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setTimeout(() => onImage((safeActiveImage + 1) % heroImages.length), IMAGE_INTERVAL)
    return () => window.clearTimeout(id)
  }, [active, safeActiveImage, heroImages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (href) => (e) => {
    if (!href || /^https?:/.test(href)) return
    e.preventDefault()
    navigate(href)
  }

  return (
    /* Two columns only when there is a photograph to put in the second
       one. Without that guard an unset image leaves the copy in a half-
       width column with a half-width hole beside it, which reads as a
       picture that failed to load rather than as a panel of copy. */
    /* 1fr / 2fr, which puts the photograph at 60% of the card's *outer*
       width — the measurement that was asked for, and the one the comp
       reads at. The columns divide the content box, which is the card less
       its padding and the gap, so asking those for 60% would land the
       picture at about 54% of the card and read short of the brief.

       Rows stretch rather than centre, and that is what decides the card's
       height. The copy column is the tallest thing here, so the copy sets
       the height and the photograph fills whatever it is given — fitting
       the width it was asked for and cropping on the vertical.

       An aspect ratio on the image did the opposite: at 60% of the measure
       a 16:10 frame is over 500px tall, so the picture set the height and
       the card grew a band of dead space down the copy side. */
    <div
      className={`grid h-full gap-8 rounded-frame border border-accent/25 bg-surface p-5 md:gap-10 md:p-7 lg:p-9 ${
        heroImages.length > 0 ? 'lg:grid-cols-[1fr_2fr]' : ''
      }`}
    >
      {/* ── copy ─────────────────────────────────────────────── */}
      <div className={heroImages.length > 0 ? 'flex flex-col justify-center lg:pr-2' : 'max-w-[68ch]'}>
        {f.eyebrow && (
          <p className="flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
            {f.eyebrow}
            <span aria-hidden className="h-px w-8 bg-accent/45" />
          </p>
        )}

        {/* The property's own name is the emphasised half, in saffron. It
            is the only proper noun in the block and the only thing here a
            returning visitor is scanning for. */}
        {/* Sized for the column the 60% photograph leaves behind, not for
            the card. At the old 2.6vw the first line ran past a copy column
            that is now 30% of the card, and "Grow Your Business at" broke
            with "at" stranded on a line of its own. `text-balance` is the
            backstop for the same failure on a heading nobody has written
            yet — it splits the line evenly instead of shedding one word. */}
        <h2
          className="mt-5 text-balance font-display font-bold leading-[1.08] tracking-[-0.02em] text-content"
          style={{ fontSize: 'clamp(1.5rem, 2.1vw, 2.2rem)' }}
        >
          {renderEmphasis(f.heading, 'text-ember')}
        </h2>

        {f.subheading && (
          <p className="mt-4 text-balance font-display text-[clamp(0.95rem,1.15vw,1.15rem)] font-medium leading-snug text-content/85">
            {renderEmphasis(f.subheading, 'text-accent')}
          </p>
        )}

        {f.paragraph && (
          <>
            {/* The comp rules a hairline here. It is doing real work: the
                two lines above are the pitch and the block below is the
                detail, and without a division they read as one four-line
                paragraph that changes voice halfway through. */}
            <span aria-hidden className="mt-6 block h-px w-full max-w-[26rem] bg-gradient-to-r from-ember/40 via-content/12 to-transparent" />
            {/* Italic, as drawn — it sets the supporting copy apart from
                the subheading above it without another size step. */}
            <p className="mt-6 max-w-[52ch] font-body text-[14px] italic leading-[1.75] text-content/55">
              {f.paragraph}
            </p>
          </>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {f.ctaLabel && (
            <ActionButton href={f.ctaHref || '/properties'} onClick={go(f.ctaHref)}>
              {f.ctaLabel}
              {/* A bare arrow rather than the white disc this used to
                  carry. The disc is PrimePill's mark and belongs to the
                  page-level CTA; repeating it here made a card button
                  claim the same rank as the one in the hero. */}
              <ArrowRight className="size-4 -rotate-45 transition-transform duration-200 ease-brand group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </ActionButton>
          )}

          {f.secondaryLabel && (
            <ActionButton tone="ghost" href={f.secondaryHref || '/contact'} onClick={go(f.secondaryHref)}>
              {f.secondaryLabel}
            </ActionButton>
          )}
        </div>
      </div>

      {/* ── the photograph ───────────────────────────────────── */}
      {heroImages.length > 0 && (
        // The min-height is the floor, not the height. On a phone this is a
        // single-column grid, so the row has no sibling to take its height
        // from and `h-full` would resolve to nothing; from `lg` up the copy
        // beside it is always taller and the floor never applies.
        <div className="relative min-h-56 overflow-hidden rounded-panel bg-surface-alt sm:min-h-72 lg:h-full lg:min-h-0">
          <AnimatePresence initial={false} mode="sync">
            <motion.img
              key={heroImages[safeActiveImage]}
              src={sized(heroImages[safeActiveImage], 'card')}
              alt={heroImages.length > 1 ? `${heroName} view ${safeActiveImage + 1}` : f.imageAlt || ''}
              loading={active && safeActiveImage === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              initial={{ opacity: 0, scale: 1.025 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 size-full object-cover object-bottom"
            />
          </AnimatePresence>
          {heroImages.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-void/70 via-void/10 to-transparent px-4 pb-4 pt-12 sm:px-5">
              <div className="flex items-center gap-1.5" role="tablist" aria-label={`${heroName} images`}>
                {heroImages.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    role="tab"
                    aria-selected={safeActiveImage === index}
                    aria-label={`Show image ${index + 1}`}
                    onClick={() => onImage(index)}
                    className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      safeActiveImage === index ? 'w-7 bg-bone' : 'w-1.5 bg-bone/45'
                    }`}
                  />
                ))}
              </div>
              <span aria-live="polite" className="font-body text-[10px] font-bold uppercase tracking-[0.12em] text-bone/75">
                {String(safeActiveImage + 1).padStart(2, '0')} / {String(heroImages.length).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
