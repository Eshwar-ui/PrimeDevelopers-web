import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import SectionHeader from './SectionHeader'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

// Asymmetric two-row layout (7/5 then 5/7) — not a generic equal-column grid.
const SPANS = ['md:col-span-7', 'md:col-span-5', 'md:col-span-5', 'md:col-span-7']

// A deliberate bright "intermission" band between the dark cinematic sections.
export default function Gallery() {
  const { heading } = useSection('gallery')
  const properties = useProperties().slice(0, 4)
  const scope = useRef(null)
  const navigate = useNavigate()

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

  if (properties.length === 0) return null

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
          {renderEmphasis(heading)}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        {properties.map((p, i) => (
          <figure
            key={p.slug}
            data-gitem
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/properties/${p.slug}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/properties/${p.slug}`)}
            className={`group cursor-pointer ${SPANS[i % SPANS.length]}`}
          >
            <div className="relative h-[300px] overflow-hidden rounded-2xl md:h-[460px]">
              <img
                src={p.image}
                alt={p.name}
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
                {p.name}
              </span>
              <span className="eyebrow text-muted">{p.address}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
