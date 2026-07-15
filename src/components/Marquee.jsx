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

// Seamless client-logo marquee. The track holds the logo set twice; GSAP shifts
// it left by exactly one set width (-50%) and repeats — so the loop has no seam.
// A Parallax wrapper adds a subtle vertical drift on scroll for depth.
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
    <section className="w-full overflow-x-clip border-y border-[var(--color-line)] bg-bone-deep py-12">
      <p className="eyebrow mb-8 px-6 text-center text-muted md:px-8">
        Trusted by teams building across Texas
      </p>
      <Parallax speed={0.15}>
        <div ref={track} className="flex w-max gap-24 pr-24">
          {[...logos, ...logos].map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="h-12 w-auto shrink-0 object-contain opacity-100 saturate-[1.15] transition-all duration-300 hover:scale-[1.04] hover:saturate-[1.35]"
            />
          ))}
        </div>
      </Parallax>
    </section>
  )
}
