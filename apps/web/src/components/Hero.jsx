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
   the sequence gets. 90svh on a phone, 140svh on a desktop — raised from
   70/100, which made the hero the shortest-lived section on a page whose
   chapters each get a full screen of their own. The frame itself cannot grow:
   it is one viewport, and a sticky box taller than the window is a box the
   reader can never see all of. The track is the only height a hero like this
   has to give.

   `svh` rather than `dvh`. `dvh` changes as the URL bar collapses, which on a
   scroll-driven section means the track would resize *while it is being
   scrubbed* — ScrollTrigger re-measures mid-sequence and the photograph jumps.
   `svh` is the height with the chrome showing and does not move. */
const TRACK = 'h-[190svh] md:h-[240svh]'

/* ── The shape of the backdrop, and why it is not the shape of the frame ─
   The slides are 3:2. That one fact is what the whole backdrop is built
   around, and getting it wrong is what three earlier versions of this file
   were doing: they were written against 2.17:1 panoramas, which is what the
   placeholder art in src/assets/hero happens to be, not what the CMS serves.

   A 3:2 picture in a frame around 2.1:1 is covered by scaling to the *width*,
   so the full width is always shown and the overflow is all vertical — on a
   1920x915 frame the picture renders 1280 tall and 365px of it is outside the
   frame. That is not a problem to be minimised. It is the travel: more than a
   third of a screen of real photograph to move through, at no cost in width
   and no magnification at all.

   So the backdrop is sized to the picture rather than to the frame. A box the
   width of the frame at the slides' own ratio holds the whole photograph with
   nothing cropped in either direction, and the frame is a window that starts
   at its top — open sky, which is the upper 45% of both current slides — and
   travels to its bottom, where the building meets its forecourt.

   Two consequences worth keeping in mind if this is edited:

   - The travel is measured, not declared. How far the box overhangs depends
     on the window, so the tween asks the DOM rather than carrying a number,
     and `invalidateOnRefresh` makes it ask again after a resize.
   - `min-h-full` is the floor, and it matters on phones. A 390px-wide frame
     puts this box at 260 tall against an 844px frame, which would leave most
     of the hero empty; clamped to the frame it covers, `cover` crops the
     sides as it always did, and the pan is simply zero there — which is
     honest, because a tall narrow window has no vertical room to pan through.

   Nothing scales any more. The push that used to open the hero, the
   `object-position` crop that used to move within it and the dwell breath on
   each slide were three different ways of buying vertical movement out of a
   picture that was assumed not to have any. It has plenty. Every one of them
   cost sharpness or width, and each was a separate thing to go wrong — the
   crop did, twice. One measured translate replaces all three. */
const SLIDE_RATIO = '3/2'

/* ── The order of the two beats ────────────────────────────────────────
   The photograph moves first and the copy leaves last, overlapping near the
   end. The reverse — copy out, then pan — put the best part of the hero on
   an empty frame: the building rose into a screen nobody was reading, and
   the headline had spent its time against a sky with nothing in it.

   This way the reader holds the headline while the building climbs up behind
   it, and the copy only lifts away once the building is nearly in place.

   Both numbers came down from 0.82/0.68. The ratio between them is what sets
   the handover and it is unchanged — the copy still starts at about three
   quarters of the pan — but at the old values the reader scrolled most of a
   screen before anything moved at all, and a hero that holds that long stops
   reading as deliberate and starts reading as stuck. The wait before the copy
   lifts is EXIT_START times the scrub distance, so on a desktop it is now
   about 64svh rather than 95svh.

   The third lever is TRACK itself: these are fractions of it, so lengthening
   the track stretches every one of these waits in proportion. If the sequence
   still feels slow after moving these two, that is the one to look at. */
const PAN_END = 0.62
const EXIT_START = 0.46

