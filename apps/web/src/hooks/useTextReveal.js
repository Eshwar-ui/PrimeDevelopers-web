import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { revealText, scrambleText } from '../lib/textReveal'

/**
 * Scans a scope for text that has asked to be revealed and wires it up.
 *
 *   <h2 data-text-reveal>…</h2>            masked word rise (the default)
 *   <p data-text-reveal="lines">…</p>      masked line rise, for body copy
 *   <span data-text-reveal="chars">…</span> character cascade, for short type
 *   <span data-scramble>250+</span>        digit decode, for a figure
 *
 * An attribute rather than a wrapper component, for the same reason
 * `[data-reveal]` is one on the About page: the markup here is already carrying
 * a clamp, a measure and a colour role, and threading all of that through a
 * `<Reveal>` wrapper would cost more than it saves. A heading opts in by
 * gaining one word.
 *
 * `delay` is per element via `data-text-reveal-delay`, so a heading and the
 * lede beneath it can be offset without the parent orchestrating anything.
 */
export function useTextReveal(scope, dependencies = []) {
  useGSAP(
    () => {
      // Read directly, the way every other component here gates its own motion.
      // Bailing before the split is what makes this honest: nothing is cut into
      // pieces, nothing is hidden, and the type renders exactly as it would
      // have with no JavaScript at all.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const root = scope.current
      if (!root) return

      // Both kinds rewrite the element's own contents, so both have to be able
      // to put it back — a split left standing through an unmount leaks its
      // ScrollTrigger, and a scramble left standing hands React an element
      // whose children it did not create.
      const built = []
      const collect = (el, build) => {
        const instance = build(el)
        if (instance) built.push(instance)
      }
      root.querySelectorAll('[data-text-reveal]').forEach((el) => collect(el, revealText))
      root.querySelectorAll('[data-scramble]').forEach((el) => collect(el, scrambleText))

      // Splitting changes how tall the text is — a masked line gains its
      // clipping wrapper, a long heading can gain or lose a line — and every
      // ScrollTrigger already built on the page measured the document before
      // that happened. Without this, cards further down fire against stale
      // positions. The font is the second hit: `autoSplit` re-cuts the lines
      // when it lands, which moves things again.
      ScrollTrigger.refresh()
      document.fonts?.ready.then(() => ScrollTrigger.refresh())

      return () => built.forEach((instance) => instance.revert())
    },
    { scope, dependencies, revertOnUpdate: true }
  )
}
