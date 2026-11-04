import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { parallax } from '../lib/parallax'

/**
 * One landing-page section, drifting a little against the one above it.
 *
 * `depth` is in pixels rather than a fraction of the section, because what the
 * number is really tuned against is the seam: the box is clipped, the chapter's
 * own ground shows at its edges, and the drift has to stay inside that band. A
 * fraction would be a different number of pixels on a phone, where these
 * sections are several times taller.
 *
 * Driven by ScrollTrigger rather than by Motion's `useScroll`/`useSpring`, and
 * the change matters more than it looks:
 *
 * - **One clock.** ScrollTrigger runs on the GSAP ticker, which is also what
 *   drives Lenis. Motion kept its own rAF, so a chapter drifting on one engine
 *   and a watermark drifting on the other were a frame apart and visibly
 *   disagreed about where the page was.
 * - **One pass of smoothing.** Lenis already lerps the scroll at 0.1.
 *   `useSpring` smoothed that again at `stiffness: 72, mass: 0.45`, which is
 *   what made these sections feel like they were trailing the scroll instead of
 *   belonging to it.
 * - **Correct trigger points inside.** Six of the nine chapters contain their
 *   own ScrollTriggers — every card stagger on the page, and now the heading
 *   reveals. Those measure the section while this transform is displacing it.
 *   `lib/parallax` zeroes all of it before a refresh so the measurements are
 *   taken where the content really is.
 */
export default function LandingParallaxChapter({ children, depth = 32, className = 'bg-base', overflowVisible = false }) {
  const chapterRef = useRef(null)
  const layerRef = useRef(null)

  useGSAP(
    () => {
      // Scrubbed across the chapter's own pass through the viewport rather than
      // the layer's: the layer is the thing being moved, and triggering a
      // movement off the element it moves is how a parallax ends up slowly
      // chasing its own start point.
      const layer = parallax(layerRef.current, { depth, start: 'top bottom', end: 'bottom top' })
      return () => layer?.kill()
    },
    { scope: chapterRef, dependencies: [depth] }
  )

  return (
    <div
      ref={chapterRef}
      className={
        'relative ' + (overflowVisible ? 'overflow-visible md:overflow-clip ' : 'overflow-clip ') + className
      }
    >
      <div ref={layerRef}>{children}</div>
    </div>
  )
}
