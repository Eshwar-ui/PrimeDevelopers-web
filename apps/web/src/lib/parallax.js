import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Every parallax target currently on the page.
 *
 * Kept so they can all be put back to zero before ScrollTrigger measures
 * anything — see `hookRefresh` below, which is the reason this module exists
 * at all rather than each component rolling its own scrub.
 */
const targets = new Set()
let hooked = false

/**
 * The fix for parallax and ScrollTrigger disagreeing about where things are.
 *
 * ScrollTrigger works out a trigger's start and end by measuring the element,
 * once, on refresh. Parallax moves elements. So any trigger inside a parallax
 * layer is measured while that layer is displaced by however much the scroll
 * position happened to displace it — on the homepage, up to 42px, in whichever
 * direction, differently for each of the nine chapters. Every card stagger and
 * heading reveal on that page fires at the wrong point, and the error changes
 * depending on where the reader was when the refresh happened.
 *
 * Zeroing the transforms during `refreshInit` — which runs before any
 * measurement — means everything is measured where it actually lives in the
 * document. The scrubs re-apply on the update that follows, so nothing is
 * visibly reset.
 *
 * This is why all parallax has to run through one module. A single layer moved
 * by some other engine reintroduces the whole problem, because nothing here
 * knows to zero it.
 */
function hookRefresh() {
  if (hooked) return
  hooked = true
  ScrollTrigger.addEventListener('refreshInit', () => {
    targets.forEach((el) => gsap.set(el, { y: 0, yPercent: 0, scale: 1 }))
  })
}

/** Honoured by every entry point here; parallax is the first thing to drop. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scroll-scrubbed drift for one element.
 *
 * `speed` is a fraction of the element's own height, so a layer keeps its
 * relationship to the content at every viewport size — the unit a leaf layer
 * should almost always use. `depth` is the same movement in pixels, for the
 * case where the drift is tuned against a seam rather than against the element:
 * the homepage chapters are clipped boxes whose ground shows at the edges, and
 * there the gap is a number of pixels, not a share of a section that is four
 * times taller on a phone.
 *
 * Positive drifts up — the element travels against the scroll, which reads as
 * nearer. Negative drifts down, which reads as further away.
 *
 * `scrub: true`, with no smoothing of its own. Lenis already lerps the scroll
 * at 0.1 and ScrollTrigger reads that smoothed value, so anything added here is
 * a second pass over an already-smoothed signal — which is what made the
 * previous spring-driven version feel like it was lagging behind the page
 * rather than moving with it.
 */
export function parallax(el, { speed = 0, depth = 0, scale = 0, start = 'top bottom', end = 'bottom top' } = {}) {
  if (!el || prefersReducedMotion()) return undefined
  hookRefresh()
  targets.add(el)

  const from = {}
  const to = { ease: 'none' }

  if (depth) {
    from.y = depth
    to.y = -depth
  } else if (speed) {
    // The halving keeps `speed` reading as "fraction of its own height
    // travelled across the whole pass" rather than per direction.
    from.yPercent = speed * 50
    to.yPercent = -speed * 50
  }

  // A slow push rather than a drift, for a photograph that should feel like it
  // is being approached. One direction only: scrubbed back and forth a zoom
  // that reverses reads as a mistake, so it starts scaled and settles at rest.
  if (scale) {
    from.scale = scale
    to.scale = 1
  }

  const tween = gsap.fromTo(el, from, {
    ...to,
    scrollTrigger: {
      trigger: el,
      start,
      end,
      scrub: true,
      // Promoted only while it is on screen. The previous version pinned
      // `will-change: transform` to nine full-page sections for the lifetime of
      // the document, which is nine compositor layers held in memory to animate
      // whichever one the reader is actually looking at.
      onToggle: ({ isActive }) => {
        el.style.willChange = isActive ? 'transform' : ''
      },
    },
  })

  return {
    kill() {
      tween.scrollTrigger?.kill()
      tween.kill()
      targets.delete(el)
      el.style.willChange = ''
      gsap.set(el, { clearProps: 'transform' })
    },
  }
}

/**
 * Reads the parallax a piece of markup asked for.
 *
 *   data-parallax="-0.3"        drift, as a fraction of the element's height
 *   data-parallax-depth="28"    drift, in pixels
 *   data-parallax-scale="1.12"  settles from this scale to rest
 */
export function parallaxFromAttrs(el) {
  return parallax(el, {
    speed: Number(el.dataset.parallax) || 0,
    depth: Number(el.dataset.parallaxDepth) || 0,
    scale: Number(el.dataset.parallaxScale) || 0,
  })
}
