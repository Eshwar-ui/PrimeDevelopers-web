import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { rise, stagger } from '../lib/motion'
import PrimePill from './PrimePill'
import MaskedHeading, { WORD_STAGGER, wordCount } from './MaskedHeading'
import TexasFlag from './TexasFlag'
import { lenis } from '../hooks/useSmoothScroll'
import { useSection } from '../context/ContentContext'

gsap.registerPlugin(ScrollTrigger)

// How long a slide holds before the next one crosses in, and how long that
// crossing takes. The fade is deliberately a large fraction of the dwell: with
// no dots, arrows or thumbnails on the frame, the change is the only thing
// telling the visitor there is more than one property, and a fast cut would
// read as a glitch rather than as the page breathing.
const SLIDE_MS = 6500
const FADE_MS = 1600

// Positive modulo — `pos` only ever runs forward here, but the helper is what
// keeps that an implementation detail rather than an assumption.
const mod = (n, m) => ((n % m) + m) % m

/* ── Legibility, not colour ─────────────────────────────────────────────
   This used to be a full sky grade — saturated blue at the crown through
   violet to rose at the horizon — reproducing the comp's colour treatment
   over whatever photograph the CMS held. It is gone. The client's read was
   that the blue slab across the top was glare sitting on top of the picture
   rather than part of it, and they are right that these are already dusk
   photographs with their own sky; re-colouring one is spending the best part
   of the image to imitate it.

   What is left does one job: keep white type legible on a photograph nobody
   has seen yet. Neutral, so it deepens the photograph instead of tinting it.
   Bringing the brand blue back is one constant, not a rewrite.

   Every stop ramps to zero *alpha* on its own RGB rather than to
   `transparent`. `transparent` is rgba(0,0,0,0), so interpolating toward it
   in sRGB drags the midpoint through grey and lays a dirty band across the
   horizon — the one part of the frame the eye is actually reading. */

// The top scrim. Holds through the header and the headline, then clears before
// the roofline. Alphas are set against the worst case rather than against this
// photograph: a blown-out midday sky is white, and 0.52 over white still
// measures about 4:1 — enough for a 70px headline, which needs 3.
const SHADE = `linear-gradient(180deg,
  rgba(6,11,20,0.62) 0%,
  rgba(6,11,20,0.52) 20%,
  rgba(6,11,20,0.34) 34%,
  rgba(6,11,20,0.12) 48%,
  rgba(6,11,20,0) 60%)`

// A second, softer deepening centred on the copy. The lede is 15px and needs
// 4.5:1, which the scrim alone does not guarantee against a white sky. Stacked
// alphas multiply rather than add — the pair reads as 1-(1-a₁)(1-a₂), so 0.34
// under 0.34 composites to 0.56, which clears the bar with room (DESIGN.md §9).
const VEIL = `radial-gradient(128% 82% at 50% 24%,
  rgba(6,11,20,0.34) 0%,
  rgba(6,11,20,0.22) 44%,
  rgba(6,11,20,0) 74%)`

/* The design's Rectangle 8 — a band across the bottom third — carried further
   than the comp draws it: this reaches the page's own ground colour, fully
   opaque, by the hero's bottom edge. That is what removes the seam. Stopping
   short, as it did at 0.58, left a lit wet parking lot butting straight into
   the next section and a hard line across the page where the photograph ran
   out.

   Painted as a solid `bg-base` element wearing an alpha mask rather than as a
   gradient ramping to `transparent`. Two reasons, and both are load-bearing:

   - `transparent` is rgba(0,0,0,0), so a gradient interpolating toward it
     drags its RGB toward black on the way. Against the dark theme that is
     nearly invisible; in the light theme, where `--color-base` is white, the
     midpoint lands on grey and lays a dirty band across the join (DESIGN.md §9).
   - The colour has to be the *token*, not a literal. The section below is
     `bg-base`, which is #0b1216 in dark and white in light. A hardcoded dark
     fade would seam correctly in one theme and paint a black bar above a white
     section in the other.

   The mask is weighted late — barely present through the first half, solid
   over the last few percent — so the photograph keeps its reflections and only
   the final stretch belongs to the page. */
const FADE_MASK = `linear-gradient(180deg,
  rgba(0,0,0,0) 0%,
  rgba(0,0,0,0.14) 24%,
  rgba(0,0,0,0.46) 48%,
  rgba(0,0,0,0.84) 68%,
  rgba(0,0,0,1) 82%)`

