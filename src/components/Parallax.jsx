import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll-scrubbed parallax wrapper.
 * `speed` is the fraction of the element's height it travels across the full
 * scroll pass: positive = drifts up (foreground), negative = drifts down (bg).
 */
export default function Parallax({ speed = 0.2, as: Tag = 'div', className = '', children }) {
  const ref = useRef(null)

  useGSAP(
    () => {
      gsap.fromTo(
        ref.current,
        { yPercent: speed * 50 },
        {
          yPercent: -speed * 50,
          ease: 'none',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      )
    },
    { scope: ref }
  )

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}
