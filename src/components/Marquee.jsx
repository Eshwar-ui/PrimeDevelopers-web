import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Parallax from './Parallax'
import { useSection } from '../context/ContentContext'

// Seamless client-logo marquee on carbon. The track holds the set twice; GSAP
// shifts it left by exactly one set width (-50%) and repeats — no seam. A
// Parallax wrapper adds a subtle vertical drift on scroll for depth.
export default function Marquee() {
  const { eyebrow, logos } = useSection('marquee')
  const track = useRef(null)

  useGSAP(() => {
    gsap.to(track.current, {
      xPercent: -50,
      ease: 'none',
      duration: 22,
      repeat: -1,
    })
  })

  if (logos.length === 0) return null

  return (
    <section className="relative w-full overflow-x-clip border-y border-[var(--color-line)] bg-bone py-14">
      <p className="eyebrow mb-9 bg-gradient-to-r from-accent via-accent-soft to-ember bg-clip-text px-6 text-center text-transparent md:px-8">
        {eyebrow}
      </p>
      <Parallax speed={0.15}>
        <div ref={track} className="flex w-max items-center gap-24 pr-24">
          {[...logos, ...logos].map((logo, i) => (
            <img
              key={i}
              src={logo.image}
              alt={logo.alt ?? ''}
              className="h-11 w-auto shrink-0 object-contain md:h-12"
            />
          ))}
        </div>
      </Parallax>

      {/* edge fades to sell the infinite scroll */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bone to-transparent md:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bone to-transparent md:w-40" />
    </section>
  )
}
