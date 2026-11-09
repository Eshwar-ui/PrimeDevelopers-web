import { useMemo } from 'react'
import { animate, useMotionValue, useReducedMotion } from 'motion/react'

/**
 * The perspective shift from lib/tilt, for a card that Motion already drives.
 *
 * lib/tilt writes `transform` straight onto the element, which is fine for a
 * plain card — but a `motion.*` card (the /properties grid: an entrance, a
 * `layout` animation, an exit) rebuilds `transform` itself on every frame it
 * animates, and the two would overwrite each other. Here the tilt is Motion's
 * own `rotateX`/`rotateY`, composed into the transform Motion is already
 * building, so the entrance, the layout shuffle and the lean all coexist.
 *
 * Same feel as lib/tilt: follows in ~0.16s, lets go over 0.7s, mouse and
 * trackpad only, nothing under reduced motion.
 *
 * Spread `style` and `handlers` onto the motion element.
 */
export function useMotionTilt({ maxX = 4, maxY = 3 } = {}) {
  const reduced = useReducedMotion()
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)

  return useMemo(() => {
    const fine =
      typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (reduced || !fine) return { style: {}, handlers: {} }

    const follow = { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }
    const settle = { duration: 0.7, ease: [0.16, 1, 0.3, 1] }

    return {
      style: { rotateX, rotateY, transformPerspective: 1600 },
      handlers: {
        onPointerMove: (e) => {
          if (e.pointerType !== 'mouse') return
          const r = e.currentTarget.getBoundingClientRect()
          const nx = (e.clientX - r.left) / r.width - 0.5
          const ny = (e.clientY - r.top) / r.height - 0.5
          animate(rotateX, -ny * maxX, follow)
          animate(rotateY, nx * maxY, follow)
        },
        onPointerLeave: () => {
          animate(rotateX, 0, settle)
          animate(rotateY, 0, settle)
        },
      },
    }
  }, [reduced, rotateX, rotateY, maxX, maxY])
}
