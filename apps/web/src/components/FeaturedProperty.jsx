import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
import ActionButton from './ActionButton'
import ArrowRight from './ArrowRight'

const CARD_INTERVAL = 9000
const IMAGE_INTERVAL = 5200

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
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(1)
  const [paused, setPaused] = useState(false)
  const current = cards.length ? active % cards.length : 0

  const show = (index, dir) => {
    setDirection(dir)
    setActive((index + cards.length) % cards.length)
  }

  // Held while the pointer or focus is inside, so nobody has a card pulled
  // out from under them mid-read or mid-click.
  useEffect(() => {
    if (cards.length < 2 || paused || reducedMotion) return
    const id = window.setTimeout(() => show(current + 1, 1), CARD_INTERVAL)
    return () => window.clearTimeout(id)
  }, [current, cards.length, paused, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  // No heading on any card means no feature this month, and an empty bordered
  // slab is worse than no section.
  if (cards.length === 0) return null

  const card = cards[current]

  return (
    <section
      data-band="light"
      aria-roledescription={cards.length > 1 ? 'carousel' : undefined}
      aria-label={cards.length > 1 ? 'Featured properties' : undefined}
      className="bg-base px-gutter pb-6 pt-6 text-content"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
    >
      <div className="mx-auto max-w-[1560px]">
        <div className="relative overflow-hidden">
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={{
                enter: (dir) => ({ opacity: 0, x: reducedMotion ? 0 : dir * 40 }),
                center: { opacity: 1, x: 0 },
                exit: (dir) => ({ opacity: 0, x: reducedMotion ? 0 : dir * -40 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              // Swipe on touch; the buttons below cover everything else.
              drag={cards.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) show(current + 1, 1)
                else if (info.offset.x > 60) show(current - 1, -1)
              }}
              aria-roledescription={cards.length > 1 ? 'slide' : undefined}
              aria-label={cards.length > 1 ? `${current + 1} of ${cards.length}` : undefined}
            >
              <FeaturedCard card={card} property={linkedProperty(card, properties)} />
            </motion.div>
          </AnimatePresence>
        </div>

        {cards.length > 1 && (
          <div className="mt-5 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => show(current - 1, -1)}
              aria-label="Previous featured property"
              className="flex size-10 items-center justify-center rounded-full border border-content/20 text-content transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <CaretLeft aria-hidden className="size-4" />
            </button>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured properties">
              {cards.map((c, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={current === index}
                  aria-label={`Show featured property ${index + 1}`}
                  onClick={() => show(index, index > current ? 1 : -1)}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    current === index ? 'w-7 bg-accent' : 'w-1.5 bg-content/25 hover:bg-content/45'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => show(current + 1, 1)}
              aria-label="Next featured property"
              className="flex size-10 items-center justify-center rounded-full border border-content/20 text-content transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <CaretRight aria-hidden className="size-4" />
            </button>
            <span aria-live="polite" className="ml-1 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-content/50">
              {String(current + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

function FeaturedCard({ card: f, property }) {
  // A linked property's own photographs; an uploaded image only when the card
  // points at nothing in the listings.
  const heroImages = property
    ? Array.from(new Set([property.image, ...(property.gallery ?? [])].filter(Boolean))).slice(0, 6)
    : [f.image].filter(Boolean)
  const heroName = property?.name ?? (f.imageAlt || 'Featured property')
  const [activeImage, setActiveImage] = useState(0)
  const safeActiveImage = heroImages.length ? activeImage % heroImages.length : 0
  const navigate = useNavigate()

  useEffect(() => {
    if (heroImages.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setTimeout(() => setActiveImage((current) => (current + 1) % heroImages.length), IMAGE_INTERVAL)
    return () => window.clearTimeout(id)
  }, [activeImage, heroImages.length])

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
      className={`grid gap-8 rounded-frame border border-accent/25 bg-surface p-5 md:gap-10 md:p-7 lg:p-9 ${
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
              loading={safeActiveImage === 0 ? 'eager' : 'lazy'}
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
                    onClick={() => setActiveImage(index)}
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
