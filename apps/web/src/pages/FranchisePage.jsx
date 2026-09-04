import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useProperties, useSection } from '../context/ContentContext'
import PropertyPicker from '../components/PropertyPicker'
import QuoteForm from '../components/QuoteForm'
import Testimonials from '../components/Testimonials'
import { sized } from '../lib/images'

gsap.registerPlugin(ScrollTrigger)

export default function FranchisePage() {
  const page = useSection('franchise_page')
  const properties = useProperties()
  const franchisees = page.existingFranchisees ?? []
  const whyPartner = page.openToNew?.whyPartner ?? []
  const scope = useRef(null)
  const [desiredProperty, setDesiredProperty] = useState('')

  const propertyName = (slug) => properties.find((p) => p.slug === slug)?.name

  const extraFields = useMemo(
    () => [
      { name: 'squareFootage', label: 'Square footage needed', type: 'text', placeholder: 'e.g. 1,200 sq ft' },
      { name: 'timeline', label: 'Target timeline', type: 'text', placeholder: 'e.g. Next 6 months' },
    ],
    []
  )

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-hero-copy] > *', { y: 28, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 })
      gsap.from('[data-hero-visual]', { scale: 1.1, opacity: 0, duration: 1.2, ease: 'power3.out' })
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 32, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 84%' } }
        )
      })
    },
    { scope }
  )

  return (
    <div ref={scope} className="overflow-x-hidden bg-base text-content">
      <section className="relative min-h-[34rem] overflow-hidden bg-void text-white md:min-h-[36rem]">
        {page.heroImage && (
          <div data-hero-visual className="absolute inset-0">
            <img src={sized(page.heroImage, 'full')} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(100deg,#0c151b_0%,rgba(12,21,27,.88)_32%,rgba(12,21,27,.35)_68%,rgba(12,21,27,.2)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(12,21,27,.6)_0%,transparent_55%)]" />
          </div>
        )}
        <div className="relative mx-auto flex min-h-[34rem] max-w-[1360px] flex-col justify-end px-gutter pb-12 pt-32 sm:pb-14 md:min-h-[36rem] md:px-gutter-lg md:pb-20 md:pt-40">
          <div data-hero-copy className="max-w-[42rem]">
            <p className="font-body text-[12px] font-bold uppercase tracking-[0.22em] text-accent-soft">{page.heroEyebrow}</p>
            <h1 className="mt-5 max-w-[16ch] text-balance font-display font-bold uppercase leading-[0.98] tracking-[-0.04em] [font-size:clamp(2.1rem,5.5vw,4.6rem)]">
              {page.heading}
            </h1>
            <p className="mt-6 max-w-[56ch] font-body text-[16px] leading-[1.75] text-white/70">{page.paragraph}</p>
          </div>
        </div>
      </section>

      {franchisees.length > 0 ? (
        <section data-band="light" data-reveal className="bg-surface-alt px-gutter py-16 md:px-gutter-lg md:py-24">
          <div className="mx-auto max-w-[1360px]">
            <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">Currently operating</p>
            <h2 className="mt-3 max-w-[24ch] text-balance font-display text-[clamp(1.7rem,3vw,2.6rem)] font-bold leading-[1.08] tracking-[-0.03em]">
              Brands already at home across the portfolio
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {franchisees.map((f) => (
                <Link
                  key={f.brandName}
                  to={f.propertySlug ? `/properties/${f.propertySlug}` : '/properties'}
                  className="group flex flex-col overflow-hidden rounded-panel border border-line bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/60 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
                    {f.image && (
                      <img src={sized(f.image, 'card')} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]" />
                    )}
                    {f.logo && (
                      <span className="absolute bottom-4 left-4 flex h-10 items-center rounded-lg bg-white/95 px-3 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)]">
                        <img src={sized(f.logo, 'thumb')} alt={f.brandName} className="h-6 w-auto object-contain" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-6">
                    <h3 className="font-display text-lg font-bold leading-tight text-content">{f.brandName}</h3>
                    {f.propertySlug && <p className="font-body text-[13px] font-semibold text-accent">{propertyName(f.propertySlug) || f.propertySlug}</p>}
                    <p className="mt-1 font-body text-[14px] leading-relaxed text-content/68">{f.blurb}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section data-band="light" data-reveal className="bg-surface-alt px-gutter py-14 md:px-gutter-lg md:py-16">
          <div className="mx-auto max-w-[1360px] rounded-panel border border-dashed border-content/20 px-5 py-8 text-center sm:px-8 sm:py-10">
            <p className="font-display text-lg font-bold text-content">First franchise partners are still to come</p>
            <p className="mx-auto mt-2 max-w-md font-body text-[14px] leading-relaxed text-content/60">
              This is where signed brands will be showcased, property by property, once they open.
            </p>
          </div>
        </section>
      )}

      <section data-band="light" data-reveal className="px-gutter py-20 md:px-gutter-lg md:py-28">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-accent">Open to new franchises</p>
              <h2 className="mt-4 max-w-[22ch] text-balance font-display text-[clamp(1.9rem,3.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.035em]">
                What kind of concept fits
              </h2>
              <p className="mt-5 max-w-[62ch] font-body text-[16px] leading-[1.75] text-content/70">{page.openToNew?.paragraph}</p>
            </div>
            {page.openToNew?.footprintRange && (
              <div className="min-w-0 shrink-0 rounded-panel border border-line bg-surface-alt px-5 py-5 text-left sm:px-8 sm:py-6 lg:text-right">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-content/45">Ideal footprint</p>
                <p className="mt-2 font-display text-[clamp(1.6rem,2.6vw,2.2rem)] font-bold text-accent">{page.openToNew.footprintRange}</p>
              </div>
            )}
          </div>

          {whyPartner.length > 0 && (
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {whyPartner.map((point, index) => (
                <div key={point} className="flex flex-col gap-4 rounded-panel border border-line bg-surface-alt p-5 sm:p-7">
                  <span className="font-display text-2xl font-bold tabular-nums text-accent/45">{String(index + 1).padStart(2, '0')}</span>
                  <p className="font-body text-[15px] leading-relaxed text-content/75">{point}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Testimonials sectionKey="franchise_testimonials" id="franchise-testimonials" />

      <section id="inquire" className="px-gutter pb-24 md:px-gutter-lg md:pb-32">
        <div className="mx-auto max-w-[1360px]">
          {properties.length > 0 && (
            <div className="mb-8 rounded-panel border border-line bg-surface-alt p-5 sm:p-7 md:p-9">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">Which property interests you?</p>
              <div className="mt-5">
                <PropertyPicker properties={properties} value={desiredProperty} onChange={setDesiredProperty} />
              </div>
            </div>
          )}
          <QuoteForm
            source="franchise"
            eyebrow="Franchise inquiry"
            heading="Tell us about your concept"
            description="Share your brand and what you're looking for, and our leasing team will follow up."
            context={{ desiredProperty: propertyName(desiredProperty) || 'No preference' }}
            extraFields={extraFields}
            messageLabel="Describe your concept"
            messagePlaceholder="What is the business, and what makes it a fit?"
          />
        </div>
      </section>
    </div>
  )
}
