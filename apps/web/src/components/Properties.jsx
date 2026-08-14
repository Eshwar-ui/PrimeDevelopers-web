import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
import BrochureRequestModal from './BrochureRequestModal'

gsap.registerPlugin(ScrollTrigger)

// The cards are tall, so the teaser stays short — a homepage section that runs
// past three of these stops reading as a teaser and starts being the index.
const TEASER_COUNT = 3

// Spec-row glyphs. The stats behind them are free text an admin typed, so the
// icon is chosen by what the label says and falls back to a neutral mark —
// a wrong icon reads as a data error, a neutral one reads as a bullet.
const SPEC_ICONS = [
  [/\b(sf|sft|sq|m²|m2|size|area|acre)\b/i, 'M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5'],
  [/\b(floor|storey|story|level)\b/i, 'M12 3 2 8l10 5 10-5-10-5ZM2 14l10 5 10-5'],
  [/\b(bed|bedroom)\b/i, 'M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6M2 18v2M22 18v2M6 10V7h12v3'],
  [/\b(bath|shower)\b/i, 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM7 12V6a2 2 0 0 1 4 0'],
  [/\b(unit|suite)\b/i, 'M4 21V7l8-4 8 4v14M9 21v-5h6v5'],
]
const FALLBACK_ICON = 'M12 4l8 8-8 8-8-8 8-8Z'

function SpecIcon({ label }) {
  const match = SPEC_ICONS.find(([test]) => test.test(label ?? ''))
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.5 shrink-0 text-content/70"
    >
      <path d={match ? match[1] : FALLBACK_ICON} />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M3 6.5h18v12H3zM3 7l9 7 9-7" />
    </svg>
  )
}

function OfferIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.5 shrink-0 text-ember"
    >
      <path d="M12 3.5 14.2 8l4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8L5 8.7 9.8 8 12 3.5Z" />
    </svg>
  )
}
/**
 * The three figures a listing carries — total, sold, available — are not three
 * facts. Across every property in the CMS `sold + available === total` exactly,
 * so printing them as a stack of equal-weight numerals states the same thing
 * three times and leaves the reader to do the subtraction that matters.
 *
 * This leads with the only figure a prospect is actually shopping for, and
 * spends the rest of the space showing how much of the development is already
 * gone — which is the persuasive part, and is invisible in a list.
 */
function AvailabilityMeter({ total, sold, available }) {
  if (!total) return null

  // Derived rather than trusted. The two are edited by hand in the admin, so
  // they can disagree with the total; the bar is drawn against whichever
  // denominator keeps it inside its track.
  const denominator = Math.max(total, sold + available)
  const availablePct = denominator > 0 ? Math.round((available / denominator) * 100) : 0
  const soldOut = available === 0

  return (
    <div className="shrink-0 border-t border-line pt-5 md:w-48 md:self-center md:border-l md:border-t-0 md:py-4 md:pl-7">
      <p className="font-body text-[12px] font-bold uppercase tracking-[0.16em] text-content/70">Availability</p>

      <div className="mt-4 flex items-center gap-3">
        {soldOut ? (
          <span className="font-display text-[1.6rem] font-bold leading-none text-content/70">
            Fully sold
          </span>
        ) : (
          <>
            <span className="numeral text-[3rem] leading-none text-accent">{available}</span>
            <span className="max-w-20 font-body text-[13px] leading-[1.2] text-content/70">
              units available
            </span>
          </>
        )}
      </div>

      {/* role="img" rather than a progressbar: this reports a completed
          proportion, not a task in flight, and the label already carries the
          number for anyone not seeing the fill. */}
      <div
        role="img"
        aria-label={`${available} of ${total} units available, ${availablePct}%`}
        className="mt-5 h-1 w-full overflow-hidden rounded-full bg-content/10"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            soldOut ? 'bg-content/35' : 'bg-accent'
          }`}
          style={{ width: `${availablePct}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between font-body text-[12px] text-content/70">
        <span>{sold} sold</span>
        <span>{availablePct}% open</span>
      </div>
    </div>
  )
}

