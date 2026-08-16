import { useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import SocialIcon from './SocialIcon'
import ArrowRight from './ArrowRight'
import { sized } from '../lib/images'
import { useProperties } from '../context/ContentContext'
import { phaseSiblings } from '../lib/phases'

export default function PropertyHero({ property, soldPct, onEnquire }) {
  const scope = useRef(null)
  const image = useRef(null)
  const phases = phaseSiblings(useProperties(), property)

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
const isSharedTransition = document.documentElement.classList.contains('property-route-transition')
    const timeline = gsap.timeline({
      delay: isSharedTransition ? 0.78 : 0,
      defaults: { ease: 'power3.out' },
    })
    timeline
      .from('[data-property-kicker]', { y: 20, opacity: 0, duration: 0.65 })
      .from('[data-property-title] span', { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.06 }, '-=0.35')
      .from('[data-property-phases]', { y: 18, opacity: 0, duration: 0.6 }, '-=0.45')
      .from('[data-property-copy]', { y: 28, opacity: 0, duration: 0.75 }, '-=0.4')
      .from('[data-property-actions]', { y: 20, opacity: 0, duration: 0.65 }, '-=0.45')
      .from('[data-property-socials]', { y: 16, opacity: 0, duration: 0.6 }, '-=0.4')

    if (!isSharedTransition) {
      timeline.from(image.current, { scale: 1.08, opacity: 0, duration: 1.25 }, 0.1)
    }

    gsap.to(image.current, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: true },
    })
  }, { scope })

  const words = property.name.split(/\s+/)
  const availability = property.available > 0 ? `${property.available} available` : 'Fully reserved'

  return (
    <section ref={scope} data-property-hero={property.slug} className="relative min-h-[100dvh] overflow-hidden bg-void text-white">
      {property.image && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            ref={image}
            src={sized(property.image, 'full')}
            style={{ viewTransitionName: `property-image-${property.slug}` }}
            alt={`${property.name} property exterior`}
            fetchPriority="high"
            className="h-[112%] w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,21,27,0.94)_0%,rgba(12,21,27,0.74)_38%,rgba(12,21,27,0.18)_72%,rgba(12,21,27,0.34)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(12,21,27,0.82)_0%,transparent_46%)]" />
        </div>
      )}

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[1560px] flex-col px-6 pb-8 pt-28 md:px-gutter-lg md:pb-10 md:pt-36">
        <Link to="/properties" className="group inline-flex min-h-11 w-fit items-center gap-3 font-body text-[12px] font-bold uppercase tracking-[0.16em] text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="transition-transform duration-300 group-hover:-translate-x-1">←</span>
          All properties
        </Link>

        <div className="mt-auto grid items-end gap-12 pb-7 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-20">
          <div>
            <p data-property-kicker className="font-body text-[12px] font-bold uppercase tracking-[0.2em] text-white/65">
              {[property.category, property.address].filter(Boolean).join(' · ')}
            </p>
            <h1
              data-property-title
              style={{ viewTransitionName: `property-title-${property.slug}` }}
              className="mt-5 max-w-[14ch] text-balance font-display font-bold leading-[0.9] tracking-[-0.055em] [font-size:clamp(2.35rem,11vw,7rem)]"
            >
              {words.map((word, index) => <span key={`${word}-${index}`} className="mr-[0.2em] inline-block overflow-hidden align-top"><span className="inline-block">{word}</span></span>)}
            </h1>
            {/* Phase switch. Sits directly under the title because it belongs
                to it — these are two records describing one development, and
                the control reads as part of the name rather than as another
                navigation item competing with Enquire below.

                The current phase is a span, not a link: it is the page you are
                already on, so it carries `aria-current` and nothing to click. */}
            {phases.length > 0 && (
              <nav
                data-property-phases
                aria-label="Development phase"
                className="mt-6 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/8 p-1 backdrop-blur-md"
              >
                {phases.map((phase) =>
                  phase.isCurrent ? (
                    <span
                      key={phase.slug}
                      aria-current="page"
                      className="rounded-full bg-white px-4 py-2 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-charcoal"
                    >
                      {phase.label}
                    </span>
                  ) : (
                    <Link
                      key={phase.slug}
                      to={`/properties/${phase.slug}`}
                      className="rounded-full px-4 py-2 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-white/70 transition-colors duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      {phase.label}
                    </Link>
                  )
                )}
              </nav>
            )}

            {property.detail?.tagline && <p data-property-copy className="mt-7 max-w-[44rem] text-pretty font-body text-[16px] leading-[1.75] text-white/72 md:text-[18px]">{property.detail.tagline}</p>}
            <div data-property-actions className="mt-9 flex flex-wrap items-center gap-4">
              <button type="button" onClick={onEnquire} className="group inline-flex h-14 items-center gap-5 rounded-full bg-accent py-1.5 pl-7 pr-1.5 font-body text-[14px] font-bold uppercase tracking-[0.05em] text-white dark:text-void transition duration-300 hover:bg-prime-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Enquire
                <span className="grid size-11 place-items-center rounded-full bg-white text-charcoal"><ArrowRight className="size-4 -rotate-45 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
              </button>
              {property.detail?.floorPlans?.buildings?.length > 0 && <a href="#floor-plans" className="inline-flex min-h-11 items-center font-body text-[13px] font-bold uppercase tracking-[0.12em] text-white/75 underline decoration-white/30 underline-offset-8 transition hover:text-white hover:decoration-white active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Explore floor plans</a>}
            </div>
          </div>

          <aside className="grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3 rounded-2xl border border-white/18 bg-white/18 shadow-[0_24px_80px_-38px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:grid-cols-1">
            {[
              ['Availability', availability],
              ['Reserved', `${soldPct}%`],
              ['Total', property.buildings || '—'],
            ].map(([label, value]) => (
              <div key={label} className="bg-charcoal/58 px-4 py-5 md:px-6">
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-white/48">{label}</p>
                <p className="mt-2 font-display text-lg font-bold tracking-[-0.02em] text-white md:text-xl">{value}</p>
              </div>
            ))}
          </aside>
        </div>

        {/* Bottom edge rather than the top corner. The hero's horizontal scrim
            fades to 0.18 alpha on the right, so icons parked up there sit on
            bare sky and lose their outline against a bright image; the vertical
            scrim holds 0.82 across the whole bottom, which is dark under any
            photograph an admin uploads. The hairline is what makes it read as
            the close of the hero instead of chrome that happened to land. */}
        {property.detail?.socials?.some((social) => social.url) && (
          <div
            data-property-socials
            className="flex items-center gap-2.5 border-t border-white/14 pt-6"
          >
            {property.detail.socials.map((social, index) => social.url && (
              <a key={index} href={social.url} target="_blank" rel="noreferrer" aria-label={social.platform} className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/5 text-white/75 backdrop-blur-md transition duration-300 hover:border-white/60 hover:bg-white/12 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <SocialIcon platform={social.platform} className="size-4" />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
