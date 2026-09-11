import { useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSectionNav } from '../hooks/useSectionNav'
import { lenis } from '../hooks/useSmoothScroll'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { organizationSchema } from '../lib/structuredData'
import SocialIcon from './SocialIcon'
import TexasMap from './TexasMap'
import FooterSimilarProperties from './FooterSimilarProperties'
import logo from '../assets/prime-logo.svg'
import watermark from '../assets/watermark-p.svg'

// The old file imported ScrollTrigger without registering it and worked only
// because About/Hero/Services happen to register it at module scope and end up
// in the same bundle. That is a load-order accident, not a guarantee — the
// footer renders on routes where none of those three mount.
gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// THE CLOSE
//
// Two parts, stacked: a dark panel that overlaps the footer beneath it, and the
// directory itself.
//
// The overlap is the whole composition. Panel and footer are siblings, the
// footer is pulled up under the panel, and the panel carries the higher stacking
// order so it sits *on* the black rather than being swallowed by it. That single
// relationship is what stops the page ending as three stacked rectangles.
//
// The panel is now the site's only closing CTA. It used to be `CallToAction` on
// the homepage and nothing anywhere else, which meant the homepage said the same
// thing twice in a row and every other route ended on a link list. Its copy
// still comes from the `cta_home` section, so nothing an editor wrote was lost
// in the move.
// ─────────────────────────────────────────────────────────────────────────────

// Every public route the site serves, in the order a footer should list them.
//
// This file used to carry a one-line special case appending `/learn` when the
// authored list did not have it. The cause was never Learn specifically: the
// seeded quick links predate half the site, and a database seeded before News
// and Expertise existed is never going to grow those entries by itself. Union
// against the canonical list and every such gap closes, not just the one that
// happened to get noticed. Authored links keep their order and their labels —
// this only adds what is missing.
const ESSENTIAL_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Properties', href: '/properties' },
  { label: 'Expertise', href: '/enterprise' },
  { label: 'News', href: '/news' },
  { label: 'Learn', href: '/learn' },
  { label: 'Contact', href: '/contact' },
]

// '/news/' and '/news' are the same destination and must not both be listed.
const normalise = (href) => {
  const value = href ?? ''
  return value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value
}

function withEssentialLinks(authored = []) {
  const seen = new Set(authored.map((l) => normalise(l.href)))
  return [...authored, ...ESSENTIAL_LINKS.filter((l) => !seen.has(normalise(l.href)))]
}

function ArrowIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

// Every '<' escaped to its JSON unicode form. The values here are CMS strings,
// and one containing "</script>" would otherwise close this tag and hand the
// rest of it to the parser as markup. `<` parses back to the same string.
const serialise = (data) => JSON.stringify(data).replaceAll('<', String.fromCharCode(92) + 'u003c')

function ColumnTitle({ children }) {
  return <h3 className="font-body text-[13px] font-medium text-bone-3">{children}</h3>
}

function FooterLink({ href, label, onNavigate, external, size = 'text-[15px]' }) {
  const props = external
    ? { target: '_blank', rel: 'noreferrer' }
    : { onClick: (e) => onNavigate(e, href) }

  return (
    <a
      href={href}
      {...props}
      className={`inline-flex min-h-9 items-center gap-2.5 font-body ${size} text-bone/75 transition-colors duration-300 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`}
    >
      {label}
    </a>
  )
}

