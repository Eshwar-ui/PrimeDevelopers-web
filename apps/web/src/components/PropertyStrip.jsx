import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

// Dwell on each step. Shorter than the homepage hero's 6s: that one swaps a
// whole panel and wants to be read, this one nudges a band sideways and reads
// as motion, so it has to keep moving to look alive.
const SLIDE_MS = 3600

// Matches the slide transition below — the fold-back has to wait for the
// movement it is hiding to finish.
const RAIL_MS = 900

// Slides of headroom rendered past the live position in each direction, so the
// track always has something to move into mid-transition.
const RAIL_SPAN = 4

// Positive modulo. `pos` runs negative once the track has been walked left, and
// JS's % keeps the sign of the dividend, which would index off the front.
const mod = (n, m) => ((n % m) + m) % m

/**
 * The properties hero band: a full-bleed carousel of photographs that travels
 * sideways, continuously looped.
 *
 * The rail is rendered as a window of whole sets around wherever the track
 * currently is, with headroom on both sides — whole sets so the repeat stays
 * aligned, and grown on demand because clicking ahead repeatedly outruns the
 * snap and the track must never walk off the end of what exists. The extra
 * images are the same handful of sources, so they come from cache.
 */
export default function PropertyStrip({ slides = [], delay = 380 }) {
  // `pos` is the track's position along the looped rail. The live slide is what
  // it lands on modulo one set, and it may go negative.
  const [pos, setPos] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [paused, setPaused] = useState(false)
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const count = slides.length

  // Auto-advance, keyed on the live index rather than `pos` so the loop's
  // silent snap back doesn't restart the dwell and stutter the cycle once per
  // lap. Hovering pauses it so a photograph can be looked at.
  const index = count ? mod(pos, count) : 0
  useEffect(() => {
    if (paused || count < 2 || reduced.current) return
    const id = setTimeout(() => setPos((p) => p + 1), SLIDE_MS)
    return () => clearTimeout(id)
  }, [index, paused, count])

  // Once the track has walked outside the first set in either direction, fold
  // it back with the transition suppressed. It lands on a congruent position —
  // a pixel-identical frame — so the seam is invisible. Driven by a timer
  // rather than transitionend, which never fires in a background tab and would
  // let `pos` wander further than the rendered rail.
  useEffect(() => {
    if (!count || (pos >= 0 && pos < count)) return
    const id = setTimeout(() => {
      setSnapping(true)
      setPos((p) => mod(p, count))
    }, RAIL_MS)
    return () => clearTimeout(id)
  }, [pos, count])

  // Two frames: one to paint at the rewound position with no transition, then
  // restore it. A single frame can land before the browser has painted.
  useEffect(() => {
    if (!snapping) return
    let inner
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSnapping(false))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [snapping])

  if (!count) return null

  const first = -Math.ceil((Math.max(0, -pos) + RAIL_SPAN) / count) * count
  const last = Math.ceil((Math.max(0, pos) + RAIL_SPAN + 1) / count) * count - 1
  const rail = Array.from({ length: last - first + 1 }, (_, k) => slides[mod(k + first, count)])

  return (
    <motion.div
      // The band arrives as one object and then starts travelling. Rising into
      // place rather than growing: the panels are a fixed size now, and the
      // only thing that should ever change their width is the viewport.
      initial={reduced.current ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      // Full-bleed: the band runs edge to edge under the padded hero above it,
      // which is why it sits outside that section's container rather than in it.
      //
      // Height is a share of the screen, not of the width: the band is the
      // bottom of a one-screen fold, so what matters is how much of that screen
      // it leaves the copy. A vw-based height would grow on a wide short window
      // — exactly where there is least room to give.
      //
      // Panel width is a division of the viewport so roughly four sit across it
      // at any size, the ones at each edge running off frame the way the design
      // draws them.
      className="h-[clamp(10rem,30dvh,21.25rem)] w-full overflow-hidden bg-surface-alt [--panel:clamp(14rem,26vw,26rem)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={`flex h-full ease-brand ${
          snapping || reduced.current ? '' : 'transition-transform duration-900'
        }`}
        // Offset by `first`, since the rail starts a set or more to the left of
        // position zero.
        style={{ transform: `translateX(calc(${first - pos} * var(--panel)))` }}
      >
        {rail.map((slide, k) => (
          <button
            key={k}
            type="button"
            // This tile's own position on the rail, not the slide index — every
            // visible tile is at or ahead of `pos`, so a click never rewinds.
            onClick={() => setPos(k + first)}
            aria-label={slide.label ? `Show ${slide.label}` : `Show panel ${mod(k + first, count) + 1}`}
            aria-current={k + first === pos ? 'true' : undefined}
            className="group relative h-full w-(--panel) shrink-0 overflow-hidden outline-none"
          >
            {slide.image && (
              <img
                src={slide.image}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            )}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
