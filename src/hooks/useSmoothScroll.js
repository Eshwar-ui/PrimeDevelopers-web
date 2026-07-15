import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Live Lenis instance, shared so navigation (and route changes) can drive the
// same smooth-scroll engine that ScrollTrigger reads from.
export const lenis = { current: null }

// Drives Lenis smooth-scroll from GSAP's ticker so ScrollTrigger reads the
// smoothed scroll position — the single source of truth for scroll time.
// One global smooth-scroll instance; mount once at the app root.
export function useSmoothScroll() {
  useEffect(() => {
    const instance = new Lenis({ lerp: 0.1, smoothWheel: true })
    lenis.current = instance

    instance.on('scroll', ScrollTrigger.update)

    const raf = (time) => instance.raf(time * 1000) // gsap ticker is in seconds, lenis wants ms
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(raf)
      instance.destroy()
      lenis.current = null
    }
  }, [])
}
