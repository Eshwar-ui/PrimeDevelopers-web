import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

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
      className="size-4.5 shrink-0 text-content/45"
    >
      <path d={match ? match[1] : FALLBACK_ICON} />
    </svg>
  )
}

function DownloadIcon() {
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
      <path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M4 20h16" />
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
  const soldPct = denominator > 0 ? Math.round((sold / denominator) * 100) : 0
  const soldOut = available === 0

  return (
    <div className="shrink-0 rounded-2xl border border-line bg-surface-alt p-5 md:w-52 md:self-center">
      <p className="eyebrow text-content/40">Availability</p>

      <div className="mt-3 flex items-baseline gap-2">
        {soldOut ? (
          <span className="font-display text-[1.6rem] font-bold leading-none text-content/70">
            Fully sold
          </span>
        ) : (
          <>
            <span className="numeral text-[2.6rem] leading-none text-accent">{available}</span>
            <span className="font-body text-[13px] text-content/50">
              of {total} available
            </span>
          </>
        )}
      </div>

      {/* role="img" rather than a progressbar: this reports a completed
          proportion, not a task in flight, and the label already carries the
          number for anyone not seeing the fill. */}
      <div
        role="img"
        aria-label={`${soldPct}% sold — ${sold} of ${total}`}
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-content/12"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            soldOut ? 'bg-content/35' : 'bg-accent'
          }`}
          style={{ width: `${soldPct}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between font-body text-[12px] text-content/45">
        <span>{sold} sold</span>
        <span>{soldPct}%</span>
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

  useGSAP(
    () => {
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
          const specs = (overview.stats ?? []).filter((s) => s.value || s.label)
          const blurb = p.detail?.tagline || overview.body
          const open = () => navigate(`/properties/${p.slug}`)
          // The button is part of the card's shape, so it always renders. What
          // moves is where it points: a real flyer downloads, and '#' — the
          // seed's placeholder for "none uploaded yet" — falls through to the
          // property's own page rather than becoming a dead click.
          const flyer = overview.flyer && overview.flyer !== '#' ? overview.flyer : null

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
              className="group flex flex-col gap-4 rounded-[20px] bg-surface p-3 shadow-[0_0_0_0_rgba(0,0,0,0)] transition-shadow duration-500 ease-out hover:shadow-[0_26px_56px_-36px_rgba(0,0,0,0.5)] md:flex-row md:items-stretch md:gap-7 md:p-3.5 md:pr-7"
            >
              {p.image && (
                // A real link rather than an onClick on the image: the old
                // handler was reachable by mouse only, so the largest target on
                // the card was invisible to the keyboard. Hidden from the
                // accessibility tree because the heading below already links to
                // the same place, and two links to one property read as two
                // properties when they're announced in sequence.
                <a
                  href={`/properties/${p.slug}`}
                  onClick={(e) => {
                    e.preventDefault()
                    open()
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative h-44 w-full shrink-0 overflow-hidden rounded-[14px] sm:h-56 md:h-auto md:w-[27%] md:min-w-56 md:max-w-124 md:self-stretch"
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                </a>
              )}

              {/* min-w-0 so a long blurb wraps instead of widening the row and
                  squeezing the stats column off the end. Centred rather than
                  top-aligned: the image sets the row height, so anchoring the
                  type to the top pools all the slack under the buttons. */}
              <div className="min-w-0 flex-1 md:self-center md:py-2">
                <a
                  href={`/properties/${p.slug}`}
                  onClick={(e) => {
                    e.preventDefault()
                    open()
                  }}
                  // group-hover as well as hover, so pointing anywhere on the
                  // card lights the name. Without it the image zooms and the
                  // shadow lifts while the title sits inert, and the card reads
                  // as several things reacting rather than one.
                  className="font-display text-[1.45rem] font-bold leading-tight tracking-[-0.01em] text-accent transition-colors duration-300 hover:text-prime-deep group-hover:text-prime-deep"
                >
                  {p.name}
                </a>

                {p.address && (
                  <p className="mt-1 font-body text-[15px] text-content/50">{p.address}</p>
                )}

                {specs.length > 0 && (
                  <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {/* Indexed, not keyed on the label: these are free text an
                        admin typed, so two blank or repeated labels are a
                        content mistake, not an impossible one — and React
                        answers duplicate keys by dropping a row. */}
                    {specs.map((s, i) => (
                      <li key={`${s.label ?? ''}-${i}`} className="flex items-center gap-2">
                        <SpecIcon label={s.label} />
                        <span className="font-body text-[15px] text-content/80">
                          {[s.value, s.label].filter(Boolean).join(' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {blurb && (
                  <p className="mt-3.5 max-w-[68ch] font-body text-[15px] leading-relaxed text-content/85 line-clamp-2">
                    {blurb}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <a
                    href={`/properties/${p.slug}`}
                    onClick={(e) => {
                      e.preventDefault()
                      open()
                    }}
                    className="rounded-xl bg-invert px-5 py-3 font-body text-[15px] font-medium text-invert-fg transition-colors duration-300 hover:opacity-90"
                  >
                    View property
                  </a>

                  <a
                    href={flyer ?? `/properties/${p.slug}`}
                    {...(flyer
                      ? { target: '_blank', rel: 'noreferrer' }
                      : {
                          onClick: (e) => {
                            e.preventDefault()
                            open()
                          },
                        })}
                    className="inline-flex items-center gap-2.5 rounded-xl border border-content/15 bg-surface px-5 py-3 font-body text-[15px] font-medium text-content transition-colors duration-300 hover:border-content/40"
                  >
                    Download brochure
                    <DownloadIcon />
                  </a>
                </div>
              </div>

              <AvailabilityMeter
                total={p.buildings}
                sold={p.sold}
                available={p.available}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}
