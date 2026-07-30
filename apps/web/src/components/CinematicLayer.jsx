import { useEffect, useRef } from 'react'
import { lenis } from '../hooks/useSmoothScroll'

// Site-wide cinematic furniture: a scroll-progress rail, a film-grain plate,
// and a vignette. All fixed, pointer-events-none, and painted above content.
// The progress rail is driven from the shared Lenis instance so it stays in
// lockstep with the smooth-scroll engine (no separate scroll listener).
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

  return (
    <>
      <span ref={rail} className="scroll-rail" aria-hidden style={{ width: 0 }} />
      <span className="film-grain" aria-hidden />
      <span className="vignette" aria-hidden />
    </>
  )
}
