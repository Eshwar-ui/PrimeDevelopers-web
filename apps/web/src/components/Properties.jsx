import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection, useProperties } from '../context/ContentContext'
import { sized } from '../lib/images'
import ActionButton from './ActionButton'
import ArrowRight from './ArrowRight'
import BrochureRequestModal from './BrochureRequestModal'

gsap.registerPlugin(ScrollTrigger)

// The cards are half a screen each, so the teaser stays short — a homepage
// section that runs past three of these stops reading as a teaser and starts
// being the index.
const TEASER_COUNT = 3

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0"
    >
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  )
}

/**
 * The three facts a card can state without opening the property.
 *
 * Assembled from what the CMS already holds rather than from new fields:
 * `buildings` is the unit count, and the first two of the property's own
 * overview statistics are whatever that development leads with — square
 * footage, year, acreage. So a card says three true things about *that*
 * property instead of three fields someone had to fill in identically for all
 * of them.
 */
function chipsFor(p) {
  const units = p.buildings ? { value: String(p.buildings), label: 'units' } : null
  const stats = (p.detail?.overview?.stats ?? []).map((s) => ({
    value: String(s.value ?? ''),
    label: s.label ?? '',
  }))

  // A property's own statistics often restate the unit count under a different
  // name — POW Lewisville carries "77 Total Units" next to a `buildings` of 77 —
  // and a card that says "77 units · 77 Total Units" reads as a rendering bug
  // rather than as two facts. Drop any stat whose figure the unit chip is
  // already showing.
  const rest = units ? stats.filter((s) => s.value !== units.value) : stats
  const all = [units, ...rest].filter((c) => c && c.value && c.label)

  // Fitted to one line rather than capped at a count. The chips are divided by
  // rules, and a rule is only a divider while it sits *between* two items — the
  // moment the row wraps, the first chip on the second line carries a vertical
  // stroke hanging off its left with nothing on the other side of it, which
  // reads as a rendering fault. The comp's own chips are three short pairs;
  // real CMS statistics are not ("185,238 SFT Project Size"), so the row takes
  // as many as fit and stops.
  const LINE_BUDGET = 34
  const fitted = []
  let left = LINE_BUDGET
  for (const c of all.slice(0, 3)) {
    const cost = c.value.length + c.label.length + 1
    if (fitted.length && cost > left) break
    fitted.push(c)
    left -= cost
  }
  return fitted
}

