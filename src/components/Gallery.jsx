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
  { src: g1, span: 'md:col-span-7', caption: 'Cedar Grove Residences', place: 'Lewisville, TX' },
  { src: g2, span: 'md:col-span-5', caption: 'Sunnyvale Estates', place: 'Leander, TX' },
  { src: g3, span: 'md:col-span-5', caption: 'Riverside Villas', place: 'Cedar Park, TX' },
  { src: g4, span: 'md:col-span-7', caption: 'Oakridge Meadows', place: 'Austin, TX' },
]

// A deliberate bright "intermission" band between the dark cinematic sections.
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
    <section
      id="gallery"
      data-band="light"
      ref={scope}
      className="bg-bone px-6 py-24 text-ink md:px-[75px] md:py-32"
    >
      <div className="mb-14 flex flex-col gap-8">
        <SectionHeader index="03" title="Frames" tone="ink" />
        <h3 className="max-w-[18ch] font-display text-[2.2rem] font-light leading-[1.02] tracking-[-0.02em] text-ink md:text-h2">
          Places we&apos;ve <span className="italic text-accent">brought to life.</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        {items.map((it) => (
          <figure key={it.caption} data-gitem className={`group ${it.span}`}>
            <div className="relative h-[300px] overflow-hidden rounded-2xl md:h-[460px]">
              <img
                src={it.src}
                alt={it.caption}
                className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0"
              />
              <div
                aria-hidden
                className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(26,26,26,0.5))' }}
              />
            </div>
            <figcaption className="mt-4 flex items-center justify-between">
              <span className="font-display text-lg font-medium tracking-[-0.01em] text-ink">
                {it.caption}
              </span>
              <span className="eyebrow text-muted">{it.place}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
