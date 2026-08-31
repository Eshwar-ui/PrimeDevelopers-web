import { useRef } from 'react'
import { Link } from 'react-router-dom'
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
import { serviceImage } from '../lib/expertise'

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
        <section data-band="light" className="bg-base px-5 py-18 sm:px-6 sm:py-24 md:px-12 md:py-36">
          <div className="mx-auto max-w-[1560px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <h2 className="max-w-[15ch] text-balance font-display text-[clamp(2.3rem,5vw,5rem)] font-bold leading-[0.96] tracking-[-0.045em]">{renderEmphasis(page.capabilitiesHeading || 'Choose your way in', '')}</h2>
              <p className="max-w-[42ch] font-body text-[15px] leading-[1.7] text-content/65">Each service has its own team, process and direct enquiry route.</p>
            </div>

            <div className="mt-10 grid grid-flow-dense grid-cols-1 gap-4 sm:mt-14 lg:grid-cols-12 lg:grid-rows-2">
              {services.map((service, index) => {
                const span = index === 0 || index === 3 ? 'lg:col-span-7' : 'lg:col-span-5'
                return (
                  <Link key={service.title} to={service.href || '/enterprise'} className={`group relative min-h-[19rem] overflow-hidden rounded-[1.35rem] bg-void text-white sm:min-h-[22rem] sm:rounded-[1.75rem] ${span}`}>
                    {imageFor(service, index) && <img src={sized(imageFor(service, index), 'card')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 ease-out group-hover:scale-105 group-hover:opacity-85" />}
                    <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,15,20,.94)_0%,rgba(8,15,20,.1)_76%)]" />
                    <div className="relative flex h-full min-h-[19rem] flex-col justify-between p-5 sm:min-h-[22rem] sm:p-7 md:p-9">
                      <span className="font-body text-[12px] font-bold tabular-nums tracking-[0.16em] text-white/55">{serviceNumber(index)}</span>
                      <div className="flex items-end justify-between gap-6">
                        <h3 className="max-w-[12ch] font-display text-[clamp(2rem,3.5vw,4rem)] font-bold leading-[0.95] tracking-[-0.04em]">{service.title}</h3>
                        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"><ArrowRight className="size-4 -rotate-45" /></span>
                      </div>
                    </div>
                  </Link>
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

      {/* A compact summary rather than the long-form article each service used
          to get here — the full story now lives on that service's own page
          (/enterprise/interiors etc.), and keeping both would mean editing the
          same pitch in two places the moment it changes. */}
      {services.length > 0 && (
        <section data-band="light" className="bg-base px-5 py-18 sm:px-6 sm:py-24 md:px-12 md:py-36">
          <div className="mx-auto max-w-[1560px]">
            <p className="font-body text-[12px] font-bold uppercase tracking-[0.2em] text-accent">At a glance</p>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {services.map((service, index) => {
                const href = service.href || `/contact?service=${encodeURIComponent(service.title)}`
                return (
                  <div key={service.title} className="flex flex-col gap-4 rounded-[1.25rem] border border-line bg-surface-alt p-5 sm:rounded-[1.5rem] sm:p-8">
                    <span className="font-body text-[12px] font-bold tabular-nums tracking-[0.16em] text-content/40">{serviceNumber(index)}</span>
                    <h2 className="font-display text-[clamp(1.6rem,2.4vw,2.2rem)] font-bold leading-[1.05] tracking-[-0.03em]">{service.title}</h2>
                    <p className="max-w-[52ch] font-body text-[15px] leading-[1.7] text-content/68">{service.body}</p>
                    <Link to={href} className="group mt-1 inline-flex w-fit items-center gap-3 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-accent transition-colors hover:text-content">
                      Explore {service.title}
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {page.stats?.length > 0 && (
        <section className="bg-void px-6 py-20 text-white md:px-12 md:py-28">
          <div className="mx-auto grid max-w-[1560px] grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] bg-white/15 md:grid-cols-4">
            {page.stats.map((stat) => <div key={stat.label} className="min-w-0 bg-void p-5 sm:p-7 md:p-10"><strong className="block font-display text-3xl tabular-nums sm:text-4xl md:text-5xl">{stat.value}</strong><span className="mt-3 block break-words font-body text-[10px] uppercase tracking-[0.11em] text-white/55 sm:text-[12px] sm:tracking-[0.14em]">{stat.label}</span></div>)}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden bg-accent px-5 py-18 text-white dark:text-void sm:px-6 sm:py-24 md:px-12 md:py-36">
        <div className="absolute -right-32 -top-40 size-[32rem] rounded-full bg-white/12 blur-3xl" />
        <div className="relative mx-auto flex max-w-[1560px] flex-col gap-12 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[15ch] text-balance font-display text-[clamp(2.5rem,5.5vw,5.8rem)] font-bold uppercase leading-[0.94] tracking-[-0.05em]">{renderEmphasis(page.closingHeading || 'Tell us which door you want to come through', '')}</h2>
          <a href={page.closingHref || '/contact'} className="group inline-flex w-full min-w-0 items-center justify-between gap-3 self-start rounded-full bg-white py-1.5 pl-5 pr-1.5 text-charcoal sm:w-auto sm:shrink-0 sm:gap-4 sm:pl-7 md:self-auto"><span className="min-w-0 text-balance font-body text-[12px] font-bold uppercase tracking-[0.05em] sm:text-[14px]">{page.closingLabel || 'Start a conversation'}</span><span className="grid size-11 shrink-0 place-items-center rounded-full bg-void text-white"><ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></span></a>
        </div>
      </section>
    </main>
  )
}
