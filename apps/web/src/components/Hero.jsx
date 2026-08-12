import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import ArrowRight from './ArrowRight'
import { invertedCorner } from '../lib/notch'
import { sized } from '../lib/images'
import { rise, stagger } from '../lib/motion'
import PrimePill from './PrimePill'
import TexasFlag from './TexasFlag'
import MaskedHeading, { WORD_STAGGER, wordCount } from './MaskedHeading'
import { lenis } from '../hooks/useSmoothScroll'
import { useSection } from '../context/ContentContext'

gsap.registerPlugin(ScrollTrigger)

const SLIDE_MS = 6000
const RAIL_MS = 900

// Slides of headroom rendered past the live position in each direction, so the
// track always has something to move into mid-transition.
const RAIL_SPAN = 4

// Positive modulo. `pos` runs negative once the back arrow is used, and JS's %
// keeps the sign of the dividend, which would index off the front of the list.
const mod = (n, m) => ((n % m) + m) % m

// Two of these finish the notch: one rounds the panel's top edge where the bay
// ends, the other rounds its left edge where the bay lifts away. Both take the
// default origin, since both sweep away from their bottom-right.
//
// Kept to a clean alpha edge with no shading of its own: the notch's shadow is
// a drop-shadow on the group, which traces this silhouette exactly. Baking a
// band into the gradient as well would double up at the joints.
const corner = invertedCorner()

// drop-shadow follows the rendered alpha rather than a box, so one filter on
// the group shades every edge of the notch — including the two arcs, which no
// box-shadow can trace. The second, tight pass is a contact shadow that keeps
// the edge legible where the image behind it is pale.
const notchShadow = {
  filter: 'drop-shadow(0 2px 9px var(--edge-shade)) drop-shadow(0 0 1px var(--edge-shade))',
}

