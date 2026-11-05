import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(ScrollTrigger, CustomEase)

/* The JS twin of `--ease-brand`, created again here rather than imported.
   DESIGN.md §5 names three curves so the next component cannot invent a fourth
   that is almost the same — and `power3.out`, which is what a GSAP tween
   reaches for by reflex, is close to the token and not equal to it. A card
   dealing in on power3.out beside a heading rising on ease-brand is exactly the
   "merely similar" that naming the curves was meant to prevent.

   Repeating the control points is safe and deliberate: `CustomEase.create`
   registers by name and is idempotent, both callers lift the same numbers off
   the same `cubic-bezier(0.16, 1, 0.3, 1)`, and a module that reached into
   lib/textReveal for them would make a grid of logos depend on SplitText and
   ScrambleText for the sake of one curve. */
CustomEase.create('brand', 'M0,0 C0.16,1 0.3,1 1,1')

/** Honoured by every entry point here; a reveal is the first thing to drop. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* The longest a wave may take end to end, however many pieces are in it.

   The step is what the eye reads — one card after another, at a readable
   interval — but a step alone is a promise about the gap rather than about the
   total, and seventeen cap listings at 0.06 is a second of dealing after the
   last one is already on screen. Past about this point the reader stops seeing
   a sequence and starts seeing the page still loading. */
const MAX_WAVE = 1.1

/**
 * Deals a group of elements into view one after the other.
 *
 * Order is DOM order, which in a CSS grid is row-major — so a wall of logos
 * sweeps across its first row, then across its second, which is the order the
 * eye reads them in anyway. Nothing here needs to know the column count: a
 * grid that goes from five columns to three at a breakpoint re-flows the same
 * list, and the sweep re-flows with it.
 *
 * Triggered once, off the container rather than off each child. Per-child
 * triggers were how the partner wall used to do this and they cannot produce a
 * sequence: twenty tiles entering the viewport together is twenty triggers
 * firing in the same frame, and the only thing separating them is whatever
 * delay each was handed. The container is the one ruler that puts them in a
 * line.
 *
 * `gsap.from` rather than a CSS hidden state plus a tween. If the bundle never
 * loads, if GSAP throws, if the plugin is missing — nothing ran, nothing was
 * hidden, and the cards are simply there. The failure mode is "no animation",
 * never "no content" (lib/textReveal.js argues the same at length).
 */
export function revealGroup(
  container,
  { targets, step = 0.06, y = 30, duration = 0.85, start = 'top 85%' } = {}
) {
  if (!container || prefersReducedMotion()) return undefined

  const items = targets ?? Array.from(container.children)
  if (!items.length) return undefined

  const tween = gsap.from(items, {
    y,
    opacity: 0,
    duration,
    ease: 'brand',
    stagger: { amount: Math.min((items.length - 1) * step, MAX_WAVE) },
    scrollTrigger: { trigger: container, start, once: true },
    // A `.from()` leaves its inline transform and opacity behind permanently,
    // and an inline style always beats a utility class (DESIGN.md §9) — which
    // is what would stop a `hover:-translate-y` ever moving the tile again.
    onComplete: () => gsap.set(items, { clearProps: 'transform,opacity' }),
  })

  return {
    kill() {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(items, { clearProps: 'transform,opacity' })
    },
  }
}
