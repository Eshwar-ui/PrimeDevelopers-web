import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useTime, useTransform } from 'motion/react'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import logomark from '../assets/prime-logomark.svg'

/**
 * The partner constellation — three counter-rotating orbits.
 *
 * Every ring is a full 360° of evenly spaced slots, but only the half above
 * the horizon is ever on screen. A slot that sinks below it gives its logo
 * back to a queue and comes back up carrying a different one, so the wall
 * cycles through the whole roster rather than showing a fixed arrangement.
 * That is also why there are far more slots than visible marks.
 *
 * Geometry: the origin is the bottom-centre of the container, radii are
 * percentages of its *width* (never its height — two axes give ellipses), and
 * angles are measured off the right-hand horizon, so 90 is straight up. The
 * container's own `aspect-[100/44]` is the other half of that contract: 44 has
 * to stay above the outermost radius plus half a disc, or the top of the widest
 * orbit is clipped.
 */

// `dir` alternates so neighbouring rings sweep against each other. The periods
// are deliberately not multiples of one another: rings that shared a factor
// would keep re-forming the same arrangement, which reads as one rigid disc
// turning rather than three independent orbits.
const RINGS = [
  // `size` is a share of the orbit's width, so a disc is only ever as big as
  // the viewport lets it be. At the old 6.2/5.8/5.2 that came out at 43-51px on
  // a 1024 window — circles with an unreadable smudge in them. These land at
  // 56-66px there and 84-99px at 1440, which is the smallest a mark can be and
  // still be a logo rather than a dot.
  { radius: 16, size: 8.0, slots: 4, phase: 45, period: 52, dir: 1 },
  { radius: 28, size: 7.4, slots: 6, phase: 20, period: 67, dir: -1 },
  { radius: 40, size: 6.8, slots: 8, phase: 10, period: 83, dir: 1 },
]

// Where a mark starts and finishes fading, in degrees off the horizon. The
// swap happens at zero opacity, so a logo is never seen changing.
const FADE_EDGE = 8
const FADE_FULL = 24

/** A mark's opacity at a given angle — 0 anywhere below the horizon. */
function visibility(angle) {
  const a = ((angle % 360) + 360) % 360
  if (a <= FADE_EDGE || a >= 180 - FADE_EDGE) return 0
  if (a < FADE_FULL) return (a - FADE_EDGE) / (FADE_FULL - FADE_EDGE)
  if (a > 180 - FADE_FULL) return (180 - FADE_EDGE - a) / (FADE_FULL - FADE_EDGE)
  return 1
}

/** Every slot on every ring, flattened. Stable for the life of the module. */
const SLOTS = RINGS.flatMap((ring, ringIndex) =>
  Array.from({ length: ring.slots }, (_, i) => ({
    ring: ringIndex,
    radius: ring.radius,
    size: ring.size,
    period: ring.period,
    dir: ring.dir,
    base: ring.phase + (360 / ring.slots) * i,
  }))
)

// Dissolves an arc as it nears the horizon rather than letting the container's
// edge chop it off — the arcs read as continuing past the section, not as
// circles that were cropped. Lives on the ring's outer element, which never
// rotates, so the fade stays pinned to the horizon while the stroke turns.
// The Prime mark at the origin: its width as a share of the orbit's unit, and
// its own aspect from the SVG's viewBox (929.04 x 1080). Both are needed to
// anchor it against a horizon that is horizontal in one framing and vertical in
// the other.
const MARK_SHARE = 0.045
const MARK_RATIO = 1080 / 929.04

const fadeToward = (side) =>
  `linear-gradient(to ${side}, transparent 52%, rgba(0,0,0,0.35) 63%, #000 84%)`

/**
 * The two framings the orbit is drawn in.
 *
 * Same rings, same angles, same clock — only the edge they hang off changes.
 * Wide, the orbit sits on the bottom edge and opens upward. Narrow, that is
 * hopeless: the radius is bounded by the shorter side, so a bottom-hung orbit
 * on a phone is a 300px-wide sliver. Pivoting it a quarter turn onto the left
 * edge trades the width it does not have for the height it does, and the marks
 * come up out of the left instead of the floor.
 *
 * `unit` is the dimension radii are measured against — the one the orbit is
 * free to grow along. Everything else follows from that, which is why this is
 * a table and not two copies of the geometry.
 */
