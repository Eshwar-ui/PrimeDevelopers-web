import { lenis } from '../hooks/useSmoothScroll'

// Long enough for App.jsx's `ScrollTop` to do its `scrollTo(0, immediate)` and
// its ScrollTrigger.refresh a frame later. A scroll issued inside that window
// is simply undone — the same trick Navbar and useSectionNav already use for
// cross-route anchors, a little longer because the target here is a lazily
// mounted section rather than an anchor on a page that is already up.
const START_MS = 260

// How long to keep correcting, and how often to look. Generous because the 3D
// viewer is a lazy chunk behind an IntersectionObserver — scrolling towards
// the section is itself what starts it loading, and the section grows again
// when it mounts. Nothing is lost by the upper bound: correcting stops as soon
// as the target is in place, and any wheel, touch or key ends it outright.
const SETTLE_MS = 5000
const CHECK_MS = 180

// Re-issues are capped as well as time-boxed. A target near the bottom of the
// document can never reach the requested offset — the page runs out of scroll
// — and without a cap that would re-issue every tick for the full window.
const MAX_ATTEMPTS = 8

// Pixels of slack before the target counts as out of place. Sub-pixel layout
// and Lenis's own easing never land on an exact integer.
const TOLERANCE = 4

/**
 * Smooth-scroll an element into view after the route has finished landing.
 *
 * Three things make this more than `scrollIntoView`:
 *
 * Lenis owns the scroll position. It drives scrolling off the GSAP ticker, and
 * a native *smooth* scroll fights it and is swallowed outright — verified on
 * this site: `scrollIntoView({behavior:'smooth'})` leaves scrollY at 0 while
 * an instant one works. Every other scroll in the app already goes through
 * Lenis, and so must this one; the native call survives only as the fallback
 * for the windows where Lenis is null (before the app root mounts it, after
 * teardown) and drops the smooth behaviour there.
 *
 * `ScrollTop` resets a freshly mounted route to 0, so the first attempt waits
 * it out.
 *
 * And one scroll is not enough. The plan section grows as its lazy chunk and
 * images arrive, so an offset measured early is not where the section ends up;
 * worse, a Lenis animation in flight gets interrupted by the ScrollTrigger
 * refresh and stops partway. Checking the *result* rather than trusting the
 * request covers both: it corrects until the target is actually in place and
 * the page has stopped moving underneath it.
 */
export function scrollToElement(target, { offset = -96 } = {}) {
  if (!target) return () => {}

  // Where we want the element to sit in the viewport. `offset` is Lenis's
  // sign convention — negative lifts the target down the screen, clear of the
  // fixed navbar — so the viewport position we are aiming for is its negation.
  const wantViewportTop = -offset

  let interval = null
  let attempts = 0
  let lastScrollY = null

  const aim = () => {
    const viewportTop = target.getBoundingClientRect().top
    const offTarget = Math.abs(viewportTop - wantViewportTop) > TOLERANCE
    // Only correct once the page has come to rest. Re-issuing while Lenis is
    // still easing towards the target restarts the animation every tick and
    // the scroll never arrives.
    const atRest = window.scrollY === lastScrollY
    lastScrollY = window.scrollY

    if (!offTarget) {
      stop()
      return
    }
    if (!atRest || attempts >= MAX_ATTEMPTS) return

    attempts += 1
    if (lenis.current) lenis.current.scrollTo(target, { offset })
    else target.scrollIntoView({ block: 'start' })
  }

  const stop = () => {
    if (interval) clearInterval(interval)
    interval = null
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchstart', stop)
    window.removeEventListener('keydown', stop)
  }

  const begin = setTimeout(() => {
    // First pass unconditionally: `atRest` cannot be true yet, there being no
    // previous reading to compare against.
    attempts += 1
    if (lenis.current) lenis.current.scrollTo(target, { offset })
    else target.scrollIntoView({ block: 'start' })

    const startedAt = Date.now()
    interval = setInterval(() => {
      aim()
      if (Date.now() - startedAt > SETTLE_MS) stop()
    }, CHECK_MS)

    // The visitor taking over always wins.
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', stop)
  }, START_MS)

  return () => {
    clearTimeout(begin)
    stop()
  }
}