export default function Properties() {
  const { heading } = useSection('properties_home')
  const properties = useProperties().slice(0, TEASER_COUNT)
  const scope = useRef(null)
  const go = useSectionNav()
  const navigate = useNavigate()
  const [brochureProperty, setBrochureProperty] = useState(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-card]', {
        y: 48,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: scope.current, start: 'top 75%' },
      })
    },
    { scope }
  )

  if (properties.length === 0) return null

  return (
    // data-band="light" flips the fixed header to charcoal chrome — the band
    // is bright gray now, not the carbon it used to be.
    <section
      id="properties"
      data-band="light"
      ref={scope}
      className="bg-surface-alt px-6 py-20 text-content md:px-[75px] md:py-24"
    >
      <div className="flex items-center justify-between gap-6">
        <h2
          className="font-display font-bold leading-tight tracking-[-0.01em] text-accent"
          style={{ fontSize: 'clamp(1.5rem, 2vw, 2.15rem)' }}
        >
          {renderEmphasis(heading, '')}
        </h2>

        <a
          href="/properties"
          onClick={(e) => {
            e.preventDefault()
            go('/properties')
          }}
          className="shrink-0 rounded-full border border-content/25 px-6 py-3 font-body text-[12px] font-medium uppercase tracking-[0.12em] text-content transition-colors duration-300 hover:border-content hover:bg-surface md:px-7"
        >
          View all
        </a>
      </div>

      <div className="mt-10 flex flex-col gap-7">
        {properties.map((p) => {
          const overview = p.detail?.overview ?? {}
          const specs = (overview.stats ?? [])
            .filter((s) => s.value || s.label)
            .filter((s) => {
              const text = [s.value, s.label].filter(Boolean).join(' ')
              return !/\b(total|available)\s+(units?|suites?)\b|\b(units?|suites?)\s+(total|available)\b/i.test(text)
            })
          const blurb = p.detail?.tagline || overview.body
          const open = () => navigate(`/properties/${p.slug}`)
          // The button is part of the card's shape, so it always renders. What
          // moves is where it points: a real flyer downloads, and '#' — the
          // seed's placeholder for "none uploaded yet" — falls through to the
          // property's own page rather than becoming a dead click.

          // The card's padding is deliberately asymmetric. The image is inset by
          // the card's own p-3.5 and reads as intentional there; text at that
          // same distance just looks like it's falling off the edge, so the type
          // side gets room to breathe.
          return (
            // Hover is carried by the shadow and the image, never by a
            // transform on the card: GSAP animates these in on `y` and leaves
            // an inline `transform` behind, which an inline style always wins
            // against a utility class — a `hover:-translate-y` here would
            // silently stop working the moment the reveal had run.
            <article
              key={p.slug}
              data-card
              className="group relative grid overflow-hidden rounded-panel bg-surface shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-shadow duration-500 ease-brand hover:shadow-[0_28px_64px_-42px_rgba(0,0,0,0.52)] focus-within:shadow-[0_28px_64px_-42px_rgba(0,0,0,0.52)] md:min-h-80 md:grid-cols-[minmax(18rem,34%)_minmax(0,1fr)]"
            >
              {p.image && (
                // A real link rather than an onClick on the image: the old
                // handler was reachable by mouse only, so the largest target on
                // the card was invisible to the keyboard. Hidden from the
                // accessibility tree because the heading below already links to
                // the same place, and two links to one property read as two
                // properties when they're announced in sequence.
                <div className="relative h-52 w-full overflow-hidden bg-surface-alt sm:h-64 md:h-full">
                  <img
                    src={sized(p.image, 'card')}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.035]"
                  />
                </div>
              )}

              {/* min-w-0 so a long blurb wraps instead of widening the row and
                  squeezing the stats column off the end. Centred rather than
                  top-aligned: the image sets the row height, so anchoring the
                  type to the top pools all the slack under the buttons. */}
              <div className="grid min-w-0 gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1fr)_12rem] md:gap-7 md:p-8">
                <div className="min-w-0">
                  {p.category && <p className="mb-3 font-body text-[12px] font-bold uppercase tracking-[0.16em] text-accent">{p.category}</p>}
                <h3 className="font-display text-[clamp(1.45rem,2vw,1.9rem)] font-bold leading-[1.08] tracking-[-0.02em] text-content transition-colors duration-300 hover:text-accent group-hover:text-accent">
                  {p.name}
                </h3>

                {p.address && (
                  <p className="mt-2 font-body text-[15px] leading-relaxed text-content/70">{p.address}</p>
                )}
                {typeof p.detail?.offer === 'string' && p.detail.offer.trim() && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-ember/25 bg-ember/10 px-4 py-3">
                    <OfferIcon />
                    <div className="min-w-0">
                      <p className="font-body text-[12px] font-bold uppercase tracking-[0.12em] text-content/75">Offer available</p>
                      <p className="mt-0.5 font-body text-[13px] leading-relaxed text-content/85 [overflow-wrap:anywhere]">
                        {p.detail.offer}
                      </p>
                    </div>
                  </div>
                )}

                {specs.length > 0 && (
                  <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-line py-4 sm:grid-cols-3">
                    {/* Indexed, not keyed on the label: these are free text an
                        admin typed, so two blank or repeated labels are a
                        content mistake, not an impossible one — and React
                        answers duplicate keys by dropping a row. */}
                    {specs.map((s, i) => (
                      <li key={`${s.label ?? ''}-${i}`} className="flex items-center gap-2">
                        <SpecIcon label={s.label} />
                        <span className="font-body text-[13px] font-medium text-content/75">
                          {[s.value, s.label].filter(Boolean).join(' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {blurb && (
                  <p className="mt-4 max-w-[62ch] font-body text-[14px] leading-[1.65] text-content/70 line-clamp-2">
                    {blurb}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href={`/properties/${p.slug}`}
                    onClick={(e) => {
                      e.preventDefault()
                      open()
                    }}
                    aria-label={`View ${p.name}`}
                    className="after:absolute after:inset-0 inline-flex min-h-12 items-center rounded-full bg-invert px-6 font-body text-[14px] font-bold text-invert-fg transition-opacity duration-300 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
                  >
                    View property
                  </a>

                  <button
                    type="button"
                    onClick={() => setBrochureProperty(p)}
                    className="relative z-10 inline-flex min-h-12 items-center gap-2.5 rounded-full border border-content/25 px-5 font-body text-[14px] font-medium text-content transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
                  >
                    Request brochure
                    <MailIcon />
                  </button>
                </div>
                </div>

                <AvailabilityMeter
                  total={p.buildings}
                  sold={p.sold}
                  available={p.available}
                />
              </div>
            </article>
          )
        })}
      </div>
      {brochureProperty && (
        <BrochureRequestModal property={brochureProperty} onClose={() => setBrochureProperty(null)} />
      )}
    </section>
  )
}
