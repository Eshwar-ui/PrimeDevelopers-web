import { useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useProperties, useSection } from '../context/ContentContext'
import QuoteForm from '../components/QuoteForm'
import Testimonials from '../components/Testimonials'
import ArrowRight from '../components/ArrowRight'
import { sized } from '../lib/images'

gsap.registerPlugin(ScrollTrigger)

const TRACKS = [
  { id: 'planning-phase', label: 'Track one', name: 'Planning-phase equity', tone: 'accent' },
  { id: 'property-cap', label: 'Track two', name: 'Property CAP / NNN', tone: 'ember' },
]

const TONE = {
  accent: { bar: 'bg-accent', text: 'text-accent', selected: 'border-accent bg-accent/10 text-accent' },
  ember: { bar: 'bg-ember', text: 'text-ember', selected: 'border-ember bg-ember/15 text-ember' },
}

const INVESTOR_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'entity', label: 'Entity' },
]

const ACCREDITATION_OPTIONS = [
  { value: 'accredited', label: 'Accredited investor' },
  { value: 'not-accredited', label: 'Not currently accredited' },
  { value: 'unsure', label: 'Not sure' },
]

/** The track's own facts, presented as a plain list rather than a bordered card. */
function TrackFacts({ rows }) {
  if (rows.length === 0) return null
  return (
    <dl className="grid gap-x-10 gap-y-6 border-t border-line pt-8 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1.5">
          <dt className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-content/50">{label}</dt>
          <dd className="font-body text-[15px] leading-relaxed text-content">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One CAP/NNN-structured property, resolved from the CMS's curated slug list. */
function CapPropertyCard({ property }) {
  const stat = (property.detail?.overview?.stats ?? [])[0]
  return (
    <a
      href={`/properties/${property.slug}`}
      className="group flex flex-col overflow-hidden rounded-panel border border-line bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-ember/60 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
        {property.image && (
          <img
            src={sized(property.image, 'card')}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold leading-tight text-content">{property.name}</h3>
          <ArrowRight className="mt-1 size-4 shrink-0 text-content/40 transition-[color,transform] duration-300 ease-brand group-hover:translate-x-1 group-hover:text-ember" />
        </div>
        {property.category && <p className="font-body text-[13px] font-semibold text-ember">{property.category}</p>}
        {stat && (
          <p className="mt-1 font-body text-[13px] text-content/60">
            <span className="numeral font-bold text-content">{stat.value}</span> {stat.label}
          </p>
        )}
      </div>
    </a>
  )
}

export default function InvestPage() {
  const page = useSection('invest_page')
  const properties = useProperties()
  const scope = useRef(null)
  const [track, setTrack] = useState('')

  const planningRows = [
    ['Entry cost', page.planningPhase?.entryCost],
    ['Timeline', page.planningPhase?.timeline],
    ['Risk profile', page.planningPhase?.riskProfile],
  ].filter(([, value]) => value)

  const capRows = [
    ['Typical cap rate', page.propertyCap?.capRateRange],
    ['Lease structure', page.propertyCap?.leaseStructure],
    ['Passive income', page.propertyCap?.passiveIncomeNote],
  ].filter(([, value]) => value)

  const capProperties = (page.propertyCap?.properties ?? [])
    .map((entry) => properties.find((p) => p.slug === entry.propertySlug))
    .filter(Boolean)

  const extraFields = useMemo(
    () => [
      { name: 'investorType', label: 'Investor type', type: 'select', options: INVESTOR_TYPE_OPTIONS },
      { name: 'investmentRange', label: 'Intended investment range', type: 'text', placeholder: 'e.g. $100,000 – $250,000' },
      { name: 'accreditationStatus', label: 'Accreditation status', type: 'select', options: ACCREDITATION_OPTIONS },
      { name: 'timeline', label: 'Timeline', type: 'text', placeholder: 'e.g. Ready now / Next 6 months' },
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

      <section data-band="light" data-reveal className="bg-surface-alt px-gutter py-20 md:px-gutter-lg md:py-28">
        <div className="mx-auto max-w-[1360px]">
          <span aria-hidden className={`block h-1 w-14 rounded-full ${TONE.accent.bar}`} />
          <p className={`mt-6 font-body text-xs font-bold uppercase tracking-[0.14em] ${TONE.accent.text}`}>{TRACKS[0].label}</p>
          <h2 className="mt-3 max-w-[24ch] text-balance font-display text-[clamp(1.9rem,3.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.035em]">
            {TRACKS[0].name}
          </h2>
          {page.planningPhase?.description && (
            <p className="mt-5 max-w-[62ch] font-body text-[16px] leading-[1.75] text-content/70">{page.planningPhase.description}</p>
          )}
          <div className="mt-10">
            <TrackFacts rows={planningRows} />
          </div>
        </div>
      </section>

      <section data-band="light" data-reveal className="px-gutter py-20 md:px-gutter-lg md:py-28">
        <div className="mx-auto max-w-[1360px]">
          <span aria-hidden className={`block h-1 w-14 rounded-full ${TONE.ember.bar}`} />
          <p className={`mt-6 font-body text-xs font-bold uppercase tracking-[0.14em] ${TONE.ember.text}`}>{TRACKS[1].label}</p>
          <h2 className="mt-3 max-w-[24ch] text-balance font-display text-[clamp(1.9rem,3.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.035em]">
            {TRACKS[1].name}
          </h2>
          {page.propertyCap?.description && (
            <p className="mt-5 max-w-[62ch] font-body text-[16px] leading-[1.75] text-content/70">{page.propertyCap.description}</p>
          )}
          <div className="mt-10">
            <TrackFacts rows={capRows} />
          </div>

          <div className="mt-16">
            <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">Structured for CAP / NNN investment</p>
            {capProperties.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {capProperties.map((property) => (
                  <CapPropertyCard key={property.slug} property={property} />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-panel border border-dashed border-content/20 px-5 py-8 text-center sm:px-8 sm:py-10">
                <p className="font-display text-lg font-bold text-content">CAP / NNN listings are still being structured</p>
                <p className="mx-auto mt-2 max-w-md font-body text-[14px] leading-relaxed text-content/60">
                  Stabilized properties will be shown here once they're set up for CAP / NNN investment.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <Testimonials sectionKey="invest_testimonials" id="invest-testimonials" />

      <section id="inquire" data-band="light" data-reveal className="px-gutter py-20 md:px-gutter-lg md:py-28">
        <div className="mx-auto max-w-[1360px]">
          <div className="mb-8 rounded-panel border border-line bg-surface-alt p-5 sm:p-7 md:p-9">
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">Which track interests you?</p>
            <div role="group" aria-label="Track" className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={() => setTrack('')}
                aria-pressed={track === ''}
                className={`min-h-12 w-full rounded-full border px-4 py-3 text-center font-body text-[13px] font-bold transition-colors sm:h-12 sm:w-auto sm:px-5 sm:py-0 ${track === '' ? 'border-accent bg-accent/10 text-accent' : 'border-content/15 text-content/60 hover:border-content/35'}`}
              >
                Both / not sure yet
              </button>
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTrack(t.id)}
                  aria-pressed={track === t.id}
                  className={`min-h-12 w-full rounded-full border px-4 py-3 text-center font-body text-[13px] font-bold transition-colors sm:h-12 sm:w-auto sm:px-5 sm:py-0 ${
                    track === t.id ? TONE[t.tone].selected : 'border-content/15 text-content/60 hover:border-content/35'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <QuoteForm
            source="invest"
            eyebrow="Investor inquiry"
            heading="Request investor information"
            description="Tell us a bit about what you're looking for, and our investor relations team will follow up."
            context={{ track: TRACKS.find((t) => t.id === track)?.name || 'Both / not sure yet' }}
            extraFields={extraFields}
            messageLabel="Anything else we should know?"
            messagePlaceholder="Questions, background, or specific properties you're interested in"
          />
        </div>
      </section>
    </div>
  )
}