export default function Footer() {
  const footer = useSection('footer')
  const {
    email, phone, studio, quickLinks, socials, copyrightLeft, copyrightRight,
    quickLinksHeading, portfolioHeading, socialHeading, allPropertiesLabel,
    exploreEyebrow, exploreHeading, viewAllLabel,
    addressStreet, addressLocality, addressRegion, addressPostalCode,
    legalLinks, licenseLabel, licenseNumber, backToTopLabel,
  } = footer
  const cta = useSection('cta_home')
  const { cities } = useSection('texas_map')
  const properties = useProperties()
  const scope = useRef(null)
  const go = useSectionNav()

  const handleNav = (e, href) => {
    if (!href || href === '#') return // placeholder link, seeded but not yet set
    e.preventDefault()
    go(href)
  }

  const isExternal = (href) => /^(https?:)?\/\//i.test(href ?? '')
  const portfolio = properties.slice(0, 5)
  const directoryLinks = withEssentialLinks(quickLinks)

  // The address as postal lines when the structured parts are filled in, and
  // the single authored `studio` line when they are not.
  const localityLine = [
    [addressLocality, addressRegion].filter(Boolean).join(', '),
    addressPostalCode,
  ]
    .filter(Boolean)
    .join(' ')
  // Gated on the street, not on the parts being non-empty. A city and a state
  // with no street is *less* specific than the authored line, so swapping
  // "East 6th Street, Austin, TX" for "Austin, TX" would be a downgrade. The
  // structured data reads whichever parts exist either way.
  const postalLines = [addressStreet, localityLine].filter(Boolean)
  const addressLines = addressStreet
    ? postalLines
    : [studio || localityLine].filter(Boolean)

  const licenseLine = [licenseLabel, licenseNumber].filter(Boolean).join(' ')

  // Client-rendered, so `origin` is always there by the time this runs —
  // guarded regardless, since a bundler-evaluated module scope is not.
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const schema = organizationSchema({
    footer,
    properties,
    cities,
    origin,
    logoUrl: origin && logo.startsWith('/') ? origin + logo : logo,
  })

  const toTop = () => {
    if (lenis.current) lenis.current.scrollTo(0)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      // One orchestrated arrival rather than a reveal per block: the panel lifts
      // onto the footer behind it and the columns follow. `clearProps` on both
      // because a `.from()` leaves its inline transform behind for good, and an
      // inline style always beats a utility class (DESIGN.md §9).
      gsap
        .timeline({ scrollTrigger: { trigger: scope.current, start: 'top 72%' } })
        .from('[data-panel]', {
          y: 44,
          opacity: 0,
          duration: 0.95,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        })
        .from(
          '[data-col]',
          {
            y: 22,
            opacity: 0,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.08,
            clearProps: 'transform,opacity',
          },
          '-=0.6'
        )
    },
    { scope }
  )

  return (
    <footer
      id="contact"
      ref={scope}
      // Rebinds the one role token that still reaches in here. The global focus
      // ring paints `--color-accent`, which is CG Blue #0073a4 under the light
      // theme and measures 3.3:1 on the black below — least visible exactly when
      // a keyboard user needs it. Everything else on the dark ground is drawn
      // from the fixed half of the palette, which does not swap under `.dark`.
      style={{ '--color-accent': 'var(--color-accent-soft)' }}
      // `pb` is not optional here. The plate is an inset card with a 26px
      // radius, and with no padding under it those bottom corners sat flush on
      // the edge of the document — the card read as a band that had been cut
      // off rather than as an object the page ends on. It needs the same air
      // beneath it that it already has at either side.
      className="bg-base px-4 pb-4 pt-20 md:px-6 md:pb-6 md:pt-28"
    >
      {/* ── The overlap ──────────────────────────────────────────────────── */}
      <div className="relative">
        {/* The panel. Held above the footer in the stacking order and inset from
            it on both sides, so the black reads as a plate the panel is resting
            on rather than as a box that has clipped it. */}
        <div data-panel className="relative z-10 px-2 sm:px-8 md:px-14">
          {/* Carbon, not ink. The plate underneath is `void`, and against it an
              ink panel sat within a few points of its own ground — the overlap
              that carries this whole composition was only legible by its corner
              radius. Carbon is the palette's raised-surface step and reads as an
              object resting on the black in both themes. */}
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[26px] bg-carbon shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]">
            {/* Aurora wash behind the map, bled off the panel's own corner. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-40 size-[34rem] rounded-full opacity-45 blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, color-mix(in oklab, var(--color-accent-soft) 55%, transparent) 0%, transparent 68%)',
              }}
            />

            <div className="relative grid items-center gap-10 p-8 sm:p-11 md:grid-cols-[1.05fr_0.95fr] md:gap-6 md:p-14">
              <div className="min-w-0">
                <h2 className="max-w-[15ch] text-balance font-display text-[clamp(1.75rem,3.4vw,2.75rem)] font-bold leading-[1.06] tracking-[-0.03em] text-bone">
                  {renderEmphasis(cta.heading)}
                </h2>
                {cta.paragraph && (
                  <p className="mt-5 max-w-[42ch] font-body text-[15px] leading-[1.7] text-bone/65">
                    {cta.paragraph}
                  </p>
                )}
                {cta.ctaLabel && (
                  <Link
                    to={cta.ctaHref || '/contact'}
                    className="group mt-8 inline-flex h-13 w-full items-center justify-center gap-2.5 md:w-auto rounded-xl bg-bone px-7 font-body text-[15px] font-medium text-charcoal transition-opacity duration-300 hover:opacity-88 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
                  >
                    {cta.ctaLabel}
                    <ArrowIcon className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-1" />
                  </Link>
                )}
              </div>

              {/* Bleeds off the panel's right edge only. The reference's globe
                  runs out of frame on two sides, but a globe is a sphere and
                  reads whole from any crop — a state does not. Cutting the Rio
                  Grande valley off the bottom left it looking like a rendering
                  error rather than like Texas, so the vertical bleed is gone and
                  only the eastern edge runs out. */}
              <div className="relative -mr-6 hidden md:block lg:-mr-10">
                <TexasMap properties={properties} cities={cities} className="h-auto w-full max-w-[27rem]" />
              </div>
            </div>

            {/* Below md the panel stacks, and a bleeding map has no side to bleed
                into — so it becomes a contained band instead of being dropped. */}
            <div className="relative -mt-2 flex justify-center px-8 pb-11 md:hidden">
              <TexasMap
                properties={properties}
                cities={cities}
                density="coarse"
                className="h-auto w-full max-w-[19rem]"
              />
            </div>
          </div>
        </div>

        {/* The footer plate, pulled up under the panel. The top padding has to
            clear the overlap, which is why it is so much larger than the bottom. */}
        <div className="relative -mt-28 overflow-hidden rounded-[26px] bg-void px-6 pb-9 pt-44 text-bone sm:-mt-32 sm:pt-48 md:px-14 md:pb-10 md:pt-56">
          {/* Brand watermark — the same `watermark-p` mark and the same 4–5%
              register the about page already uses, rather than a second copy of
              the lockup that is sitting legibly at the top of this very block.

              It is anchored into the foot's bottom-right because that is where
              the plate was emptiest: the directory column runs far longer than
              the identity column beside it, leaving a quarter of the card as
              dead ground. The mark grounds that corner instead of a gap.

              Held fully inside the plate. It used to hang off the corner on
              negative insets, and the plate is `overflow-hidden` — it has to
              be, to clip its own 26px radius — so the bleed cost 14% of the
              mark's width and 18% of its height. At 5.5% opacity a clipped
              edge has no contrast to read as a deliberate crop; it just looks
              like the logo ran out. A bleed is a real device, but it needs to
              be obviously past the edge or not there at all.

              Width is a share of the plate rather than a fixed rem, with a
              ceiling. The mark is 849×910, so a fixed 24rem was 384px wide
              inside a ~343px plate on a small phone — overflowing the far side
              and getting clipped there instead. A percentage cannot.

              `brightness-0 invert` because the source is charcoal #2F2F2F —
              black first, then lifted to white. The about page swaps treatments
              per theme; this plate is void in both, so one treatment covers it. */}
          <img
            src={watermark}
            alt=""
            aria-hidden
            className="pointer-events-none absolute bottom-6 right-6 z-0 w-[62%] max-w-[20rem] select-none opacity-[0.055] brightness-0 invert sm:max-w-[26rem] md:bottom-10 md:right-10 md:max-w-[34rem]"
          />

          <div className="relative z-10 mx-auto max-w-6xl">
            {/* Sits between the CTA panel above and the directory below, and
                now renders on every route rather than only on a property page
                — see the component for what it shows when there is no current
                listing to be similar to. */}
            <FooterSimilarProperties
              properties={properties}
              exploreEyebrow={exploreEyebrow}
              exploreHeading={exploreHeading}
              viewAllLabel={viewAllLabel}
            />

            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.6fr)] lg:gap-16">
              {/* ── Identity ─────────────────────────────────────────────── */}
              <div data-col>
                {/* Unfiltered: this file is already the on-dark lockup — CG Blue
                    mark, near-white wordmark — and the navbar renders the same
                    asset untouched on the same page. */}
                <img
                  src={logo}
                  alt="Prime Developers"
                  width="576"
                  height="144"
                  className="h-9 w-auto select-none sm:h-10"
                />

                {addressLines.length > 0 && (
                  <address className="mt-6 max-w-[24ch] font-body text-[15px] not-italic leading-[1.7] text-bone/60">
                    {addressLines.map((line, i) => (
                      <span key={line} className={i ? 'block' : undefined}>
                        {line}
                      </span>
                    ))}
                  </address>
                )}

                <dl className="mt-7 flex flex-wrap gap-x-12 gap-y-5">
                  {phone && (
                    <div>
                      <dt className="font-body text-[13px] text-bone-3">Phone number</dt>
                      <dd className="mt-1.5">
                        <a
                          href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                          className="font-body text-[15px] text-bone transition-colors duration-300 hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                        >
                          {phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {email && (
                    <div>
                      <dt className="font-body text-[13px] text-bone-3">Email</dt>
                      <dd className="mt-1.5">
                        <a
                          href={`mailto:${email}`}
                          className="font-body text-[15px] text-bone transition-colors duration-300 hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                        >
                          {email}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Blank unless a licence is entered in the CMS, which is the
                    only reason this rule exists — an empty divider under the
                    contact details would just be a stray line. */}
                {licenseLine && (
                  <div className="mt-9 border-t border-[var(--color-line-subtle)] pt-6">
                    <span className="font-body text-[12px] leading-tight text-bone-3">
                      {licenseLine}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Directory ────────────────────────────────────────────── */}
              {/* Three columns, and the third is Portfolio rather than the
                  reference's Legal. Privacy and Terms exist now and are linked,
                  but from the copyright bar: they are footnotes a visitor goes
                  looking for deliberately, and giving them equal weight to the
                  portfolio would spend the width on the one column nobody came
                  here to read. The properties are real, editable, and the thing
                  a visitor here is shopping for. */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
                {directoryLinks.length > 0 && (
                  <nav data-col aria-label="Quick links" className="flex flex-col gap-5">
                    <ColumnTitle>{quickLinksHeading}</ColumnTitle>
                    <ul className="flex flex-col gap-1">
                      {directoryLinks.map((l) => (
                        <li key={`${l.href}|${l.label}`}>
                          <FooterLink href={l.href} label={l.label} onNavigate={handleNav} />
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}

                {portfolio.length > 0 && (
                  <nav data-col aria-label="Portfolio" className="flex flex-col gap-5">
                    <ColumnTitle>{portfolioHeading}</ColumnTitle>
                    <ul className="flex flex-col gap-1">
                      {portfolio.map((p) => (
                        <li key={p.slug}>
                          <Link
                            to={`/properties/${p.slug}`}
                            className="inline-flex min-h-9 items-center font-body text-[15px] text-bone/75 transition-colors duration-300 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                          >
                            {p.name}
                          </Link>
                        </li>
                      ))}
                      <li>
                        <Link
                          to="/properties"
                          className="group inline-flex min-h-9 items-center gap-2 font-body text-[15px] text-accent-soft transition-colors duration-300 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                        >
                          {allPropertiesLabel}
                          <ArrowIcon className="size-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-1" />
                        </Link>
                      </li>
                    </ul>
                  </nav>
                )}

                {socials.length > 0 && (
                  <nav data-col aria-label="Social" className="flex flex-col gap-5">
                    <ColumnTitle>{socialHeading}</ColumnTitle>
                    <ul className="flex flex-col gap-1">
                      {/* Keyed on href *and* label because neither alone is
                          unique: two entries may share a name, and the seeded
                          placeholders all share `#`.

                          Placeholders are rendered rather than filtered out.
                          Hiding them makes the column silently disappear, which
                          looks like the footer lost a section rather than like
                          four URLs are missing — `handleNav` already swallows
                          the click, and the CMS is where this gets fixed. */}
                      {socials.map((l) => (
                        <li key={`${l.href}|${l.label}`}>
                          <a
                            href={l.href}
                            {...(isExternal(l.href)
                              ? { target: '_blank', rel: 'noreferrer' }
                              : { onClick: (e) => handleNav(e, l.href) })}
                            className="group inline-flex min-h-9 items-center gap-2.5 font-body text-[15px] text-bone/75 transition-colors duration-300 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                          >
                            <SocialIcon
                              platform={l.label}
                              className="size-4 shrink-0 text-bone-3 transition-colors duration-300 group-hover:text-accent-soft"
                            />
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>
            </div>

            {/* The bar the whole page ends on.
                `copyrightRight` was seeded, editable in the CMS, and rendered
                nowhere — an editor could type into that field forever and watch
                nothing happen. It has the right half of the bar, which is what
                the field's own name has always promised. */}
            {/* `flex-col-reverse` below md: stacked, the locale and the way back
                up are what a visitor still has a use for, so they sit above the
                copyright and the legal footnotes rather than under them. The
                DOM order is left-group-then-right-group because that is the
                reading order the row restores at md. */}
            <div className="mt-12 flex flex-col-reverse gap-5 border-t border-[var(--color-line-inv)] pt-7 text-center md:flex-row md:items-center md:justify-between md:gap-8 md:text-left">
              <div className="flex flex-col items-center gap-x-6 gap-y-2 md:flex-row">
                {copyrightLeft && (
                  <p className="font-body text-[14px] text-bone-3">{copyrightLeft}</p>
                )}
                {legalLinks?.length > 0 && (
                  <nav aria-label="Legal">
                    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
                      {legalLinks.map((l) => (
                        <li key={`${l.href}|${l.label}`}>
                          <FooterLink
                            href={l.href}
                            label={l.label}
                            onNavigate={handleNav}
                            external={isExternal(l.href)}
                            size="text-[14px]"
                          />
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>

              <div className="flex flex-col items-center gap-x-6 gap-y-2 md:flex-row">
                {copyrightRight && (
                  <p className="font-body text-[14px] text-bone-3">{copyrightRight}</p>
                )}
                {/* A button, not an anchor to '#top': there is no such element,
                    and Lenis owns the scroll position — `window.scrollTo` alone
                    fights it. Falls back to the native smooth scroll on the
                    routes where Lenis has not mounted. */}
                <button
                  type="button"
                  onClick={toTop}
                  className="group inline-flex min-h-9 items-center gap-2 font-body text-[14px] text-bone-3 transition-colors duration-300 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {backToTopLabel}
                  <ArrowIcon className="size-3.5 -rotate-90 transition-transform duration-300 ease-brand group-hover:-translate-y-0.5" />
                </button>
              </div>
            </div>

            {/* Organization markup, built from this section's own fields — see
                lib/structuredData.js for why it is assembled here rather than
                hand-written into index.html. */}
            <script
              type="application/ld+json"
              // eslint-disable-next-line react/no-danger -- serialised JSON with '<' escaped below
              dangerouslySetInnerHTML={{ __html: serialise(schema) }}
            />
          </div>
        </div>
      </div>
    </footer>
  )
}