/* And where it has finished. The copy used to run to the end of the track,
   which made it the slowest thing in the hero by a distance: over half the
   scrub spent on a fade, so the headline hung at a third of its opacity for
   long enough to look like it had got stuck on the way out. Ending at 0.84
   cuts the exit from 0.54 of the track to 0.38 — about 30% quicker — without
   touching when it starts.

   The 0.16 left over is not dead. The pan has finished by 0.62 and the copy
   by here, so the last stretch is the building alone in the frame with
   nothing moving over it, which is the one moment in the hero the
   photograph gets to itself before the page hands over. Shortening TRACK is
   what to reach for if that moment turns out to be longer than it is worth. */
const EXIT_END = 0.84

/* How much of the exit is spent on the wave rather than on any one piece's
   own travel. At 0.55 the last word starts moving a little after the first
   has finished, which is the ratio at which a group reads as a sequence
   rather than as a block with soft edges. */
const EXIT_WAVE = 0.55

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

/* ── The bottom fade is gone, and should stay gone ─────────────────────
   The design's Rectangle 8 — a band across the bottom third, dissolving the
   photograph into the page ground — was here to hide a seam: a hero that
   ended on a lit forecourt butting straight into the next section left a
   hard line across the page where the picture ran out.

   It is removed because the hero no longer ends there. The scroll pans the
   photograph up until its bottom edge is flush with the frame, and the point
   of that pan is the ground the building stands on — which is precisely the
   band the fade was painting over. At 38% of a desktop frame it was eating
   most of the reveal, and on a phone, at 22% of a tall narrow frame, it was
   covering the part of the picture there was least of.

   The seam it was hiding is now a plain edge between the photograph and the
   partners wall below, which is `bg-void` in both themes. If that edge ever
   needs softening again, the fix is a shallow band — 8-12% — in `bg-void`,
   not the original third: anything deeper takes back what the pan exists to
   show. Two things the old implementation got right and a replacement would
   have to keep: paint a solid colour behind an alpha mask rather than ramp a
   gradient to `transparent` (which is rgba(0,0,0,0), so it drags its midpoint
   through grey and lays a dirty band across the join — DESIGN.md §9), and
   take the colour from whatever section actually follows rather than from
   `bg-base`, which is white in the light theme. */

