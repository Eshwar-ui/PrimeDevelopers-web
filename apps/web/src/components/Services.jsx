import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import { SERVICE_ICON_GLYPHS } from '../lib/serviceIcons'

gsap.registerPlugin(ScrollTrigger)

// An unknown name falls through to the compass rather than rendering an empty
// tile — a missing glyph reads as a broken card, a wrong-but-present one reads
// as a content mistake.
function ServiceIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {SERVICE_ICON_GLYPHS[name] ?? SERVICE_ICON_GLYPHS.compass}
    </svg>
  )
}

// A compact reassurance strip between the property teaser and the gallery —
// four support promises, deliberately shorter than the sections either side of
// it so it reads as a rule between them rather than a destination of its own.
export default function Services() {
  const { eyebrow, heading, items } = useSection('services_home')
  const scope = useRef(null)

  useGSAP(
    () => {
      // Gated, where it previously was not. A `.from()` puts the cards at
      // opacity 0 the moment it is created and only ScrollTrigger takes them
      // back — so with reduced motion requested the reader still got the full
      // entrance, and anything that stopped the trigger firing left four blank
      // panels rather than an un-animated strip. Returning early leaves them
      // exactly where the markup puts them.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.from('[data-service]', {
        y: 28,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.09,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: scope.current, start: 'top 85%' },
      })
    },
    { scope }
  )

  if (items.length === 0) return null

  return (
    <section
      id="services"
      data-band="light"
      ref={scope}
      className="bg-surface px-6 py-12 text-content md:px-[75px] md:py-8"
    >
      {(eyebrow || heading) && (
        <div className="mb-7">
          {eyebrow && <p className="eyebrow text-accent">{eyebrow}</p>}
          {heading && (
            <p className="mt-2 font-body text-[17px] leading-normal text-content/70">{heading}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((s) => (
          <article
            key={s.title}
            data-service
            className="rounded-2xl border border-line bg-surface p-5 transition-colors duration-300 hover:border-content/25"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-prime-soft text-accent">
              <ServiceIcon name={s.icon} />
            </span>
            <h3 className="mt-3.5 font-display text-[17px] font-bold leading-tight tracking-[-0.01em] text-content">
              {s.title}
            </h3>
            <p className="mt-2.5 font-body text-[14px] leading-[1.7] text-content/70">{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