const FRAMES = {
  bottom: {
    unit: (w) => w,
    origin: (w, h) => ({ x: w / 2, y: h }),
    // 90° points away from the horizon; y grows downward in screen space.
    offset: (rad, r) => ({ dx: Math.cos(rad) * r, dy: -Math.sin(rad) * r }),
    fade: fadeToward('top'),
    // Where the Prime mark sits relative to the origin, given its own size:
    // standing *on* the horizon and centred along it, never straddling it.
    markAnchor: (mw, mh) => ({ dx: -mw / 2, dy: -mh }),
  },
  left: {
    unit: (_w, h) => h,
    origin: (w, h) => ({ x: 0, y: h / 2 }),
    // The same formula with sine and cosine swapped — that *is* the quarter
    // turn. 90° now points right, 0° down the horizon, 180° up it.
    offset: (rad, r) => ({ dx: Math.sin(rad) * r, dy: Math.cos(rad) * r }),
    fade: fadeToward('right'),
    // Same idea rotated: flush against the left horizon, centred down it.
    markAnchor: (mw, mh) => ({ dx: 0, dy: -mh / 2 }),
  },
}

// Carves the filled disc down to a hairline annulus. `closest-side` on a square
// puts the gradient's edge exactly on the inscribed circle, which is also where
// `rounded-full` clips — so the corners never leak the gradient underneath.
const RING_STROKE = 'radial-gradient(closest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))'

// Why a conic gradient instead of a plain `border`: a uniform ring looks
// identical at every angle, so rotating one animates nothing.
const RING_SWEEP =
  'conic-gradient(from 0deg, rgba(99,180,220,0.12), rgba(99,180,220,0.55) 25%, rgba(99,180,220,0.12) 50%, rgba(99,180,220,0.44) 75%, rgba(99,180,220,0.12) 100%)'

/** Tracks a media query, so layout state lives with the same breakpoint the CSS uses. */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    // Re-read on mount as well as on change: between first render and this
    // effect the viewport may already have been resized past the breakpoint.
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * One orbiting slot.
 *
 * Position, opacity and scale are derived from a shared clock as motion values
 * and written straight to the DOM. Driving eighteen of these through React
 * state would mean eighteen re-renders a frame; this way the component only
 * re-renders when its *logo* changes, which is a handful of times a minute.
 */
function OrbitSlot({ slot, index, logo, unit, origin, frame, time, onCross }) {
  const radiusPx = (slot.radius / 100) * unit
  const sizePx = (slot.size / 100) * unit
  const half = sizePx / 2

  const angle = useTransform(time, (t) => slot.base + slot.dir * (t / (slot.period * 1000)) * 360)
  // Anchored at the container's top-left, so each offset carries the origin
  // itself plus the half-size that centres the disc on its point of the ring.
  // Doing it this way rather than with a CSS anchor is what lets one component
  // serve both framings.
  const x = useTransform(angle, (a) => origin.x + frame.offset((a * Math.PI) / 180, radiusPx).dx - half)
  const y = useTransform(angle, (a) => origin.y + frame.offset((a * Math.PI) / 180, radiusPx).dy - half)
  const opacity = useTransform(angle, visibility)
  const scale = useTransform(opacity, (o) => 0.82 + 0.18 * o)

  // Only the crossing matters, not the frame-by-frame value — `onCross` fires
  // twice per revolution, not sixty times a second.
  const wasVisible = useRef(null)
  useMotionValueEvent(opacity, 'change', (value) => {
    const nowVisible = value > 0
    if (wasVisible.current === nowVisible) return
    wasVisible.current = nowVisible
    onCross(index, nowVisible)
  })

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ width: sizePx, height: sizePx, x, y, opacity, scale }}
    >
      {logo && (
        <div
          className={
            'flex h-full w-full items-center justify-center rounded-full p-[14%] shadow-[0_18px_45px_-20px_rgba(0,0,0,0.65)] ' +
            (logo.darkPanel ? 'bg-carbon ring-1 ring-white/15' : 'bg-white')
          }
        >
          <img
            src={sized(logo.image, 'logo')}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </motion.div>
  )
}

