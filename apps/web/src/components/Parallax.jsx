import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { parallax } from '../lib/parallax'

/**
 * Scroll-scrubbed parallax wrapper.
 *
 * `speed` is the fraction of the element's height it travels across the full
 * scroll pass: positive = drifts up (foreground), negative = drifts down (bg).
 *
 * The movement itself now lives in `lib/parallax`, shared with the attribute
 * API and with the landing chapters. One module has to own every parallax
 * target on the page so they can all be zeroed before ScrollTrigger measures —
 * the reason is written out there, and it is the whole reason this component
 * stopped holding its own tween.
 */
export default function Parallax({ speed = 0.2, scale = 0, as: Tag = 'div', className = '', children }) {
  const ref = useRef(null)

  useGSAP(
    () => {
      const layer = parallax(ref.current, { speed, scale })
      return () => layer?.kill()
    },
    { scope: ref, dependencies: [speed, scale] }
  )

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}
