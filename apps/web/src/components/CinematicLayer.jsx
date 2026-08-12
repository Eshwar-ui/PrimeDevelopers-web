import { useEffect, useRef } from 'react'
import { lenis } from '../hooks/useSmoothScroll'

// The scroll-progress rail: fixed, pointer-events-none, painted above content.
// Driven from the shared Lenis instance so it stays in lockstep with the
// smooth-scroll engine rather than running a scroll listener of its own.
//
// This used to carry a film-grain plate and a vignette as well. Both were
// texture for a site that was dark on every screen, and the vignette in
// particular laid black over the edges of every page regardless of theme — see
// the note where they were defined in index.css.
export default function CinematicLayer() {
  const rail = useRef(null)

  useEffect(() => {
    let raf
    const update = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      const p = max > 0 ? Math.min(el.scrollTop / max, 1) : 0
      if (rail.current) rail.current.style.width = `${p * 100}%`
    }
    // Prefer Lenis' own scroll event; fall back to a rAF loop until it mounts.
    const tick = () => {
      update()
      raf = requestAnimationFrame(tick)
    }
    const instance = lenis.current
    if (instance?.on) {
      instance.on('scroll', update)
      update()
      return () => instance.off?.('scroll', update)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <span ref={rail} className="scroll-rail" aria-hidden style={{ width: 0 }} />
}