export default function Hero() {
  const hero = useSection('hero')
  const slides = hero.slides.length ? hero.slides : [{ image: '', place: '', kind: '' }]
  const [index, setIndex] = useState(0)
  const scope = useRef(null)
  const bgRef = useRef(null)

  const count = slides.length

  // Auto-advance. No controls are drawn — the design has none — so this is the
  // whole transport, and it is deliberately not paused on hover: there is
  // nothing on the frame for a pointer to be resting on, and a carousel that
  // silently stops because the cursor happened to be over it is a bug the
  // visitor cannot see the cause of.
  useEffect(() => {
    if (count < 2) return
    const id = setTimeout(() => setIndex((i) => mod(i + 1, count)), SLIDE_MS)
    return () => clearTimeout(id)
  }, [index, count])

  // Scroll-scrubbed drift on the whole backdrop rather than per image: every
  // slide shares one frame, so one tween moves the set. The wrapper is taller
  // than the section and hung above it, which is what gives the drift somewhere
  // to travel without ever uncovering an edge.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.fromTo(
        bgRef.current,
        { yPercent: -1.5 },
        {
          yPercent: 1.5,
          ease: 'none',
          scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: true },
        }
      )
    },
    { scope }
  )

  const onCta = (e) => {
    if (!hero.ctaHref?.startsWith('#')) return
    e.preventDefault()
    lenis.current?.scrollTo(hero.ctaHref, { offset: -20 })
  }

  return (
    // `isolate` is load-bearing rather than tidy: the grade layers below stack
    // against this section, and without it a future blend mode or a negative
    // z-index inside would resolve against the document and paint through the
    // page rather than through the photograph.
    //
    // No data-band="light" — this used to be a white section and is now a
    // photograph, so the fixed header keeps its bone chrome over it, which is
    // what the design draws.
    // 1024px exactly — the height of the comp's frame, not a fraction of the
    // viewport. That makes the hero a fixed object rather than a responsive
    // one, and everything inside it that used to be measured in `dvh` had to
    // stop being: with the frame no longer tied to the window, a short window
    // has nothing to squeeze and a `dvh` term would only shrink the type for
    // no reason (DESIGN.md §2). The `min-h` floor went with them — a minimum
    // under a fixed height can never apply.
    <section
      id="hero"
      ref={scope}
      className="relative isolate h-256 w-full overflow-hidden bg-void"
    >
      {/* ── the photograph ──────────────────────────────────────────────
          Oversized and hung above the section so the scroll drift always has
          frame left to travel into. */}
      {/* Trimmed to a 2% overhang either side. The image fits this wrapper's
          height, so every percent the wrapper hangs past the section is a
          percent of the photograph the fixed frame never shows — and the
          drift only needs somewhere to go, not a lot of it. */}
      <div ref={bgRef} aria-hidden={false} className="absolute inset-x-0 -top-[2%] h-[104%]">
        {/* The image fills the frame's height exactly — no bottom crop.
            It used to be rendered 16% taller than its frame and pinned to the
            top, which pushed the building down the frame to open sky for the
            colour grade to run through. With the grade gone there is nothing
            left to make room for, and the crop was never free: these are
            2.17:1 panoramas in a 1.4:1 frame, so `cover` fills the vertical
            and throws away the sides, and every extra percent of height was
            another percent off the width of the building. Fitting the height
            gives the strip centre back its wings. */}
        {slides.map((slide, i) => (
          <img
            key={i}
            src={slide.image}
            // Only the slide on screen describes itself. The five behind it are
            // the same frame at zero opacity, and announcing all six would read
            // out a list of properties that nobody can see.
            alt={i === index ? slide.place : ''}
            // The first slide is the LCP element of the whole site. Without the
            // priority hint the browser schedules it as one image among six and
            // the only one actually on screen finishes last.
            fetchPriority={i === 0 ? 'high' : 'auto'}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            // The slow push is a *transition* on transform, not a keyframe, and
            // that is the whole trick: a keyframe belongs to the slide it is on,
            // so pulling it off the outgoing slide snaps that frame back to
            // scale 1 while it is still half visible. A transition instead lets
            // the outgoing slide ease back over the same long duration — across
            // the 1.6s of the crossfade it retreats by a fraction of a percent,
            // which is nothing, and the seam disappears.
            style={{
              transitionProperty: 'opacity, transform',
              transitionDuration: `${FADE_MS}ms, 9000ms`,
              transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1), linear',
            }}
            // Centre origin again, now that the frame is not pinned to the
            // skyline: with the image fitted to the height, growing from the
            // top would walk the whole picture downward out of frame over the
            // dwell. About the middle it breathes evenly on all four edges.
            className={`absolute inset-0 size-full object-cover ${
              i === index ? 'scale-[1.075] opacity-100' : 'scale-100 opacity-0'
            } motion-reduce:scale-100 motion-reduce:transition-none`}
          />
        ))}
      </div>

      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: SHADE }} />
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: VEIL }} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-base"
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      />

      {/* ── the copy ────────────────────────────────────────────────────
          Set high in the frame rather than centred in it, which is what leaves
          the building the lower two thirds it was photographed for.

          112px, a deliberate 27 above the comp's own 139. The comp draws an
          85px header; ours is ~88 and carries a taller lockup, so measuring
          the heading from the top of the frame the way the comp does leaves
          more air under the rail than the comp actually shows. Pulling the
          block up closes that back to the gap the design reads as.

          The header is a fixed overlay with no ground of its own, so this
          number is also the clearance — at 112 the headline still clears the
          rail by around 24px. Below about 100 it starts to touch it. */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative flex h-full flex-col items-center px-gutter pt-[8rem] text-center md:px-gutter-lg lg:pt-[112px]"
      >
        {/* Not a motion child. A block-level lift here would carry each word's
            mask up with the word inside it, leaving nothing for the word to
            rise out of — the reveal would run and be invisible.

            The measure is set in `em` rather than px so it scales with the type:
            at every size the headline breaks in the same place the design breaks
            it, instead of holding one line at 1440 and three at 1920. */}
        {/* `w-full` with the cap on top of it, not the cap alone: a bare
            max-width taller than the column is not a cap at all — the heading
            lays out at its own measure and an `items-center` parent slides the
            overflow off one edge instead of wrapping it. On a phone that put
            the first line half off the right of the screen. */}
        <h1
          className="w-full max-w-[12.2em] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight text-bone"
          // Width alone. The `dvh` term this used to carry existed because the
          // hero was one screen tall and a short landscape window would push
          // the CTA off the fold; at a fixed 1024px there is no fold to fall
          // off, so the term would only shrink the type on short windows for
          // nothing. 4.9vw lands on the comp's 70px at 1440.
          style={{ fontSize: 'clamp(2.3rem, 4.9vw, 5.25rem)' }}
        >
          <MaskedHeading text={hero.heading} />
          {/* The state mark, set as the headline's last "word".

              Same two-span structure the words use — mask wrapper outside,
              `word-rise` inside — so it rises out of the same edge on the same
              curve, and picks up the reduced-motion opt-out that already
              disables `.word-rise` without needing its own.

              Its delay comes from `wordCount` rather than a number: the heading
              is CMS copy, and any fixed beat here would be wrong the moment
              someone edited it. One stagger step past the last word, so it
              lands as the phrase finishes rather than alongside it.

              Sized in `em`, so it tracks a headline that clamps between 2.3rem
              and 5.25rem. Slightly under the cap height — matching it exactly
              makes the flag read as a block sitting proud of the type.

              MaskedHeading emits a trailing space after every word, so the gap
              before this is already there. */}
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom -mb-[0.08em]">
            <span
              className="word-rise inline-block"
              style={{ animationDelay: `${wordCount(hero.heading) * WORD_STAGGER}s` }}
            >
              <TexasFlag className="block h-[0.62em] w-[0.93em] rounded-[0.05em] ring-1 ring-inset ring-black/10" />
            </span>
          </span>
        </h1>

        <motion.p
          variants={rise}
          className="mt-4 w-full max-w-[30rem] text-balance font-body leading-relaxed text-bone/85 text-[clamp(0.9375rem,1.05vw,1.0625rem)]"
        >
          {hero.paragraph}
        </motion.p>

        <motion.div variants={rise} className="mt-7">
          <PrimePill variant="invert" href={hero.ctaHref} onClick={onCta}>
            {hero.ctaLabel}
          </PrimePill>
        </motion.div>
      </motion.div>
    </section>
  )
}
