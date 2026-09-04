import { useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useProperties, useSection } from '../context/ContentContext'
import PropertyPicker from '../components/PropertyPicker'
import QuoteForm from '../components/QuoteForm'
import Partners from '../components/Partners'
import Testimonials from '../components/Testimonials'
import { sized } from '../lib/images'

gsap.registerPlugin(ScrollTrigger)

export default function CollabPage() {
  const page = useSection('collab_page')
  const properties = useProperties()
  const partnerships = page.existingPartnerships ?? []
  const how = page.howItWorks ?? {}
  const scope = useRef(null)
  const [desiredProperty, setDesiredProperty] = useState('')

  const propertyName = (slug) => properties.find((p) => p.slug === slug)?.name

  const extraFields = useMemo(
    () => [
      { name: 'operatingExperience', label: 'Operating experience / track record', type: 'textarea', fullWidth: true, placeholder: 'What have you built or run before?' },
      { name: 'capitalAvailable', label: 'Capital available to contribute', type: 'text', placeholder: 'e.g. $150,000' },
      { name: 'timeline', label: 'Timeline', type: 'text', placeholder: 'e.g. Next 12 months' },
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

      {partnerships.length > 0 ? (
        <section data-band="light" data-reveal className="bg-surface-alt px-gutter py-16 md:px-gutter-lg md:py-24">
          <div className="mx-auto max-w-[1360px]">
            <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">Current partnerships</p>
            <h2 className="mt-3 max-w-[24ch] text-balance font-display text-[clamp(1.7rem,3vw,2.6rem)] font-bold leading-[1.08] tracking-[-0.03em]">
              Built and operated together
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {partnerships.map((p) => (
                <div key={p.partnerName} className="flex flex-col overflow-hidden rounded-panel border border-line bg-surface">
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
                    {p.image && <img src={sized(p.image, 'card')} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-6">
                    <h3 className="font-display text-lg font-bold leading-tight text-content">{p.partnerName}</h3>
                    {p.concept && <p className="font-body text-[13px] font-semibold text-accent">{p.concept}</p>}
                    {p.propertySlug && <p className="font-body text-[12px] text-content/50">{propertyName(p.propertySlug) || p.propertySlug}</p>}
                    <p className="mt-1 font-body text-[14px] leading-relaxed text-content/68">{p.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section data-band="light" data-reveal className="bg-surface-alt px-gutter py-14 md:px-gutter-lg md:py-16">
          <div className="mx-auto max-w-[1360px] rounded-panel border border-dashed border-content/20 px-5 py-8 text-center sm:px-8 sm:py-10">
            <p className="font-display text-lg font-bold text-content">The first joint ventures are still ahead</p>
            <p className="mx-auto mt-2 max-w-md font-body text-[14px] leading-relaxed text-content/60">
              Active partnerships will be showcased here once structured and operating.
            </p>
          </div>
        </section>
      )}

      <section data-band="light" data-reveal className="px-gutter py-20 md:px-gutter-lg md:py-28">
        <div className="mx-auto max-w-[1360px]">
          <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-accent">How the partnership model works</p>
          <h2 className="mt-4 max-w-[26ch] text-balance font-display text-[clamp(1.9rem,3.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.035em]">
            One deal, two sides of the table
          </h2>

          {/* The JV split, stated as a split panel rather than a bullet list —
              two contributions meeting in the middle is what makes this read
              as a partnership rather than as a landlord's terms sheet, which
              is exactly the confusion the spec calls out. */}
          {(how.contributesUs || how.contributesPartner) && (
            <div className="mt-10 grid overflow-hidden rounded-panel border border-line md:grid-cols-2">
              {how.contributesUs && (
                <div className="bg-void p-5 text-white sm:p-8 md:p-10">
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-accent-soft">Prime Developer contributes</p>
                  <p className="mt-4 font-body text-[15px] leading-relaxed text-white/75">{how.contributesUs}</p>
                </div>
              )}
              {how.contributesPartner && (
                <div className="bg-surface-alt p-5 sm:p-8 md:p-10">
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-accent">The operating partner contributes</p>
                  <p className="mt-4 font-body text-[15px] leading-relaxed text-content/75">{how.contributesPartner}</p>
                </div>
              )}
            </div>
          )}

          {(how.equitySplit || how.idealPartner) && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {how.equitySplit && (
                <div className="rounded-panel border border-line bg-surface p-5 sm:p-7">
                  <h3 className="font-display text-base font-bold text-content">Equity & decision-making</h3>
                  <p className="mt-2 font-body text-[14px] leading-relaxed text-content/70">{how.equitySplit}</p>
                </div>
              )}
              {how.idealPartner && (
                <div className="rounded-panel border border-line bg-surface p-5 sm:p-7">
                  <h3 className="font-display text-base font-bold text-content">The ideal partner</h3>
                  <p className="mt-2 font-body text-[14px] leading-relaxed text-content/70">{how.idealPartner}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Partners />

      <Testimonials sectionKey="collab_testimonials" id="collab-testimonials" />

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
            source="collab"
            eyebrow="Collab inquiry"
            heading="Propose a partnership"
            description="Tell us about your concept and what you'd bring to it — we'll follow up to talk structure."
            context={{ desiredProperty: propertyName(desiredProperty) || 'No preference' }}
            extraFields={extraFields}
            messageLabel="Describe the business concept"
            messagePlaceholder="What is the business, and what stage is it at?"
          />
        </div>
      </section>
    </div>
  )
}
