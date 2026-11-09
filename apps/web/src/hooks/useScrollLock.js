import { useEffect } from 'react'
import { lenis } from './useSmoothScroll'

// How many overlays currently hold the lock, and the body overflow from before
// the first of them. Counted so a dialog opened over the open mobile menu does
// not unlock the page when it closes underneath the menu.
let holders = 0
let previousOverflow = ''

/**
 * Freezes the page behind an overlay (menu, dialog, lightbox) while `active`.
 *
 * Hiding the body's overflow alone is not enough here: Lenis drives the
 * window scroller and keeps turning wheel and trackpad input into
 * `scrollTo` calls, which overflow:hidden does not block — so the page crept
 * along behind the overlay while the overlay itself refused to scroll.
 * Stopping Lenis ends that; the overlay still needs `data-lenis-prevent` so
 * its own content gets native scrolling.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined

    if (holders === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      lenis.current?.stop()
    }
    holders += 1

    return () => {
      holders -= 1
      if (holders > 0) return
      document.body.style.overflow = previousOverflow
      lenis.current?.start()
    }
  }, [active])
}
