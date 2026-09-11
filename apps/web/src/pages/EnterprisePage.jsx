import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import ArrowRight from '../components/ArrowRight'
import ActionButton from '../components/ActionButton'
import { useProperties, useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
import { serviceImage, slugify } from '../lib/expertise'

gsap.registerPlugin(ScrollTrigger)

export default function EnterprisePage() {
  const scope = useRef(null)
  const page = useSection('enterprise_page')
  const properties = useProperties()
  const services = (page.capabilities ?? []).slice(0, 4)
  const propertyImages = properties.flatMap((property) => [property.image, ...(property.gallery ?? [])]).filter(Boolean)
  const imageFor = (service, index) =>
    serviceImage(service) || propertyImages[index] || page.heroImage || propertyImages[0]
  const heroImage = page.heroImage || imageFor(services[0] ?? {}, 0)

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const root = scope.current
      const reveal = (targets, options = {}) => gsap.from(targets, {
        opacity: 0,
        y: 24,
        duration: 0.75,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'opacity,transform',
        ...options,
      })

      reveal(root.querySelector('[data-expertise-intro]').children, { delay: 0.12 })
      const heroImage = root.querySelector('[data-expertise-image]')
      if (heroImage) reveal(heroImage, { delay: 0.3, duration: 1, y: 16 })

      root.querySelectorAll('[data-expertise-reveal]').forEach((group) => {
        reveal(group.children, {
          scrollTrigger: { trigger: group, start: 'top 88%', once: true },
        })
      })
    })
    return () => media.revert()
  }, { scope, dependencies: [page, heroImage], revertOnUpdate: true })
  return (
    <div ref={scope} className="bg-base text-content">
      <section data-section-reveal="off" data-band="light" className="px-gutter pb-12 pt-32 md:pb-20 md:pt-44">
        <div className="mx-auto grid max-w-[1320px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-expertise-intro>
            <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-accent">{page.heroEyebrow || 'Expertise'}</p>
            <h1 className="mt-5 max-w-[16ch] text-balance font-display text-[clamp(2.4rem,5vw,4.5rem)] font-bold leading-[1.06] tracking-[-0.035em]">
              {renderEmphasis(page.heroHeading || 'Four ways to build with Prime', 'text-accent')}
            </h1>
            {page.heroParagraph && <p className="mt-6 max-w-[52ch] font-body text-base leading-relaxed text-content/70">{page.heroParagraph}</p>}
            {page.ctaLabel && (
              <ActionButton href={page.ctaHref || '/contact'} className="mt-8 max-md:w-full">
                {page.ctaLabel}<ArrowRight className="size-4" />
              </ActionButton>
            )}
          </div>
          {heroImage && <img data-expertise-image src={sized(heroImage, 'card')} alt="Prime Developers property" fetchPriority="high" className="aspect-[4/3] w-full rounded-panel object-cover" />}
        </div>
      </section>

      {services.length > 0 && (
        <section data-section-reveal="off" data-band="light" aria-labelledby="expertise-services-heading" className="px-gutter pb-16 md:pb-24">
          <div className="mx-auto max-w-[1320px]">
            <div data-expertise-reveal className="border-t border-content/15 pb-8 pt-10 md:flex md:items-end md:justify-between md:gap-12 md:pt-14">
              <h2 id="expertise-services-heading" className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-bold tracking-[-0.025em]">
                {renderEmphasis(page.capabilitiesHeading || 'What we do', 'text-accent')}
              </h2>
              {page.capabilitiesSubheading && <p className="mt-4 max-w-[52ch] font-body text-[15px] leading-relaxed text-content/65 md:mt-0">{page.capabilitiesSubheading}</p>}
            </div>
            {services.map((service, index) => {
              const image = imageFor(service, index)
              return (
                <article data-expertise-reveal id={'service-' + slugify(service.title)} key={service.title} className="grid scroll-mt-28 gap-6 border-b border-content/15 py-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center md:gap-12 md:py-10 lg:gap-20">
                  {image && <img src={sized(image, 'card')} alt={service.title + ' by Prime Developers'} loading="lazy" decoding="async" className="aspect-[3/2] w-full rounded-panel object-cover" />}
                  <div className={image ? '' : 'md:col-span-2'}>
                    <p className="font-body text-xs font-medium tabular-nums tracking-[0.12em] text-accent">{String(index + 1).padStart(2, '0')}</p>
                    <h3 className="mt-3 font-display text-[clamp(1.75rem,3vw,2.75rem)] font-bold leading-tight tracking-[-0.025em]">{service.title}</h3>
                    <p className="mt-4 max-w-[58ch] font-body text-base leading-[1.75] text-content/70">{service.body}</p>
                    <ActionButton href={service.href || '/contact?service=' + encodeURIComponent(service.title)} className="mt-6 max-md:w-full">
                      Explore {service.title}<ArrowRight className="size-4" />
                    </ActionButton>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {page.stats?.length > 0 && (
        <section data-section-reveal="off" data-band="light" aria-label="Prime Developers in numbers" className="bg-surface px-gutter py-10 md:py-14">
          <dl data-expertise-reveal className="mx-auto grid max-w-[1320px] grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
            {page.stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-3">
                <dt className="font-body text-sm text-content/65">{stat.label}</dt>
                <dd className="-order-1 font-display text-3xl font-bold tabular-nums tracking-tight md:text-4xl">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section data-section-reveal="off" data-band="light" className="px-gutter py-16 md:py-24">
        <div data-expertise-reveal className="mx-auto flex max-w-[1320px] flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-16">
          <h2 className="max-w-[24ch] text-balance font-display text-[clamp(1.9rem,3.5vw,3rem)] font-bold leading-tight tracking-[-0.025em]">
            {renderEmphasis(page.closingHeading || 'Tell us about your next project', 'text-accent')}
          </h2>
          <ActionButton href={page.closingHref || '/contact'} className="max-md:w-full">
            {page.closingLabel || 'Start a conversation'}<ArrowRight className="size-4" />
          </ActionButton>
        </div>
      </section>
    </div>
  )
}