import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import SectionHeader from './SectionHeader'
import g1 from '../assets/hero/slide-1-enhanced.png'
import g2 from '../assets/hero/slide-4-enhanced.png'
import g3 from '../assets/property-1-enhanced.png'
import g4 from '../assets/hero/slide-6-enhanced.png'

// Asymmetric two-row layout (7/5 then 5/7) — not a generic equal-column grid.
const items = [
  { src: g1, span: 'md:col-span-7', caption: 'Cedar Grove Residences' },
  { src: g2, span: 'md:col-span-5', caption: 'Sunnyvale Estates' },
  { src: g3, span: 'md:col-span-5', caption: 'Riverside Villas' },
  { src: g4, span: 'md:col-span-7', caption: 'Oakridge Meadows' },
]

export default function Gallery() {
  const scope = useRef(null)

  useGSAP(
    () => {
      gsap.from('[data-gitem]', {
        y: 60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: scope.current, start: 'top 72%' },
      })
    },
    { scope }
  )

  return (
    <section id="gallery" ref={scope} className="bg-bone px-6 py-20 md:px-[75px] md:py-24">
      <SectionHeader title="Frames" className="mb-12" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        {items.map((it) => (
          <figure key={it.caption} data-gitem className={`group ${it.span}`}>
            <div className="h-[300px] overflow-hidden rounded-2xl md:h-[440px]">
              <img
                src={it.src}
                alt={it.caption}
                className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0"
              />
            </div>
            <figcaption className="mt-3 flex items-center justify-between font-body text-sm text-muted">
              <span>{it.caption}</span>
              <span className="eyebrow">Austin, TX</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