export default function Hero() {
  const hero = useSection('hero')
  const slides = hero.slides.length ? hero.slides : [{ image: '', place: '', kind: '' }]
  const [index, setIndex] = useState(0)
  const scope = useRef(null)
  const frameRef = useRef(null)
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

  /* ── Two beats: the photograph climbs, then the copy leaves ────────────
     The frame is standing still for both. Nothing here moves the page — the
     page is what is being held — so the only thing travelling is the layer
     named in each tween, and the reader watches the hero change rather than
     watching it leave.

     Beat one is the photograph (PAN_END, above). The frame starts at the top
     of the picture, on open sky, and walks down it; the building climbs into
     view behind a headline the reader is still reading.

     Beat two is the copy, and it is a wave rather than a lift. The block used
     to climb as one rectangle, which is the one thing a hero this size should
     not do: a headline, a lede and a button moving in perfect lockstep read as
     a screenshot being slid off the screen. Taken apart, they leave the way
     they arrived — word after word across the headline, then the lede, then
     the button — and the frame empties rather than departing.

     The pieces are the headline's own masked words, in the order MaskedHeading
     laid them out, followed by the two blocks marked `data-hero-exit`. Words
     are collected by their parents rather than directly: `.word-rise` carries
     the entrance as a CSS animation with `both` fill, and a filled animation
     outranks an inline style in the cascade for as long as it is attached — a
     GSAP transform written onto that span would simply be ignored. The mask
     wrapper around it has no animation of its own and moves the word with it.

     The pan runs from the top edge of the photograph to its bottom: open sky
     to forecourt, the whole picture in order, at full width and full
     resolution. The distance is however much the backdrop overhangs the
     frame, which is measured rather than declared; see SLIDE_RATIO above for
     why there is any to measure.

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

     `ease: 'none'` throughout. Under a scrub an ease is a map from scroll
     position to progress, not a feel: anything with a slow start means the
     first centimetre of wheel does nothing, which reads as the page having
     hung rather than as the move being gentle. The stagger is what carries
     the softness here, and it does not need help. */
  useGSAP(
    () => {
      if (reduced) return undefined

      const root = copyRef.current
      const words = Array.from(root?.querySelectorAll('.word-rise') ?? [], (w) => w.parentElement)
      const blocks = Array.from(root?.querySelectorAll('[data-hero-exit]') ?? [])
      const pieces = [...words, ...blocks].filter(Boolean)
      if (!pieces.length) return undefined

      /* Fitted to the beat rather than set in the abstract. A fixed step and a
         fixed duration would overrun the beat on a long CMS headline and stop
         well short of it on a short one, and in the first case the lede would
         still be fading into the photograph’s own moment at the end. Solving
         for the duration instead pins the last piece to EXIT_END whatever the
         copy says, so the exit is the same length however many words it has to
         carry — only the gaps between them change. */
      const exit = EXIT_END - EXIT_START
      const wave = exit * EXIT_WAVE
      const duration = exit - wave

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scope.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          // The backdrop travel is a function of measured heights, and a
          // resize changes both. Without this it would keep using the
          // distance it computed against the old window.
          invalidateOnRefresh: true,
          // Promoted only while the hero is on screen. Leaving `will-change` on
          // a dozen words for the life of the document holds a dozen compositor
          // layers in memory for a section the reader passes once.
          onToggle: ({ isActive }) => {
            const hint = isActive ? 'transform, opacity' : ''
            pieces.forEach((el) => {
              el.style.willChange = hint
            })
            if (bgRef.current) bgRef.current.style.willChange = isActive ? 'transform' : ''
          },
        },
      })

      // A function, not a number, and `invalidateOnRefresh` on the trigger to
      // go with it. How far the backdrop overhangs the frame depends on the
      // window — it is the box height minus the frame height, and the box
      // height is derived from the frame width — so the only honest source for
      // it is the DOM at the moment the tween runs. `Math.min` clamps it at
      // zero for the case where the two are the same height (phones, where
      // `min-h-full` has taken over): no overhang, no travel, and nothing that
      // could drag an edge into frame.
      tl.to(
        bgRef.current,
        {
          y: () => Math.min(0, (frameRef.current?.clientHeight ?? 0) - (bgRef.current?.offsetHeight ?? 0)),
          ease: 'none',
          duration: PAN_END,
        },
        0
      )
        // Starts while the pan is still running and finishes before the track
        // does, so the last word is gone while the hero is still held and the
        // building has the frame to itself for a moment.
        //
        // A pixel travel rather than a percentage, deliberately: `yPercent` on a
        // three-letter word and on the button beneath it are wildly different
        // distances, and the wave stops reading as one gesture the moment its
        // pieces move at different speeds. 80px is roughly a line of the
        // headline — far enough to be a departure, short enough that the fade
        // carries it.
        .to(
          pieces,
          { y: -80, opacity: 0, ease: 'none', duration, stagger: { amount: wave } },
          EXIT_START
        )

      return () => {
        tl.scrollTrigger?.kill()
        tl.kill()
      }
    },
    { scope, dependencies: [reduced, hero.heading, hero.paragraph], revertOnUpdate: true }
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
      <div ref={frameRef} className="sticky top-0 isolate h-[100svh] min-h-[34rem] w-full overflow-hidden">
        {/* ── the photograph ──────────────────────────────────────────────
            Oversized and hung above the section so the scroll drift always has
            frame left to travel into. */}
        {/* Sized to the photograph rather than to the frame: full width, at
            the slides’ own ratio, so the whole picture is rendered with
            nothing cropped in either direction and the frame is a window over
            it. `top-0` puts that window at the top of the picture, which is
            where the page opens; the scroll walks it to the bottom. See
            SLIDE_RATIO for why there is room to walk.

            `min-h-full` is the floor for tall narrow windows, where the ratio
            would otherwise compute a box shorter than the frame and leave the
            hero half empty. Clamped, it covers and the pan is simply zero.

            No `style` prop, and that absence is a fix worth remembering. The
            vertical crop used to be a custom property declared here as a React
            inline style — the same element, and the same property, the scrub
            was writing. React re-applies the styles it owns on every render,
            and this component re-renders every 6.5 seconds when the carousel
            advances, so each slide change silently reset the frame to its
            opening position. Mid-scroll you would not notice; stopped at the
            bottom of the hero you would, because nothing re-applies the scrub
            until the next tick. The travel is a plain transform now, which
            React never touches and GSAP owns outright. */}
        <div
          ref={bgRef}
          aria-hidden={false}
          className={
            reduced
              ? // Nothing pans, so a box taller than the frame would only park
                // the picture at its top and crop the building away. Frame-sized,
                // `cover` centres it and the still hero is the whole subject.
                'absolute inset-0'
                : 'absolute inset-x-0 top-0 w-full min-h-full'
          }
          style={reduced ? undefined : { aspectRatio: SLIDE_RATIO }}
        >
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
                // Opacity only. The slow push on `transform` that used to ride
                // alongside it is gone with the scale it was easing — see
                // SLIDE_RATIO — and a transition on a property nothing sets is
                // a trap for whoever adds the next transform here.
                transitionProperty: 'opacity',
                transitionDuration: `${FADE_MS}ms`,
                transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
              }}
              // No transform at all. The dwell breath — a slow 7.5% push across
              // each slide’s six and a half seconds — is gone, and it is worth
              // being clear that it was not removed for being disliked. It was
              // a crop: 7.5% of the picture pushed out through the frame edges,
              // held there the whole time the slide was up, on top of whatever
              // the backdrop was already cropping. Every report of the building
              // being clipped had it as one of the contributors, and with the
              // scroll now moving through the whole photograph there is nothing
              // left for it to add. Putting it back means putting a crop back.
              //
              // `object-cover` still earns its place: on a window too tall for
              // the 3:2 box the backdrop clamps to the frame and the picture
              // has to be cropped somewhere. Centre, by default, which is the
              // right answer when there is no pan to position it for.
              className={`absolute inset-0 size-full object-cover ${
                i === index ? 'opacity-100' : 'opacity-0'
              } motion-reduce:transition-none`}
            />
          ))}
        </div>

        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: SHADE }} />
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: VEIL }} />

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
        {/* This block no longer moves — its contents do, one at a time — so the
            ref is here to be searched rather than to be animated. Still not
            `h-full`: the copy sits at the top of the frame, and the empty space
            below it was only ever there because the block used to be translated
            by its own height. */}
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

            {/* The wrappers are what the scroll moves; the `motion` elements
                inside them are what the entrance moves. Both engines write
                `transform` and `opacity`, and on one element whichever wrote last
                wins — the entrance would fight the scrub for the first second of
                the page and then stop fighting it in a way nobody could
                reproduce. Nested, they compose, and the spacing moved out to the
                wrapper so the piece that travels is the piece that was measured.

                The headline needs no such wrapper: MaskedHeading renders plain
                spans, so GSAP already has elements of its own to move. */}
            <div data-hero-exit className="mt-4 w-full max-w-[30rem] md:max-w-[44rem]">
              <motion.p
                variants={rise}
                className="text-balance font-body leading-relaxed text-bone/85 text-[clamp(0.9375rem,1.05vw,1.0625rem)]"
              >
                {hero.paragraph}
              </motion.p>
            </div>

            <div data-hero-exit className="mt-7">
              <motion.div variants={rise}>
                <PrimePill variant="invert" href={hero.ctaHref} onClick={onCta}>
                  {hero.ctaLabel}
                </PrimePill>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