export default function Partners() {
  const about = useSection('about_home')
  const { logos = [] } = useSection('marquee')
  const reduced = useReducedMotion()

  const visibleLogos = useMemo(() => logos.filter((logo) => logo.image), [logos])

  // One clock for all eighteen slots rather than one apiece.
  const time = useTime()

  const orbitRef = useRef(null)
  // Both dimensions, because which one the radii are measured against is what
  // changes between the two framings.
  const [box, setBox] = useState({ w: 0, h: 0 })

  // Matches the `lg:` the container's aspect ratio switches on. Read from the
  // same breakpoint rather than inferred from the measured box, so the frame
  // and the CSS can never disagree about which layout is in play.
  const wide = useMediaQuery('(min-width: 1024px)')
  const frame = wide ? FRAMES.bottom : FRAMES.left
  const unit = frame.unit(box.w, box.h)
  const origin = frame.origin(box.w, box.h)

  // Radii are percentages but the transforms need pixels, so the orbit's width
  // has to be measured. Re-renders only on resize.
  useEffect(() => {
    const node = orbitRef.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) =>
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height })
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // `assigned` is what each slot is currently carrying — null for the slots
  // below the horizon — and `queue` is everything waiting its turn. Together
  // they always hold each logo exactly once, which is what stops the same mark
  // from appearing on two rings at the same time.
  const [pool, setPool] = useState({ assigned: [], queue: [] })

  useEffect(() => {
    const queue = visibleLogos.slice()
    const assigned = SLOTS.map((slot) => (visibility(slot.base) > 0 ? (queue.shift() ?? null) : null))
    setPool({ assigned, queue })
  }, [visibleLogos])

  // Kept pure — no queue mutation in here. React invokes state updaters twice
  // under StrictMode, and a `shift()` inside one would eat two logos per pass.
  const handleCross = useCallback((slotIndex, nowVisible) => {
    setPool((prev) => {
      const assigned = prev.assigned.slice()
      const queue = prev.queue.slice()
      if (nowVisible) {
        if (assigned[slotIndex] != null || !queue.length) return prev
        assigned[slotIndex] = queue.shift()
      } else {
        if (assigned[slotIndex] == null) return prev
        // Onto the back, so a mark waits out the whole roster before returning.
        queue.push(assigned[slotIndex])
        assigned[slotIndex] = null
      }
      return { assigned, queue }
    })
  }, [])

  // The logos are the section now. Without them there is nothing left but a
  // kicker over an empty orbit, so it hides itself entirely.
  if (!visibleLogos.length) return null

  return (
    <section id="partners" className="relative isolate overflow-hidden bg-void">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(115%_75%_at_50%_92%,rgba(0,115,164,0.30),transparent_58%)]"
      />

      <div className="relative mx-auto max-w-[1600px] px-gutter py-14 md:px-gutter-lg md:py-18 xl:py-20">
        {/* The kicker is all the copy this section carries — the heading,
            paragraph and stat row that used to sit under it are `about_home`'s,
            and the About section renders them itself. */}
        <div className="mx-auto flex max-w-[34rem] items-center gap-5 text-[0.72rem] font-bold uppercase tracking-[0.22em] text-accent-soft md:text-[0.8rem]">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-accent-soft/70" />
          <h2>{about.eyebrow || 'Our Partners'}</h2>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-accent-soft/70" />
        </div>

        {/* Hidden from assistive tech, and the marks carry empty alt text: the
            roster churns as the rings turn, and a list that reorders itself
            every few seconds is noise to a screen reader. The full set is
            published once, in stable order, by the list below. */}
        <div
          ref={orbitRef}
          aria-hidden
          // Three bands, two framings, and a gap in the middle on purpose.
          //
          // Phones get the left-hung orbit: tall and narrow, because its radii
          // are measured against the height and it grows down the page.
          // Desktops get the bottom-hung one: wide and shallow, growing across.
          //
          // Between them — 768 to 1023 — neither works. A left-hung orbit on a
          // 768px-wide box wants to be ~1080px tall and leaves half its width
          // empty, and a bottom-hung one is back to the unreadable 30px discs.
          // That band keeps the flat grid instead.
          className="relative mt-12 aspect-[10/19] w-full md:hidden lg:mt-14 lg:block lg:aspect-[100/44]"
        >
          {RINGS.map((ring) => (
            // Two elements, because they need two different transforms. The
            // outer one is centred on the origin and scales in on entry; the
            // inner one spins. Collapsing them would turn the horizon fade with
            // the stroke, dissolving the arcs somewhere unrelated to the
            // horizon.
            <motion.span
              key={ring.radius}
              className="absolute left-0 top-0 aspect-square"
              // Sized and placed in pixels off the frame's origin, like the
              // discs, rather than as a percentage of one fixed edge — the
              // percentage form only ever described the bottom-hung framing.
              // Scaling still pivots on the arc's own centre, which is the
              // origin, so the entrance grows out of the mark either way.
              style={{
                width: (ring.radius / 100) * unit * 2,
                x: origin.x - (ring.radius / 100) * unit,
                y: origin.y - (ring.radius / 100) * unit,
                maskImage: frame.fade,
                WebkitMaskImage: frame.fade,
              }}
              initial={reduced ? false : { opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-8% 0px' }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundImage: RING_SWEEP,
                  maskImage: RING_STROKE,
                  WebkitMaskImage: RING_STROKE,
                }}
                // Same period and direction as the marks riding this ring, so
                // the stroke and its logos travel together.
                animate={reduced ? undefined : { rotate: ring.dir * 360 }}
                transition={{ duration: ring.period, ease: 'linear', repeat: Infinity }}
              />
            </motion.span>
          ))}

          {unit > 0 &&
            SLOTS.map((slot, index) => (
              <OrbitSlot
                key={index}
                slot={slot}
                index={index}
                logo={pool.assigned[index] ?? null}
                unit={unit}
                origin={origin}
                frame={frame}
                time={time}
                onCross={handleCross}
              />
            ))}

          {/* The mark the orbits radiate from. Sits *on* the horizon rather
              than centred over it, so the constellation reads as rising out of
              it — off the floor when the orbit hangs from the bottom, out of
              the left edge when it hangs from the side.

              Placed in pixels rather than by CSS anchor for the same reason the
              arcs are: Motion owns the transform here (a `-translate-x-1/2`
              class is overwritten the moment `y` animates), and the anchor
              itself has to move with the framing. */}
          {unit > 0 && (
            <motion.img
              src={logomark}
              alt=""
              className="absolute left-0 top-0"
              style={{
                width: MARK_SHARE * unit,
                x: origin.x + frame.markAnchor(MARK_SHARE * unit, MARK_SHARE * unit * MARK_RATIO).dx,
                y: origin.y + frame.markAnchor(MARK_SHARE * unit, MARK_SHARE * unit * MARK_RATIO).dy,
              }}
              initial={reduced ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-8% 0px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </div>

        {/* The whole roster, in stable order.

            Visible only in the middle band, where neither framing of the orbit
            fits. Either side of it the orbit is on screen and this collapses to
            `sr-only` — still in the DOM, because the orbit is `aria-hidden` and
            this is the one place the partners are published to assistive tech
            in a stable order that does not churn as the rings turn. */}
        <ul
          className="mt-12 sr-only md:not-sr-only md:grid md:grid-cols-5 md:gap-4 lg:sr-only"
          aria-label="Our partners"
        >
          {visibleLogos.map((logo, i) => (
            <li
              key={logo.image + '-' + i}
              className={
                'flex aspect-square items-center justify-center rounded-full p-[14%] ' +
                (logo.darkPanel ? 'bg-carbon ring-1 ring-white/15' : 'bg-white')
              }
            >
              <img
                src={sized(logo.image, 'logo')}
                alt={logo.alt ?? ''}
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
