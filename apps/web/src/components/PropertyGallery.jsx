import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { sized } from '../lib/images'

// 2x the 80px the rail paints a thumbnail at. The named `thumb` width is 700,
// sized for the home hero's tiles, which is 3.5x more pixels than a 80x64
// chip can show — and Centro Plaza has 135 of them.
const THUMB_WIDTH = 200

// Below this a horizontal drag is a scroll gesture, not a swipe. 40px is the
// usual floor; under it a diagonal flick through the image reads as a page
// scroll AND advances the carousel, which feels like the page glitched.
const SWIPE_PX = 40

/**
 * Every photograph a property holds, as one carousel.
 *
 * This replaced a still frame with five thumbnails under it — which for
 * Centro Plaza meant 5 of 135 images were reachable and the other 130 existed
 * only in the CMS. The rail carries the whole set now, and the viewer above it
 * is the thing you actually navigate: arrows, keyboard, swipe, and a counter
 * that tells you how much more there is, because with 135 frames "where am I"
 * is a real question.
 *
 * Only the current frame is ever an `<img>` in the viewer; the rail lazy-loads
 * and the browser fetches only the chips near the scroll position. Opening the
 * section costs one full-size image and a screenful of 200px chips.
 */
export default function PropertyGallery({ images, label }) {
  const [active, setActive] = useState(0)
  // Which edges of the rail have more behind them. Scrollbars are hidden
  // site-wide (index.css), so the mask is the only thing telling a visitor
  // the strip continues — and a fade painted at an end with nothing past it
  // is just a dimmed thumbnail.
  const [edges, setEdges] = useState({ start: false, end: true })
  const railRef = useRef(null)
  const dragX = useRef(null)
  const mounted = useRef(false)

  const count = images.length

  // Positive modulo — JS's `%` keeps the sign of the dividend, so stepping
  // back from 0 gives -1 and the rail would index `undefined`. Same helper
  // shape the looping carousels use (DESIGN.md §7).
  const step = useCallback(
    (delta) => setActive((i) => (((i + delta) % count) + count) % count),
    [count],
  )

  // Keep the active chip in view, by writing the rail's own `scrollLeft`
  // rather than calling `scrollIntoView`.
  //
  // `scrollIntoView` walks up the ancestor chain: with the section below the
  // fold on a cold load, even `block: 'nearest'` scrolls the *page* to bring
  // the rail into the viewport, so arriving at a property page would yank the
  // visitor down to the gallery. Writing one scroll offset cannot do that.
  useEffect(() => {
    const rail = railRef.current
    const chip = rail?.children?.[active]
    if (!rail || !chip) return
    const left = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // The first pass is the initial render, where there is nothing to animate
    // from and a smooth scroll would just be a slow start.
    rail.scrollTo({ left, behavior: mounted.current && !reduced ? 'smooth' : 'auto' })
    mounted.current = true
  }, [active])

  // Warm the neighbours so an arrow press paints immediately instead of
  // blanking the frame while the next photograph is fetched.
  useEffect(() => {
    if (count < 2) return
    for (const i of [(active + 1) % count, (active - 1 + count) % count]) {
      const img = new Image()
      img.src = sized(images[i], 'card')
    }
  }, [active, count, images])

  const readEdges = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    setEdges({
      start: rail.scrollLeft > 4,
      end: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4,
    })
  }, [])

  useEffect(() => {
    readEdges()
    const rail = railRef.current
    if (!rail) return undefined
    const observer = new ResizeObserver(readEdges)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [readEdges, count])

  if (count === 0) return null

  // Arrow keys reach this from any focused child — the two arrows and every
  // chip — so the carousel is keyboard-operable without giving a plain <div>
  // a tab stop nobody asked for.
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      step(1)
    }
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label ? `Photographs of ${label}` : 'Property photographs'}
      onKeyDown={onKeyDown}
      className="min-w-0"
    >
      <div
        className="group relative h-[300px] overflow-hidden rounded-2xl bg-surface-alt md:h-[420px]"
        onTouchStart={(e) => {
          dragX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (dragX.current == null) return
          const dx = e.changedTouches[0].clientX - dragX.current
          dragX.current = null
          if (Math.abs(dx) >= SWIPE_PX) step(dx < 0 ? 1 : -1)
        }}
      >
        {/* Both frames are absolute, so the outgoing one can hold its place
            under the incoming one for the length of the cross-fade instead of
            collapsing the box to zero height mid-transition. */}
        <AnimatePresence initial={false}>
          <motion.img
            key={images[active]}
            src={sized(images[active], 'card')}
            alt=""
            decoding="async"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 size-full object-cover"
          />
        </AnimatePresence>

        {count > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => step(-1)} />
            <GalleryArrow side="right" onClick={() => step(1)} />

            {/* With 135 frames, "how much more is there" is the question the
                arrows raise and only a counter answers. Fixed pigments, not
                role tokens: it sits on a photograph, which is neither theme's
                ground. `tabular-nums` so the chip does not twitch its width
                as the index climbs through the hundreds. */}
            <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-void/60 px-2.5 py-1 font-body text-[11px] font-bold tabular-nums text-bone backdrop-blur-sm">
              {active + 1} / {count}
            </p>
          </>
        )}
      </div>

      {count > 1 && (
        <div
          // An alpha mask, not a gradient overlay ramping to `transparent`:
          // in sRGB that ramp passes through grey and paints a dirty smear
          // over the end chips (DESIGN.md §9). The mask lets the section's
          // own ground show through instead, whatever the theme.
          className="mt-4"
          style={{
            maskImage: `linear-gradient(to right, ${edges.start ? 'transparent 0, #000 3rem' : '#000 0'}, ${
              edges.end ? '#000 calc(100% - 3rem), transparent 100%' : '#000 100%'
            })`,
          }}
        >
          <div
            ref={railRef}
            onScroll={readEdges}
            className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1"
          >
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Photograph ${i + 1} of ${count}`}
                aria-current={i === active}
                className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border transition-[border-color,opacity] duration-300 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  i === active
                    ? 'border-accent opacity-100'
                    : 'border-transparent opacity-55 hover:opacity-100'
                }`}
              >
                <img
                  src={sized(src, THUMB_WIDTH)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Same vocabulary as the unit card's arrows: a dark disc that appears on
// hover over the frame. Held visible on touch, where there is no hover to
// reveal it and the swipe is not discoverable on its own.
function GalleryArrow({ side, onClick }) {
  const Icon = side === 'left' ? CaretLeft : CaretRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photograph' : 'Next photograph'}
      className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-void/55 text-bone backdrop-blur-sm transition-[opacity,background-color] duration-200 hover:bg-void/80 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone group-hover:opacity-100 md:opacity-0 ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      <Icon aria-hidden className="size-4" weight="bold" />
    </button>
  )
}
