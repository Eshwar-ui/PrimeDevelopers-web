import { useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import QuoteForm from '../components/QuoteForm'
import { sized } from '../lib/images'

gsap.registerPlugin(ScrollTrigger)

const TRACKS = [
  { id: 'planning-phase', number: '01', label: 'Track one', name: 'Planning-phase equity', tone: 'accent' },
  { id: 'property-cap', number: '02', label: 'Track two', name: 'Property CAP / NNN', tone: 'ember' },
]

const TONE = {
  accent: { bar: 'bg-accent', chip: 'bg-accent/10 text-accent', number: 'text-accent/35', selected: 'border-accent bg-accent/10 text-accent' },
  ember: { bar: 'bg-ember', chip: 'bg-ember/15 text-ember', number: 'text-ember/40', selected: 'border-ember bg-ember/15 text-ember' },
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

function TrackCard({ track, data }) {
  if (!data) return null
  const tone = TONE[track.tone]
  const rows = [
    ['Entry cost', data.entryCost],
    ['Timeline', data.timeline],
    ['Risk profile', data.riskProfile],
    ['Typical cap rate', data.capRateRange],
    ['Lease structure', data.leaseStructure],
    ['Passive income', data.passiveIncomeNote],
  ].filter(([, value]) => value)

  return (
    <div data-reveal className="flex flex-col overflow-hidden rounded-panel border border-line bg-surface">
      <span aria-hidden className={`block h-1.5 w-full ${tone.bar}`} />
      <div className="flex flex-1 flex-col p-5 sm:p-8 md:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.1em] ${tone.chip}`}>{track.label}</span>
            <h2 className="mt-4 font-display text-xl font-bold leading-tight text-content sm:text-2xl">{track.name}</h2>
          </div>
          <span className={`font-display text-3xl font-bold tabular-nums sm:text-4xl ${tone.number}`}>{track.number}</span>
        </div>
        {data.description && <p className="mt-5 font-body text-[15px] leading-relaxed text-content/70">{data.description}</p>}
        {rows.length > 0 && (
          <dl className="mt-7 flex flex-col gap-4 border-t border-line pt-6">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-content/50">{label}</dt>
                <dd className="font-body text-[14px] leading-relaxed text-content">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}

export default function InvestPage() {
  const page = useSection('invest_page')
  const scope = useRef(null)
  const [track, setTrack] = useState('')

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
        gsap.from(el, { y: 32, opacity: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 84%' } })
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

      <section data-band="light" className="bg-surface-alt px-gutter py-16 md:px-gutter-lg md:py-24">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid gap-6 md:grid-cols-2">
            <TrackCard track={TRACKS[0]} data={page.planningPhase} />
            <TrackCard track={TRACKS[1]} data={page.propertyCap} />
          </div>
        </div>
      </section>

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
