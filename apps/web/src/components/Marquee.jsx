import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Parallax from './Parallax'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'

// Seamless client-logo marquee on carbon. The track holds the set twice; GSAP
// shifts it left by exactly one set width (-50%) and repeats — no seam. A
// Parallax wrapper adds a subtle vertical drift on scroll for depth.
export default function Marquee() {
  const { logos } = useSection('marquee')
  const visibleLogos = logos.filter((logo) => logo.image)
  const track = useRef(null)

  useGSAP(() => {
    gsap.to(track.current, {
      xPercent: -50,
      ease: 'none',
      duration: 22,
      repeat: -1,
    })
  })

  if (visibleLogos.length === 0) return null

  return (
    // No top hairline: the hero above is white too, so a rule there reads as a
    // stroke hung off the hero's bottom rather than a join between sections.
    //
    // data-band="light" is not decoration: the fixed header picks its chrome by
    // observing these, and without it this white strip was read as dark, so
    // scrolling through the logos dropped a charcoal scrim over them.
    <section
      data-band="light"
      className="relative w-full overflow-x-clip border-b border-[var(--color-line)] bg-surface py-14"
    >
      <Parallax speed={0.15}>
        <div ref={track} className="flex w-max items-center gap-24 pr-24">
          {/* These render at 48px tall. Asking for the default 1920 made the
              transformer *upscale* a 150px-wide original, so the logos cost
              more than the files they came from.

              Deliberately not lazy: they are ~5KB each and `w-auto`, so
              deferring them would leave the track at the wrong width when GSAP
              measures it for the -50% loop, and break the seam. */}
          {[...visibleLogos, ...visibleLogos].map((logo, i) => (
            <img
              key={i}
              src={sized(logo.image, 'logo')}
              alt={logo.alt ?? ''}
              decoding="async"
              className="h-11 w-auto shrink-0 object-contain md:h-12"
            />
          ))}
        </div>
      </Parallax>

      {/* edge fades to sell the infinite scroll */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-surface to-transparent md:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-surface to-transparent md:w-40" />
    </section>
  )
}
