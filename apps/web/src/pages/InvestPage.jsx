import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import QuoteForm from '../components/QuoteForm'
import Testimonials from '../components/Testimonials'
import { useCapListings, useCapListingsSection, CapListingGrid } from '../components/CapListings'
import CapCalculator from '../components/CapCalculator'
import { lenis } from '../hooks/useSmoothScroll'
import { sized } from '../lib/images'
import { calculatorSettings, canRunNumbers, capDealName as dealName, capScenarioContext } from '../lib/capCalculator'
import { capStatus } from '../lib/capListings'

const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * Which CAP deal the calculator runs. A native select: seventeen options is a
 * list, and the platform's own picker is the one that works with a thumb, a
 * screen reader and the keyboard without any of it being rebuilt here.
 */
function DealPicker({ listings, value, onChange }) {
  const selected = listings.find((l) => l.slug === value)
  return (
    <div>
      <label htmlFor="invest-calculator-deal" className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/55">
        CAP deal
      </label>
      <div className="relative mt-2.5">
        <select
          id="invest-calculator-deal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-12 w-full appearance-none rounded-2xl border border-line bg-surface py-3 pl-4 pr-11 font-display text-[16px] font-semibold sm:text-[15px] text-content transition-colors duration-200 hover:border-content/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {listings.map((l) => (
            <option key={l.slug} value={l.slug}>
              {dealName(l)}
              {l.status === 'under-contract' ? ` (${capStatus(l.status).label.toLowerCase()})` : ''}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-content/50">
          ▾
        </span>
      </div>
      {selected && (
        <p className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-body text-[13px] text-content/60">
          <span className="tabular-nums">
            {wholeDollars.format(selected.price)} · {wholeDollars.format(selected.rent)} rent a year
          </span>
          <Link
            to={`/cap-properties/${selected.slug}`}
            className="font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            View deal →
          </Link>
        </p>
      )}
    </div>
  )
}

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

