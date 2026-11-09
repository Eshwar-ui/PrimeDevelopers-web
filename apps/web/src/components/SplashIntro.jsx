import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { lenis } from '../hooks/useSmoothScroll'
import primeLogo from '../assets/prime-logo.svg'

/**
 * The opening frame: the full lockup centred on the void ground, which then
 * flies up into the navbar and becomes the header's own logo.
 *
 * The flight is a FLIP. The navbar's logo is already laid out underneath (and
 * kept invisible by `html[data-splash]`), so its box is the destination: the
 * splash logo is translated and scaled until it sits exactly on top, the
 * ground fades away, and only then is the real logo revealed beneath it. The
 * handoff is the same image on the same pixels, so it reads as one object.
 *
 * Once per tab session — a returning click through the site should land on
 * the page, not on the intro again — and never for reduced motion.
 */
const SEEN_KEY = 'prime:splash-seen'

function shouldPlay() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return !sessionStorage.getItem(SEEN_KEY)
  } catch {
    // Storage blocked: play it, it simply won't be remembered.
    return true
  }
}

const EASE_IN_OUT = [0.76, 0, 0.24, 1]
const EASE_OUT = [0.16, 1, 0.3, 1]

export default function SplashIntro() {
  const [active, setActive] = useState(shouldPlay)
  const groundRef = useRef(null)
  const logoRef = useRef(null)
  const lineRef = useRef(null)

  // Layout effect so the nav logo is hidden and the page locked before the
  // first paint — otherwise the header's logo flashes in under the splash.
  useLayoutEffect(() => {
    if (!active) return
    const root = document.documentElement
    root.setAttribute('data-splash', '')
    root.style.overflow = 'hidden'
    return () => {
      root.removeAttribute('data-splash')
      root.style.overflow = ''
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // ignore
    }
    let cancelled = false
    const running = []
    const run = (...args) => {
      const a = animate(...args)
      running.push(a)
      return a
    }
    // Lenis mounts in the same commit; stop it on the next frame so the wheel
    // can't scroll the page out from under the flight.
    const raf = requestAnimationFrame(() => lenis.current?.stop())

    const sequence = async () => {
      const logo = logoRef.current
      const ground = groundRef.current
      const line = lineRef.current

      // 1. Arrive: the lockup rises out of a mask while a hairline draws under it.
      await Promise.all([
        run(logo, { opacity: [0, 1], y: [18, 0], clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'] }, { duration: 0.9, ease: EASE_OUT }),
        run(line, { scaleX: [0, 1], opacity: [0, 1] }, { duration: 1.1, ease: EASE_IN_OUT, delay: 0.15 }),
      ])
      if (cancelled) return
      await run(line, { opacity: 0 }, { duration: 0.35, delay: 0.25 })
      if (cancelled) return

      // 2. Fly: measure both boxes now, after the header's own entrance has
      // settled, and move the lockup onto the nav logo.
      const target = document.querySelector('[data-nav-logo]')
      const from = logo.getBoundingClientRect()
      const to = target?.getBoundingClientRect()

      if (to && to.width > 0) {
        const scale = to.height / from.height
        const dx = to.left + to.width / 2 - (from.left + from.width / 2)
        const dy = to.top + to.height / 2 - (from.top + from.height / 2)
        ground.style.pointerEvents = 'none'
        await Promise.all([
          run(logo, { x: dx, y: dy, scale }, { duration: 1.05, ease: EASE_IN_OUT }),
          run(ground, { opacity: 0 }, { duration: 0.75, delay: 0.35, ease: 'easeInOut' }),
        ])
      } else {
        // No nav logo to land on (shouldn't happen) — just fade out.
        await run(ground, { opacity: 0 }, { duration: 0.5 })
      }
      if (cancelled) return

      // 3. Hand off: reveal the real logo underneath, then drop the stand-in.
      document.documentElement.removeAttribute('data-splash')
      document.documentElement.style.overflow = ''
      lenis.current?.start()
      await run(logo, { opacity: 0 }, { duration: 0.35, delay: 0.15 })
      if (!cancelled) setActive(false)
    }

    sequence()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      running.forEach((a) => a.stop())
      lenis.current?.start()
    }
  }, [active])

  if (!active) return null

  return (
    <>
      <div ref={groundRef} className="fixed inset-0 z-[60] bg-void" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 z-[61] flex flex-col items-center justify-center" aria-hidden="true">
        <img
          ref={logoRef}
          src={primeLogo}
          alt=""
          className="h-auto w-[min(72vw,440px)] origin-center opacity-0 will-change-transform"
        />
        <span
          ref={lineRef}
          className="mt-8 block h-px w-[min(60vw,320px)] origin-center bg-gradient-to-r from-transparent via-accent-soft to-transparent opacity-0"
        />
      </div>
    </>
  )
}