export default function Properties() {
  const { heading } = useSection('properties_home')
  const properties = useProperties().slice(0, TEASER_COUNT)
  const scope = useRef(null)
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
        // A `.from()` leaves its inline transform behind permanently, and an
        // inline style always beats a utility class (DESIGN.md §9).
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: scope.current, start: 'top 75%' },
      })
    },
    // Keyed to the card count, and that is what makes this animation exist at
    // all. The properties arrive from the CMS after mount, so on the first pass
    // there are no `[data-card]` elements and the component has in fact returned
    // null — GSAP logged "target not found", built a tween over nothing, and
    // never ran again. The failure was silent in exactly the way a missing
    // entrance always is: the content is all there, it just never moved.
    { scope, dependencies: [properties.length], revertOnUpdate: true }
  )

  if (properties.length === 0) return null

  return (
    <section
      id="properties"
      data-band="light"
      ref={scope}
      aria-labelledby="properties-heading"
      className="bg-base px-gutter py-6 text-content md:px-gutter-lg"
    >
      {/* The design draws no heading here — the cards arrive straight out of
          the featured panel above, and they are legible without one. A landmark
          still has to be named for anyone navigating by region, though, so the
          CMS heading becomes the accessible name rather than being dropped. */}
      <h2 id="properties-heading" className="sr-only">
        {heading || 'Properties'}
      </h2>

      <div className="mx-auto flex max-w-[1560px] flex-col gap-6">
        {properties.map((p, i) => {
          // Alternating sides. Set on the *image* rather than by reversing the
          // row, so the DOM order stays photo-then-detail on every card — which
          // is the order it collapses to on a phone, and the order a screen
          // reader hears regardless of what the grid is doing.
          const flip = i % 2 === 1
          const chips = chipsFor(p)
          const href = `/properties/${p.slug}`
          const open = (e) => {
            e.preventDefault()
            navigate(href)
          }

          return (
            <article
              key={p.slug}
              data-card
              // The accent hairline is the resting state, not a hover: these
              // are the page's primary content and the border is what separates
              // a card from the page ground behind it, which is nearly the same
              // colour.
              className="group relative overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)] focus-within:border-accent/75"
            >
              {p.image && (
                // A block in the flow on a phone, lifted out of it from `md` up.
                // That switch is what lets one element be a stacked banner at
                // one size and a bled-in backdrop at another: absolute here
                // would leave the card with no height on mobile, and static
                // there would push the detail panel below the photograph
                // instead of onto it.
                <div
                  className={`relative h-56 overflow-hidden bg-surface-alt sm:h-72 lg:absolute lg:inset-y-0 lg:h-full lg:w-[62%] ${
                    flip ? 'lg:right-0 card-photo-fade-flip' : 'lg:left-0 card-photo-fade'
                  }`}
                >
                  <img
                    src={sized(p.image, 'card')}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
                  />
                </div>
              )}

              {/* 38%, starting at 62% — exactly where the photograph ends, with
                  no overlap at all. `relative` lifts it over the absolute
                  photograph from `md` up.

                  The two used to overlap by six points, on the theory that the
                  mask had already gone transparent by then. It had not, quite:
                  the last stretch of a fade still carries a few percent of
                  image, and on these photographs that stretch is bright sky, so
                  the panel's first line sat on a lilac smear. The dissolve now
                  finishes around 61% of the card and the panel starts at 62%.

                  The min-height is what actually sets the card's proportion:
                  the panel holds four short blocks and would collapse to about
                  a fifth of the card's width in height, which is a letterbox,
                  not a card. 23rem puts a 1240px card at ~368 tall — the comp
                  measures 354 on a 1196 card, so the same 0.30 ratio. */}
              <div
                className={`relative flex min-w-0 flex-col justify-center gap-5 p-6 sm:p-8 lg:min-h-[23rem] lg:w-[38%] lg:p-10 ${
                  flip ? 'lg:mr-auto' : 'lg:ml-auto'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-[clamp(1.4rem,2.1vw,1.95rem)] font-bold leading-[1.1] tracking-[-0.02em] text-content">
                      {/* The stretched link. One clickable region covering the
                          whole card, anchored on the name so the accessible
                          name is the property rather than "view property". The
                          buttons below sit above it on z-index. */}
                      <a
                        href={href}
                        onClick={open}
                        className="outline-none after:absolute after:inset-0 after:rounded-frame focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
                      >
                        {p.name}
                      </a>
                    </h3>
                    {p.address && (
                      <p className="mt-2 font-body text-[13px] italic leading-relaxed text-content/50">
                        {p.address}
                      </p>
                    )}
                  </div>

                  {/* Decorative twin of the stretched link above — the whole
                      card already goes there, so this must not be a second tab
                      stop announcing the same destination. Solid rather than
                      outlined, as drawn, and on role tokens so it does not
                      become a white disc on a white card in the light theme. */}
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-invert text-invert-fg transition-colors duration-300 group-hover:bg-accent group-hover:text-white"
                  >
                    <ArrowRight className="size-4 -rotate-45" />
                  </span>
                </div>

                {/* Divided by rules rather than boxed into pills. Three bordered
                    chips read as three tappable things; these are facts, and the
                    comp sets them as one line of figures with hairlines between.
                    The divider hangs off each item after the first, so it cannot
                    end up trailing the last one. */}
                {chips.length > 0 && (
                  <ul className="flex flex-wrap items-center gap-y-3 font-body text-[14px] text-content/70">
                    {chips.map((c, ci) => (
                      <li
                        key={c.label}
                        // py-1.5 on every item, not just the divided ones, so
                        // the rules run taller than the text the way the comp
                        // draws them and every item keeps the same baseline.
                        className={`py-1.5 ${ci === 0 ? '' : 'ml-4 border-l border-content/20 pl-4'}`}
                      >
                        <span className="numeral font-bold text-content">{c.value}</span>{' '}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}

                {/* relative z-10 so these clear the stretched link's ::after
                    and stay independently clickable. */}
                <div className="relative z-10 mt-1 flex flex-wrap items-center gap-3">
                  <ActionButton href={href} onClick={open}>
                    View property
                  </ActionButton>

                  <ActionButton as="button" type="button" tone="invert" onClick={() => setBrochureProperty(p)}>
                    Download brochure
                    <DownloadIcon />
                  </ActionButton>
                </div>
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
