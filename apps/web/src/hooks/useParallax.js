import { useGSAP } from '@gsap/react'
import { parallaxFromAttrs } from '../lib/parallax'

/**
 * Scans a scope for layers that have asked to drift and wires them up.
 *
 *   <img data-parallax="-0.3" />          background, drifts down
 *   <div data-parallax-depth="28">        section-level drift, in pixels
 *   <img data-parallax-scale="1.12" />    settles out of a slow push
 *
 * Attribute-driven for the same reason `useTextReveal` is: the markup already
 * carries a measure, a ground and a clip, and a wrapper component per layer
 * would cost more than it saves. A layer opts in by gaining one word.
 *
 * Several attributes on one element compose — a background can drift and settle
 * out of a push at once, which is the pair that actually reads as depth.
 */
export function useParallax(scope, dependencies = []) {
  useGSAP(
    () => {
      const root = scope.current
      if (!root) return undefined

      const layers = []
      root.querySelectorAll('[data-parallax], [data-parallax-depth], [data-parallax-scale]').forEach((el) => {
        const layer = parallaxFromAttrs(el)
        if (layer) layers.push(layer)
      })

      return () => layers.forEach((layer) => layer.kill())
    },
    { scope, dependencies, revertOnUpdate: true }
  )
}