export default function Hero() {
  const hero = useSection('hero')
  const slides = hero.slides.length ? hero.slides : [{ image: '', place: '', kind: '' }]
  // `pos` is the track's position along the looped rail. The live slide is what
  // it lands on modulo one set, and it may go negative — the back arrow walks
  // it left, which the rail renders a lead set to accommodate.
  const [pos, setPos] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [paused, setPaused] = useState(false)
  const scope = useRef(null)
  const panelRef = useRef(null)
  const railRef = useRef(null)
  const [panelLeft, setPanelLeft] = useState(0)

  const count = slides.length
  const index = mod(pos, count)

  // The rail is rendered as a window of whole sets around wherever the track
  // currently is, with headroom on both sides. Whole sets so the repeat stays
  // aligned, and grown on demand because tapping an arrow repeatedly outruns
  // the snap and the track must never walk off the end of what exists. The
  // extra images are the same handful of sources, so they come from cache.
  const first = -Math.ceil((Math.max(0, -pos) + RAIL_SPAN) / count) * count
  const last = Math.ceil((Math.max(0, pos) + RAIL_SPAN + 1) / count) * count - 1
  const rail = Array.from({ length: last - first + 1 }, (_, k) => slides[mod(k + first, count)])

  // Dots travel forward to reach a slide, wrapping past the end rather than
  // rewinding — a jump backwards on a tap reads as a mistake. The arrows are
  // the deliberate exception: back means back.
  const goTo = (target) => setPos((p) => p + mod(target - mod(p, count), count))
  const step = (n) => setPos((p) => p + n)

  // The notch is cut in panel-local coordinates, but the thing it has to clear
  // — the header's Enquire CTA — is positioned against the viewport. Measuring
  // where the panel starts is what lets one be expressed in terms of the other.
  useEffect(() => {
    const measure = () => {
      const el = panelRef.current
      if (el) setPanelLeft(Math.round(el.getBoundingClientRect().left))
    }
    measure()
    const id = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Auto-advance; keyed on `index` rather than `pos` so the loop's silent snap
  // back doesn't restart the dwell and stutter the cycle once per lap. Hovering
  // the rail pauses it so browsing stays calm.
  useEffect(() => {
    if (paused || count < 2) return
    const id = setTimeout(() => setPos((p) => p + 1), SLIDE_MS)
    return () => clearTimeout(id)
  }, [index, paused, count])

  // Once the track has walked outside the first set in either direction, fold
  // it back with the transition suppressed. It lands on a congruent position —
  // pixel-identical frame — so the seam is invisible. Driven by a timer rather
  // than transitionend, which never fires in a background tab and would let
  // `pos` wander further than the rendered rail.
  useEffect(() => {
    if (pos >= 0 && pos < count) return
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

  // Scroll-scrubbed drift inside each frame. Two triggers, not one per image:
  // every thumbnail shares a row, and the panel's stack shares a frame, so each
  // group can ride a single scrubbed tween. Selector strings resolve within the
  // scope, and useGSAP reverts them when the rail's length changes.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const drift = (selector, trigger, distance) => {
        // The rail is absent when there's only one slide, and a ScrollTrigger
        // with a null trigger silently falls back to the tween target.
        if (!trigger) return
        gsap.fromTo(
          selector,
          { yPercent: -distance },
          {
            yPercent: distance,
            ease: 'none',
            scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true },
          }
        )
      }
      drift('[data-parallax="panel"]', panelRef.current, 6)
      drift('[data-parallax="thumb"]', railRef.current, 5)
    },
    { scope, dependencies: [rail.length] }
  )

  const active = slides[index] ?? slides[0]

  const onCta = (e) => {
    if (!hero.ctaHref?.startsWith('#')) return
    e.preventDefault()
    lenis.current?.scrollTo(hero.ctaHref, { offset: -20 })
  }

  return (
    <section
      id="hero"
      data-band="light"
      ref={scope}
      className="relative w-full overflow-hidden bg-surface text-content [--edge-shade:rgba(18,30,38,0.26)] lg:h-dvh lg:max-h-240 lg:min-h-152"
    >
      <div className="mx-auto grid max-w-[1560px] grid-cols-1 gap-12 px-6 pb-8 pt-28 md:px-12 lg:h-full lg:grid-cols-[1.06fr_1fr] lg:gap-7 lg:pb-7 lg:pt-5">
        {/* ── copy column ─────────────────────────────────────────── */}
        {/* min-w-0: grid items default to min-width:auto, and the thumbnail
            rail's shrink-0 children would otherwise set a min-content width
            wide enough to swallow the visual column whole. */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          // justify-between: once the rail hits its ceiling, whatever height is
          // still spare is shared out between every block rather than pooling
          // into one visible band above the thumbnails.
          className="min-w-0 lg:flex lg:h-full lg:flex-col lg:justify-between lg:pt-[clamp(4rem,11dvh,6.5rem)]"
        >
          <h1
            className="font-display font-bold uppercase leading-[1.03] tracking-tight text-content"
            // Governed by whichever runs out first, width or height, so a
            // short-and-wide window shrinks the headline instead of pushing
            // the thumbnail rail off the fold.
            style={{ fontSize: 'clamp(2.25rem, min(4.9vw, 9.5dvh), 4.35rem)' }}
          >
            <MaskedHeading text={hero.heading} />
            {/* The flag is masked with the words so it arrives as the last beat
                of the line rather than being present before the type it
                belongs to. */}
            <span className="inline-block overflow-hidden pb-[0.08em] align-bottom -mb-[0.08em]">
              <span
                className="word-rise inline-block"
                style={{ animationDelay: `${wordCount(hero.heading) * WORD_STAGGER}s` }}
              >
                <TexasFlag className="inline-block h-[0.62em] w-auto translate-y-[0.07em] rounded-[0.07em]" />
              </span>
            </span>
          </h1>

          <motion.p
            variants={rise}
            className="mt-7 max-w-120 font-body text-[15px] leading-relaxed text-content/70"
          >
            {hero.paragraph}
          </motion.p>

          <motion.div variants={rise}>
            <PrimePill
              href={hero.ctaHref}
              onClick={onCta}
              className="mt-[clamp(1.5rem,4dvh,2.25rem)]"
            >
              {hero.ctaLabel}
            </PrimePill>
          </motion.div>

          {/* ── thumbnail rail — the slide index, tracking the main visual ── */}
          {count > 1 && (
            <motion.div
              variants={rise}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              // The rail claims the column's leftover height rather than being
              // pushed to the bottom by a margin, so a taller window grows the
              // thumbnails instead of opening a gap above them.
              ref={railRef}
              // Thumbnail width is a division of the rail, not a fixed length:
              // the column is a fraction of the viewport, so anything fixed
              // only fits at one window size and clips the last one everywhere
              // else. Two across on narrow screens, three from sm up.
              className="mt-12 [--thumb:calc((100%_-_1.25rem)/2)] sm:[--thumb:calc((100%_-_2.5rem)/3)] lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:pt-10"
            >
              <div className="overflow-hidden lg:max-h-56 lg:min-h-22 lg:flex-1">
                <div
                  className={`flex gap-5 ease-brand lg:h-full ${
                    snapping ? '' : 'transition-transform duration-900'
                  }`}
                  // Offset by `first`, since the rail starts a set or more to
                  // the left of position zero.
                  style={{
                    transform: `translateX(calc(${first - pos} * (var(--thumb) + 1.25rem)))`,
                  }}
                >
                  {rail.map((slide, k) => (
                    <button
                      key={k}
                      type="button"
                      // This tile's own position on the rail, not the slide
                      // index — every visible tile is at or ahead of `pos`, so
                      // a click never rewinds.
                      onClick={() => setPos(k + first)}
                      aria-label={`Show ${slide.place || `slide ${mod(k + first, count) + 1}`}`}
                      aria-current={k + first === pos ? 'true' : undefined}
                      className={`relative h-[7.1rem] w-(--thumb) shrink-0 overflow-hidden rounded-[14px] bg-surface-alt transition-opacity duration-500 lg:h-full ${
                        mod(k + first, count) === index ? '' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {slide.image && (
                        <img
                          data-parallax="thumb"
                          // A rail tile, not a full-bleed slide: `thumb` keeps
                          // this a ~30KB request instead of the ~115KB the
                          // blanket 1920px transform would hand it, and `lazy`
                          // puts it behind the panel image in the fetch queue
                          // rather than alongside it.
                          src={sized(slide.image, 'thumb')}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          // Oversized and centred so the scroll drift always
                          // has frame left to travel into.
                          className="absolute inset-x-0 top-[-10%] h-[120%] w-full object-cover"
                        />
                      )}
                      <span
                        aria-hidden
                        style={{ boxShadow: 'inset 0 0 14px var(--edge-shade)' }}
                        className="pointer-events-none absolute inset-0 rounded-[14px]"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Index left, transport right — the dots read as position and
                  the arrows as controls, so splitting them to opposite ends
                  keeps the two jobs from being mistaken for one cluster. */}
              <div className="mt-5 flex items-center justify-between gap-6">
                <div className="flex items-center gap-2.5">
                  {slides.map((slide, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Go to ${slide.place || `slide ${i + 1}`}`}
                      className={`size-1.75 rounded-full transition-colors duration-300 ${
                        i === index ? 'bg-accent' : 'bg-content/20 hover:bg-content/40'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous property"
                    className="flex size-8.5 shrink-0 items-center justify-center rounded-full border border-content/15 text-content transition-colors duration-300 hover:border-accent hover:text-accent"
                  >
                    <ArrowRight className="size-3.5 rotate-180" />
                  </button>

                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next property"
                    className="flex size-8.5 shrink-0 items-center justify-center rounded-full border border-content/15 text-content transition-colors duration-300 hover:border-accent hover:text-accent"
                  >
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* ── visual column ───────────────────────────────────────── */}
        <div
          ref={panelRef}
          style={{ '--notch-w': `calc(var(--nav-bay, 65.5rem) - ${panelLeft}px)` }}
          // lg:rounded-tl-none — once the notch is cut, the panel's own
          // top-left corner falls inside it. Left rounded, its arc and the
          // inner shadow tracing it show through as a phantom corner.
          className="panel-wipe relative h-96 min-w-0 overflow-hidden rounded-(--notch-r) bg-surface-alt [--notch-h:4.25rem] [--notch-r:28px] sm:h-128 lg:h-full lg:rounded-tl-none"
        >
          {slides.map((slide, i) => (
            <img
              key={i}
              data-parallax="panel"
              src={slide.image}
              alt={i === index ? slide.place : ''}
              // The first panel image is the LCP element. `fetchPriority` is
              // what stops the browser treating it as one more image among a
              // dozen and scheduling it behind the rail — it used to finish
              // last of the hero's requests despite being the only one at full
              // size on screen. Every other slide is stacked at opacity-0
              // behind it, so those are lazy: they are not visible, and racing
              // the one that is buys nothing.
              fetchPriority={i === 0 ? 'high' : 'auto'}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={`absolute inset-x-0 top-[-10%] h-[120%] w-full object-cover transition-opacity duration-900 ease-out ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}

          {/* Inner shadow along the panel's own edges. It has to be its own
              layer: an inset box-shadow on the panel would paint beneath the
              images, not over them. */}
          <span
            aria-hidden
            style={{ boxShadow: 'inset 0 0 22px var(--edge-shade)' }}
            className="pointer-events-none absolute inset-0 rounded-(--notch-r) lg:rounded-tl-none"
          />

          {/* ── the notch ────────────────────────────────────────────
              A bay of page-white bitten out of the panel's top-left so the
              header rail reads on white, closed at all three corners: the
              bay's own convex radius makes the reflex corner concave, and
              an inverted corner at each end rounds the panel's top and left
              edges where they resume. Width comes from --nav-bay, which the
              Navbar measures off the live CTA — CMS-driven link labels make
              it unknowable up front. */}
          <div
            aria-hidden
            style={notchShadow}
            className="pointer-events-none absolute inset-0 hidden lg:block"
          >
            <span className="absolute left-0 top-0 h-(--notch-h) w-[min(var(--notch-w),100%)] rounded-br-(--notch-r) bg-surface" />
            {/* Half a pixel of overlap onto the bay — a butt joint against a
                fractional calc leaves a hairline of image showing through. */}
            <span
              style={corner}
              className="absolute left-[calc(var(--notch-w)-0.5px)] top-0 size-(--notch-r)"
            />
            <span
              style={corner}
              className="absolute left-0 top-[calc(var(--notch-h)-0.5px)] size-(--notch-r)"
            />
          </div>

          {/* current property caption, floated over the lower-right corner */}
          <div className="absolute bottom-4 right-4 w-64 rounded-[22px] bg-surface p-5 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.5)] lg:w-75 lg:p-6">
            {hero.eyebrow && (
              <span className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
                {hero.eyebrow}
              </span>
            )}
            <p className="mt-2 font-display text-[1.3rem] font-bold leading-tight text-content">
              {active.place}
            </p>
            <p className="mt-1 font-body text-[13px] text-content/70">{active.kind}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
