import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import ArrowRight from '../components/ArrowRight'
import PrimePill from '../components/PrimePill'
import { useProperties, useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
// The service photographs and the slug they are keyed on both moved to
// `lib/expertise`: the homepage's services band draws the same four and was
// falling back to a placeholder because it had no way to reach them.
import { serviceImage, slugify } from '../lib/expertise'

gsap.registerPlugin(ScrollTrigger)

const serviceNumber = (index) => String(index + 1).padStart(2, '0')

export default function EnterprisePage() {
  const page = useSection('enterprise_page')
  const properties = useProperties()
  const scope = useRef(null)
  const services = (page.capabilities ?? []).slice(0, 4)
  const propertyImages = properties.flatMap((property) => [property.image, ...(property.gallery ?? [])]).filter(Boolean)
  // The shared resolution first — a CMS upload, then the shipped photograph —
  // and this page's own last resorts after it, which the homepage does not
  // share: filling an empty service card with a property photograph makes sense
  // in a full expertise index and would be misleading in a four-up teaser.
  const imageFor = (service, index) =>
    serviceImage(service) || propertyImages[index] || page.heroImage || propertyImages[0]
  const heroImage = page.heroImage || imageFor(services[0] ?? {}, 0)

  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro
      .from('[data-expertise-kicker]', { y: 18, opacity: 0, duration: 0.6 })
      .from('[data-expertise-title] > span', { yPercent: 115, duration: 0.95, stagger: 0.07 }, '-=0.32')
      .from('[data-expertise-copy]', { y: 24, opacity: 0, duration: 0.7 }, '-=0.48')
      .from('[data-expertise-visual]', { clipPath: 'inset(14% 0 14% 0)', scale: 1.08, duration: 1.15 }, '-=0.9')

    gsap.utils.toArray('[data-service-media]').forEach((media) => {
      gsap.fromTo(media, { scale: 0.88, opacity: 0.52 }, {
        scale: 1,
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: media, start: 'top 92%', end: 'center 48%', scrub: 0.8 },
      })
    })

    const match = gsap.matchMedia()
    match.add('(min-width: 1024px)', () => {
      ScrollTrigger.create({
        trigger: '[data-service-stories]',
        start: 'top 112px',
        end: 'bottom bottom-=80',
        pin: '[data-service-index]',
        pinSpacing: false,
      })
    })
    return () => match.revert()
  }, { scope })

  return (
    <main ref={scope} className="w-full max-w-full overflow-x-hidden bg-base text-content">
      <section className="relative min-h-[100dvh] overflow-hidden bg-void text-white">
        {heroImage && (
          <div data-expertise-visual className="absolute inset-y-0 right-0 w-full lg:w-[58%]">
            <img src={sized(heroImage, 'full')} alt="Prime development expertise" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#0c151b_0%,rgba(12,21,27,.88)_20%,rgba(12,21,27,.2)_70%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(12,21,27,.72)_0%,transparent_52%)]" />
          </div>
        )}

        <div className="relative mx-auto flex min-h-[100dvh] max-w-[1560px] flex-col justify-end px-6 pb-16 pt-32 md:px-12 md:pb-20 lg:justify-center">
          <div className="max-w-[52rem]">
            <p data-expertise-kicker className="font-body text-[12px] font-bold uppercase tracking-[0.22em] text-accent-soft">{page.heroEyebrow || 'Expertise'}</p>
            <h1 data-expertise-title className="mt-6 max-w-[15ch] text-balance font-display font-bold uppercase leading-[0.91] tracking-[-0.055em] [font-size:clamp(2.35rem,10vw,7.5rem)]">
              {(page.heroHeading || 'Four ways to build with Prime').split(' ').map((word, index) => (
                <span key={`${word}-${index}`} className="inline-block overflow-hidden align-top"><span className="inline-block">{word}</span>{index < (page.heroHeading || 'Four ways to build with Prime').split(' ').length - 1 ? '\u00a0' : ''}</span>
              ))}
            </h1>
            <div data-expertise-copy className="mt-8 grid max-w-[46rem] gap-8 md:grid-cols-[1fr_auto] md:items-end">
              <p className="max-w-[58ch] font-body text-[16px] leading-[1.75] text-white/70">{page.heroParagraph}</p>
              {page.ctaLabel && <PrimePill href={page.ctaHref || '/contact'}>{page.ctaLabel}</PrimePill>}
            </div>
          </div>
        </div>
      </section>

      {services.length > 0 && (
        <section data-band="light" className="bg-base px-6 py-24 md:px-12 md:py-36">
          <div className="mx-auto max-w-[1560px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <h2 className="max-w-[15ch] text-balance font-display text-[clamp(2.3rem,5vw,5rem)] font-bold leading-[0.96] tracking-[-0.045em]">{renderEmphasis(page.capabilitiesHeading || 'Choose your way in', '')}</h2>
              <p className="max-w-[42ch] font-body text-[15px] leading-[1.7] text-content/65">Each service has its own team, process and direct enquiry route.</p>
            </div>

            <div className="mt-14 grid grid-flow-dense grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-2">
              {services.map((service, index) => {
                const id = `service-${slugify(service.title)}`
                const span = index === 0 || index === 3 ? 'lg:col-span-7' : 'lg:col-span-5'
                return (
                  <a key={service.title} href={`#${id}`} className={`group relative min-h-[22rem] overflow-hidden rounded-[1.75rem] bg-void text-white ${span}`}>
                    {imageFor(service, index) && <img src={sized(imageFor(service, index), 'card')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 ease-out group-hover:scale-105 group-hover:opacity-85" />}
                    <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,15,20,.94)_0%,rgba(8,15,20,.1)_76%)]" />
                    <div className="relative flex h-full min-h-[22rem] flex-col justify-between p-7 md:p-9">
                      <span className="font-body text-[12px] font-bold tabular-nums tracking-[0.16em] text-white/55">{serviceNumber(index)}</span>
                      <div className="flex items-end justify-between gap-6">
                        <h3 className="max-w-[12ch] font-display text-[clamp(2rem,3.5vw,4rem)] font-bold leading-[0.95] tracking-[-0.04em]">{service.title}</h3>
                        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"><ArrowRight className="size-4 -rotate-45" /></span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <div aria-hidden className="overflow-hidden border-y border-white/10 bg-void py-5 text-white">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap pr-12 font-display text-[clamp(1.3rem,2.2vw,2rem)] font-bold uppercase tracking-[-0.02em] text-white/42">
          {[...services, ...services].map((service, index) => <span key={`${service.title}-${index}`}>{service.title} <span className="ml-12 text-accent">/</span></span>)}
        </div>
      </div>

      {services.length > 0 && (
        <section data-service-stories data-band="light" className="bg-base px-6 py-24 md:px-12 md:py-36">
          <div className="mx-auto grid max-w-[1560px] gap-16 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-20">
            <aside data-service-index className="h-fit">
              <p className="font-body text-[12px] font-bold uppercase tracking-[0.2em] text-accent">Our practice</p>
              <nav className="mt-8 border-t border-line">
                {services.map((service, index) => <a key={service.title} href={`#service-${slugify(service.title)}`} className="group flex items-center justify-between border-b border-line py-4 font-body text-[14px] text-content/60 transition-colors hover:text-content"><span>{service.title}</span><span className="text-[11px] tabular-nums text-accent">{serviceNumber(index)}</span></a>)}
              </nav>
            </aside>

            <div className="space-y-28 md:space-y-40">
              {services.map((service, index) => {
                const id = `service-${slugify(service.title)}`
                const href = service.href || `/contact?service=${encodeURIComponent(service.title)}`
                return (
                  <article id={id} key={service.title} className="scroll-mt-28">
                    <div data-service-media className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] bg-surface-alt will-change-transform">
                      {imageFor(service, index) && <img src={sized(imageFor(service, index), 'full')} alt={`${service.title} by Prime Developers`} className="h-full w-full object-cover" />}
                      <span className="absolute left-6 top-6 font-body text-[12px] font-bold tabular-nums tracking-[0.16em] text-white/70 drop-shadow md:left-8 md:top-8">{serviceNumber(index)}</span>
                    </div>
                    <div className="mt-9 grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] md:items-start">
                      <h2 className="font-display text-[clamp(2.5rem,5vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.05em]">{service.title}</h2>
                      <div>
                        <p className="max-w-[60ch] font-body text-[16px] leading-[1.8] text-content/68">{service.body}</p>
                        <a href={href} className="group mt-7 inline-flex items-center gap-3 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-accent transition-colors hover:text-content">Explore {service.title}<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {page.stats?.length > 0 && (
        <section className="bg-void px-6 py-20 text-white md:px-12 md:py-28">
          <div className="mx-auto grid max-w-[1560px] grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] bg-white/15 md:grid-cols-4">
            {page.stats.map((stat) => <div key={stat.label} className="bg-void p-7 md:p-10"><strong className="block font-display text-4xl tabular-nums md:text-5xl">{stat.value}</strong><span className="mt-3 block font-body text-[12px] uppercase tracking-[0.14em] text-white/55">{stat.label}</span></div>)}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden bg-accent px-6 py-24 text-white dark:text-void md:px-12 md:py-36">
        <div className="absolute -right-32 -top-40 size-[32rem] rounded-full bg-white/12 blur-3xl" />
        <div className="relative mx-auto flex max-w-[1560px] flex-col gap-12 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[15ch] text-balance font-display text-[clamp(2.5rem,5.5vw,5.8rem)] font-bold uppercase leading-[0.94] tracking-[-0.05em]">{renderEmphasis(page.closingHeading || 'Tell us which door you want to come through', '')}</h2>
          <a href={page.closingHref || '/contact'} className="group inline-flex shrink-0 items-center gap-4 self-start rounded-full bg-white py-1.5 pl-7 pr-1.5 text-charcoal md:self-auto"><span className="font-body text-[14px] font-bold uppercase tracking-[0.05em]">{page.closingLabel || 'Start a conversation'}</span><span className="grid size-11 place-items-center rounded-full bg-void text-white"><ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></span></a>
        </div>
      </section>
    </main>
  )
}