export default function InvestPage() {
  const page = useSection('invest_page')
  const scope = useRef(null)
  const [track, setTrack] = useState('')
  const { hash } = useLocation()

  // A cross-route hash does not scroll on its own: the browser resolves the
  // fragment while React Router is still mounting this page, so by the time the
  // target element exists nobody is looking for it any more. `#property-cap`
  // is what the properties page's "Show more" points at, and `#inquire` has
  // been reachable-but-inert the same way.
  //
  // rAF rather than an effect body alone — the section has to be laid out
  // before its offset means anything. Lenis owns the scroll position when it
  // has mounted; `scrollIntoView` covers the routes where it has not.
  useEffect(() => {
    if (!hash) return
    const id = hash.slice(1)
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id)
      if (!target) return
      if (lenis.current) lenis.current.scrollTo(target, { offset: -90 })
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash])

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

  const capListings = useCapListings()

  // The calculator runs any deal a visitor could still buy into — the same
  // rule as the deal pages, so no deal is runnable here and not there.
  const capSection = useCapListingsSection()
  const runnable = useMemo(() => {
    const settings = calculatorSettings(capSection.calculator)
    return capListings.filter((l) => canRunNumbers(l, settings))
  }, [capListings, capSection])
  const [calcSlug, setCalcSlug] = useState('')
  const calcListing = runnable.find((l) => l.slug === calcSlug) ?? runnable[0] ?? null

  // What the visitor ran, for the inquiry form. Only once they have changed
  // the deal or a loan choice: attaching the opening defaults would tell
  // sales about a scenario nobody looked at.
  const [calcNumbers, setCalcNumbers] = useState(null)
  const [calcTouched, setCalcTouched] = useState(false)
  const scenario = calcTouched ? capScenarioContext(calcListing, calcNumbers) : null

  const scrollToInquire = (event) => {
    event.preventDefault()
    const target = document.getElementById('inquire')
    if (!target) return
    if (lenis.current) lenis.current.scrollTo(target, { offset: -90 })
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
      gsap.from('[data-hero-copy] > *', { y: 28, opacity: 0, duration: 0.8, ease: 'brand', stagger: 0.1 })
      gsap.from('[data-hero-visual]', {
        scale: 1.1,
        opacity: 0,
        duration: 1.2,
        ease: 'brand',
        // A `.from()` leaves its inline transform behind for good, and a layer
        // that still carries one stays composited — which is what antialiases
        // its clipped bottom edge into a hairline over the section below.
        clearProps: 'transform,opacity',
      })
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 32, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'brand', scrollTrigger: { trigger: el, start: 'top 84%' } }
        )
      })
    },
    { scope }
  )

  return (
    <div ref={scope} className="overflow-x-hidden bg-base text-content">
      <section className="relative min-h-[34rem] overflow-hidden bg-void px-gutter text-white md:min-h-[36rem]">
        {page.heroImage && (
          <div data-hero-visual className="bleed-fill">
            <img src={sized(page.heroImage, 'full')} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(100deg,#0c151b_0%,rgba(12,21,27,.88)_32%,rgba(12,21,27,.35)_68%,rgba(12,21,27,.2)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(12,21,27,.6)_0%,transparent_55%)]" />
          </div>
        )}
        <div className="relative mx-auto flex min-h-[34rem] w-full max-w-[1360px] flex-col justify-end pb-12 pt-32 sm:pb-14 md:min-h-[36rem] md:pb-20 md:pt-40">
          <div data-hero-copy className="max-w-[42rem]">
            <p className="font-body text-[12px] font-bold uppercase tracking-[0.22em] text-accent-soft">{page.heroEyebrow}</p>
            <h1 className="mt-5 max-w-[16ch] text-balance font-display font-bold uppercase leading-[0.98] tracking-[-0.04em] [font-size:clamp(2.1rem,5.5vw,4.6rem)]">
              {page.heading}
            </h1>
            <p className="mt-6 max-w-[56ch] font-body text-[16px] leading-[1.75] text-white/70">{page.paragraph}</p>
          </div>
        </div>
      </section>

      {/* The two tracks sit side by side from `lg` so they read as a choice
          between alternatives rather than as two chapters, and stack below it.
          Each keeps its own `id` — `#property-cap` is what the properties
          page's "Show more" links to, and what the enquiry form's track
          selector writes. */}
      <section data-band="light" className="bg-surface-alt px-gutter py-20 md:py-28">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-0">
            {[
              { track: TRACKS[0], description: page.planningPhase?.description, rows: planningRows },
              { track: TRACKS[1], description: page.propertyCap?.description, rows: capRows },
            ].map(({ track: t, description, rows }, index) => (
              <article
                key={t.id}
                id={t.id}
                data-reveal
                className={`flex scroll-mt-24 flex-col ${index === 0 ? 'lg:pr-12 xl:pr-16' : 'border-t border-line pt-16 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0 xl:pl-16'}`}
              >
                <span aria-hidden className={`block h-1 w-14 rounded-full ${TONE[t.tone].bar}`} />
                <p className={`mt-6 font-body text-xs font-bold uppercase tracking-[0.14em] ${TONE[t.tone].text}`}>{t.label}</p>
                <h2 className="mt-3 max-w-[24ch] text-balance font-display text-[clamp(1.9rem,3.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.035em]">
                  {t.name}
                </h2>
                {description && (
                  <p className="mt-5 max-w-[62ch] font-body text-[16px] leading-[1.75] text-content/70">{description}</p>
                )}
                <div className="mt-10">
                  <TrackFacts rows={rows} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-band="light" data-reveal className="px-gutter py-20 md:py-28">
        <div className="mx-auto max-w-[1360px]">
          <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">Structured for CAP / NNN investment</p>
          <CapListingGrid
            items={capListings}
            limit={6}
            className="mt-6"
            emptyState={
              <div className="mt-6 rounded-panel border border-dashed border-content/20 px-5 py-8 text-center sm:px-8 sm:py-10">
                <p className="font-display text-lg font-bold text-content">CAP / NNN listings are still being structured</p>
                <p className="mx-auto mt-2 max-w-md font-body text-[14px] leading-relaxed text-content/60">
                  Stabilized properties will be shown here once they're set up for CAP / NNN investment.
                </p>
              </div>
            }
          />
          {capListings.length > 6 && (
            <Link
              to="/cap-properties"
              className="mt-10 inline-flex min-h-12 items-center gap-2.5 rounded-full border border-[var(--color-line)] px-7 font-body text-[14px] font-semibold uppercase tracking-[0.1em] text-content/75 transition-colors duration-300 hover:border-ember/60 hover:text-ember focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
            >
              See all {capListings.length} listings →
            </Link>
          )}
        </div>
      </section>

      {/* After the deals rather than before them: a visitor arrives here having
          seen the prices and cap rates, and the next question is what one of
          them would cost to carry. `#calculator` is linkable. */}
      {calcListing && (
        <CapCalculator
          id="calculator"
          className="border-t border-line"
          listing={calcListing}
          section={capSection}
          heading="Run the numbers on a CAP deal"
          intro="Choose a deal, a rate and a loan term. Every figure uses that deal’s price and rent, and the same formulas as our loan price sheet."
          picker={
            <DealPicker
              listings={runnable}
              value={calcListing.slug}
              onChange={(slug) => {
                setCalcSlug(slug)
                setCalcTouched(true)
              }}
            />
          }
          cta={{ label: 'Ask about this deal', href: '#inquire', onClick: scrollToInquire }}
          onNumbers={setCalcNumbers}
          onUserChange={() => setCalcTouched(true)}
        />
      )}

      <Testimonials sectionKey="invest_testimonials" id="invest-testimonials" />

      <section id="inquire" data-band="light" data-reveal className="px-gutter py-20 md:py-28">
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
            {/* Said out loud, with a way out: the form is about to send
                something the visitor did not type into it. */}
            {scenario && (
              <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-5 font-body text-[13px] text-content/65">
                <span>
                  Sent with your inquiry:{' '}
                  <span className="font-semibold text-content">
                    {scenario.calculatorDeal} · {scenario.calculatorPrice} · {scenario.calculatorTerms}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setCalcTouched(false)}
                  className="min-h-11 font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-0"
                >
                  Don&apos;t include
                </button>
              </p>
            )}
          </div>
          <QuoteForm
            source="invest"
            eyebrow="Investor inquiry"
            heading="Request investor information"
            description="Tell us a bit about what you're looking for, and our investor relations team will follow up."
            context={{ track: TRACKS.find((t) => t.id === track)?.name || 'Both / not sure yet', ...scenario }}
            extraFields={extraFields}
            messageLabel="Anything else we should know?"
            messagePlaceholder="Questions, background, or specific properties you're interested in"
          />
        </div>
      </section>
    </div>
  )
}
