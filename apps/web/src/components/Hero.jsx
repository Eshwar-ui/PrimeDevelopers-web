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
import { srcSetFor } from '../lib/images'

gsap.registerPlugin(ScrollTrigger)

// How long a slide holds before the next one crosses in, and how long that
// crossing takes. The fade is deliberately a large fraction of the dwell: with
// no dots, arrows or thumbnails on the frame, the change is the only thing
// telling the visitor there is more than one property, and a fast cut would
// read as a glitch rather than as the page breathing.
const SLIDE_MS = 6500
const FADE_MS = 1600

/* ── The scroll track ───────────────────────────────────────────────────
   The hero holds its place while the reveal plays: the page does not move the
   photograph away, the photograph moves inside a frame that is standing still.
   That needs two boxes — a track taller than the viewport, and a frame stuck to
   the top of it — and the difference between the two heights is how much scroll
   the sequence gets. 70svh on a phone, 100svh on a desktop.

   `svh` rather than `dvh`. `dvh` changes as the URL bar collapses, which on a
   scroll-driven section means the track would resize *while it is being
   scrubbed* — ScrollTrigger re-measures mid-sequence and the photograph jumps.
   `svh` is the height with the chrome showing and does not move. */
const TRACK = 'h-[170svh] md:h-[200svh]'

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

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
  const copyRef = useRef(null)

  const count = slides.length

  /* ── Reduced motion collapses the track, not just the tweens ───────────
     Skipping the timeline on its own would leave a 200svh section with a
     sticky frame in it and nothing moving — two screens of dead scroll past a
     hero that has already finished saying everything. So the preference
     changes the *shape*: one screen, no track, no sticky, which is exactly the
     hero that shipped before this.

     Held in state rather than read inline so it can change. A visitor who
     turns the preference on mid-session gets the short hero on the next paint,
     and `useGSAP` re-runs off the same flag. */
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCE_QUERY).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(REDUCE_QUERY)
    const sync = () => setReduced(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  /* ── What is allowed to download, and when ──────────────────────────────
     Every slide is absolutely positioned over the same frame, so every slide
     is *in the viewport* — opacity has no bearing on it, the browser only
     asks whether the element intersects. Which means the `loading="lazy"`
     that used to sit on slides 2..6 deferred exactly nothing: all six
     1920px photographs were requested at once, and the only one on screen
     queued behind five nobody would see for another half minute.

     `mounted` is the fix, and it is a mounting policy rather than a loading
     hint because a hint the browser is free to ignore is what failed here.
     An element that does not exist cannot be fetched.

     Forward-only, as a count rather than a set, because `index` only ever
     advances by one — so the mounted slides are always a prefix. Once a
     slide is in, it stays: the crossfade needs the *outgoing* frame to still
     be there to fade out of, and unmounting it on advance would drop it to
     the black underneath in one frame rather than easing it away. */
  const [mounted, setMounted] = useState(1)

  // Nothing starts until the first slide is done. It is the LCP element of
  // the site, and slide 2 is not needed for 6.5 seconds — there is no version
  // of "sooner" that helps it and every byte it takes early is taken from the
  // one image the visitor is waiting on.
  const [primed, setPrimed] = useState(false)

  // A slide already in the browser cache can finish before React attaches its
  // onLoad, which would strand the carousel on one frame forever. Well inside
  // SLIDE_MS either way, so the next slide still has four seconds in hand.
  useEffect(() => {
    const t = setTimeout(() => setPrimed(true), 2500)
    return () => clearTimeout(t)
  }, [])

  // One slide ahead of wherever the carousel is: mounted at the start of a
  // dwell, needed at the end of it, so it has the full SLIDE_MS to arrive and
  // the crossfade never begins against a frame that has not loaded.
  useEffect(() => {
    if (!primed) return
    setMounted((m) => Math.max(m, Math.min(index + 2, count)))
  }, [primed, index, count])

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

  /* ── Two beats, in order: the copy goes, then the photograph pans ──────
     The frame is standing still for both of them. Nothing here moves the page
     — the page is what is being held — so the only thing travelling is the
     layer named in each tween, and the reader watches the hero change rather
     than watching it leave.

     Beat one, 0 to 0.45: the copy climbs by exactly its own height. `-100%`
     rather than a pixel count, because its own height is the only number that
     means "completely gone" at every viewport — its bottom edge lands on the
     top of the frame and not one line is left hanging. A measured pixel value
     would be short on a phone, where the headline wraps to four lines, and
     long on a desktop, where it is one.

     Beat two, 0.45 to 1: the photograph climbs 20% of its own height, about a
     quarter of the frame. It starts exactly where the copy stopped, so the two
     never share the screen in motion. Moving up walks the visible window down
     the picture, which is the reveal — the building's base and forecourt come
     into shot, and they are the part of these photographs that the headline
     was standing on.

     One tween on the backdrop rather than one per slide: every slide shares
     the same wrapper, so one transform moves the set.

     Triggered off the track, never off the frame. The frame is `sticky`, so
     its position relative to the viewport is a *result* of the scroll rather
     than an input to it; triggering off it makes ScrollTrigger measure a
     moving target and the sequence slowly chases its own start point. The
     track is a plain box of known height and is the only honest ruler here.

     `scrub: true` with no smoothing of its own. Lenis already lerps the scroll
     at 0.1 and ScrollTrigger reads that smoothed value, so a second pass is
     smoothing an already-smoothed signal, which is what reads as the page
     lagging behind the wheel (lib/parallax.js argues the same at length).

     `ease: 'none'` on both. Under a scrub the ease is a map from scroll
     position to progress, not a feel: anything with a slow start means the
     first centimetre of wheel does nothing, which reads as the page having
     hung rather than as the move being gentle. */
  useGSAP(
    () => {
      if (reduced) return undefined

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scope.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          // Promoted only while the hero is on screen. Leaving `will-change` on
          // these two for the life of the document holds compositor layers in
          // memory for a section the reader passes once.
          onToggle: ({ isActive }) => {
            const hint = isActive ? 'transform' : ''
            if (copyRef.current) copyRef.current.style.willChange = hint
            if (bgRef.current) bgRef.current.style.willChange = hint
          },
        },
      })

      // Positions and durations are fractions of the pass, not seconds — the
      // timeline's clock totals 1 and `scrub` maps the track's travel onto it.
      tl.to(copyRef.current, { yPercent: -100, ease: 'none', duration: 0.45 }, 0).to(
        bgRef.current,
        { yPercent: -20, ease: 'none', duration: 0.55 },
        0.45
      )

      return () => {
        tl.scrollTrigger?.kill()
        tl.kill()
      }
    },
    { scope, dependencies: [reduced], revertOnUpdate: true }
  )

  // The track is most of the page's first screenful of height, so changing it
  // has to be announced: every trigger below the hero was measured against the
  // old one.
  useEffect(() => {
    ScrollTrigger.refresh()
  }, [reduced])

  const onCta = (e) => {
    if (!hero.ctaHref?.startsWith('#')) return
    e.preventDefault()
    lenis.current?.scrollTo(hero.ctaHref, { offset: -20 })
  }

  return (
    // The track. It carries the id and the page's ground, paints nothing of
    // its own, and exists only to give the frame inside it a measured
    // distance to scroll through. The hero used to be a fixed 1024px object
    // matching the comp's frame; what a comp cannot draw is the scroll, and
    // once the scroll is the subject the height stops being a design value
    // and starts being a duration.
    //
    // No data-band="light" — this used to be a white section and is now a
    // photograph, so the fixed header keeps its bone chrome over it, which is
    // what the design draws.
    <section
      id="hero"
      ref={scope}
      className={`relative w-full bg-void ${reduced ? 'h-[100svh] min-h-[34rem]' : TRACK}`}
    >
      {/* The frame. One screen tall and stuck to the top of the track, which
          is what holds the photograph still while the reader scrolls past it.

          `sticky` rather than ScrollTrigger's own `pin`. A pin takes the
          element out of flow and puts a spacer in its place, which has to be
          re-measured on every refresh and is one more thing for Lenis to
          disagree with about where the document ends. `sticky` is the browser
          doing the same job natively: no spacer, no re-measure, nothing to
          disagree with.

          `isolate` moved here with the layers it governs — the scrims stack
          against this frame, and without it a future blend mode or negative
          z-index inside would resolve against the document and paint through
          the page rather than through the photograph.

          The `min-h` floor is for landscape phones, where one screen is ~390px
          and the copy would otherwise be crushed. */}
      <div className="sticky top-0 isolate h-[100svh] min-h-[34rem] w-full overflow-hidden">
        {/* ── the photograph ──────────────────────────────────────────────
            Oversized and hung above the section so the scroll drift always has
            frame left to travel into. */}
        {/* All the spare height is below the frame, because the pan only goes one
            way. 2% above — slack, not travel — and 28% below, against a climb of
            20% of the wrapper's own height, which is 26% of the frame. The top
            edge ends at -28% and the bottom at 102%, so neither can enter the
            frame at any point in the scrub.

            This is the number that decides how much of the picture the reveal is
            actually worth: the pan can only show what the wrapper hangs past the
            frame, and 26% of a 1024px frame is about 270px further down the
            photograph. Raising the climb means raising this height with it. */}
        <div ref={bgRef} aria-hidden={false} className="absolute inset-x-0 -top-[2%] h-[130%]">
          {/* The image fills the frame's height exactly — no bottom crop.
              It used to be rendered 16% taller than its frame and pinned to the
              top, which pushed the building down the frame to open sky for the
              colour grade to run through. With the grade gone there is nothing
              left to make room for, and the crop was never free: these are
              2.17:1 panoramas in a 1.4:1 frame, so `cover` fills the vertical
              and throws away the sides, and every extra percent of height was
              another percent off the width of the building. Fitting the height
              gives the strip centre back its wings. */}
          {slides.slice(0, mounted).map((slide, i) => (
            <img
              key={i}
              src={slide.image}
              // Until now every device downloaded the 1920px file, including a
              // phone with a 390px frame — sixteen times the pixels it can
              // resolve, over the connection least able to pay for them. The
              // transformer will cut any width, so the only thing missing was
              // telling the browser it had a choice.
              //
              // `100vw` is exact rather than approximate: the section is
              // `w-full` and the image is `size-full object-cover` inside it,
              // so the slot really is the viewport's width at every breakpoint.
              srcSet={srcSetFor(slide.image, 'full')}
              sizes="100vw"
              // Only the slide on screen describes itself. The others are the
              // same frame at zero opacity, and announcing them all would read
              // out a list of properties that nobody can see.
              alt={i === index ? slide.place : ''}
              // The first slide is the LCP element of the whole site, and the
              // <head> has already preloaded it — this keeps the <img>'s own
              // request at the same priority so the two resolve to one fetch
              // rather than racing at different priorities.
              //
              // Everything after it is explicitly *low*. They are mounted a
              // full dwell before they are needed, so there is nothing to gain
              // by letting them contend — with `auto` they were scheduled as
              // peers of the image actually on screen.
              fetchPriority={i === 0 ? 'high' : 'low'}
              // No `loading` hint. It used to say `lazy` for i > 0 and did
              // nothing at all: these are stacked on the viewport, and lazy
              // only ever defers what is off it. `mounted` above is what
              // actually holds them back.
              decoding="async"
              // Drives `primed`. onError counts as done on purpose — a slide
              // that 404s must not be able to stall the rest of the carousel.
              {...(i === 0 && { onLoad: () => setPrimed(true), onError: () => setPrimed(true) })}
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
        {/* 38% of a wide frame is a soft landing; 38% of a phone's is 320px of
            the photograph dissolved into the page ground, which is most of what
            read as dead space under the building. Shallower on a phone, where
            the frame is tall and narrow and there is far less picture to spend. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-[22%] bg-base md:h-[38%]"
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
        {/* Two elements rather than one, and the split is load-bearing: GSAP
            owns the outer transform, Motion owns the inner one. Both engines
            write `transform`, and on a single element whichever wrote last
            wins — the entrance would fight the scroll for the first second of
            the page and then stop fighting it in a way nobody could reproduce.
            Nested, they compose: the entrance lifts the block into place, the
            scroll carries the whole thing up and away. */}
        {/* Not `h-full`. The block is translated by -100% of its own height to
            clear the frame, so its height has to be the height of the copy and
            nothing else — at `h-full` that percentage would be a whole viewport
            and the headline would be long gone before the beat finished, leaving
            dead scroll in the middle of the sequence. The content sat at the top
            of the block either way; only the empty space below it has gone. */}
        <div ref={copyRef} className="relative">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center px-gutter pt-[8rem] text-center lg:pt-[112px]"
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
              className="mt-4 w-full max-w-[30rem] md:max-w-[44rem] text-balance font-body leading-relaxed text-bone/85 text-[clamp(0.9375rem,1.05vw,1.0625rem)]"
            >
              {hero.paragraph}
            </motion.p>

            <motion.div variants={rise} className="mt-7">
              <PrimePill variant="invert" href={hero.ctaHref} onClick={onCta}>
                {hero.ctaLabel}
              </PrimePill>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
