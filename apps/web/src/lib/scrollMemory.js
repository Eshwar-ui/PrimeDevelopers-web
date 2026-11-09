import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Where the reader was on each history entry, keyed by React Router's
// `location.key`. Back and Forward look their entry up here instead of landing
// at the top of the page — on a phone, losing your place on a long list after
// peeking at one property means swiping all the way back down.
//
// In memory only: a hard reload starts fresh, which is what the browser does
// for a reload anyway once `scrollRestoration` is manual.
const positions = new Map()

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  // The browser's own restoration fires before the next route has rendered and
  // against the old page's height, then ScrollTop overrides it. Two owners of
  // one scroll position is the jump; the app takes it over entirely.
  //
  // Through ScrollTrigger rather than on `history` directly: ScrollTrigger
  // records the value it finds when it registers and writes that back on every
  // refresh, so a plain assignment is reverted to 'auto' on the next refresh.
  ScrollTrigger.clearScrollMemory('manual')
}

/**
 * Records the outgoing entry's scroll position at the moment the location
 * changes. Mount once, above the route transition.
 *
 * A layout effect, so it runs in the commit for the new location — before
 * the incoming page's ScrollTop has moved anything, while `scrollY` still
 * belongs to the page being left.
 */
export function useRememberScroll() {
  const { key } = useLocation()
  const previous = useRef(key)

  useLayoutEffect(() => {
    if (previous.current !== key) positions.set(previous.current, window.scrollY)
    previous.current = key
  }, [key])
}

export function savedScroll(key) {
  return positions.get(key)
}
