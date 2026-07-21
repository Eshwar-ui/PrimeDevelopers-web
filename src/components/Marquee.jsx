import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Parallax from './Parallax'
import l1 from '../assets/logos/22yards.webp'
import l2 from '../assets/logos/farm2cook.webp'
import l3 from '../assets/logos/sevenoaks.webp'
import l4 from '../assets/logos/lego.webp'
import l5 from '../assets/logos/qahwah.webp'

const logos = [l1, l2, l3, l4, l5]

// Seamless client-logo marquee on carbon. The track holds the set twice; GSAP
// shifts it left by exactly one set width (-50%) and repeats — no seam. A
// Parallax wrapper adds a subtle vertical drift on scroll for depth.
export default function Marquee() {
  const track = useRef(null)

  useGSAP(() => {
    gsap.to(track.current, {
      xPercent: -50,
      ease: 'none',
      duration: 22,
      repeat: -1,
    })
  })

  return (
    <section className="relative w-full overflow-x-clip border-y border-[var(--color-line-inv)] bg-carbon py-14">
      <p className="eyebrow mb-9 px-6 text-center text-bone/40 md:px-8">
        Trusted by teams building across Texas
      </p>
      <Parallax speed={0.15}>
        <div ref={track} className="flex w-max items-center gap-24 pr-24">
          {[...logos, ...logos].map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="h-11 w-auto shrink-0 object-contain opacity-55 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 md:h-12"
            />
          ))}
        </div>
      </Parallax>

      {/* edge fades to sell the infinite scroll */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-carbon to-transparent md:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-carbon to-transparent md:w-40" />
    </section>
  )
}
