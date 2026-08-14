import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection, useProperties } from '../context/ContentContext'
import logo from '../assets/prime-logo.svg'

// The old file imported ScrollTrigger without registering it and worked only
// because About/Hero/Services happen to register it at module scope and end up
// in the same bundle. That is a load-order accident, not a guarantee — the
// footer renders on routes where none of those three mount.
gsap.registerPlugin(ScrollTrigger)

export default function Footer() {
  // `ctaHeading` is deliberately not read here. CallToAction is the page's
  // closing statement — it sits immediately above this on the homepage and says
  // the same thing with a photograph behind it — so a second oversized heading
  // and a second "start a property" button was the same ask twice in a row. The
  // field stays in the CMS schema rather than being deleted: the copy is still
  // there if the closing panel is ever reworked, and dropping it would take an
  // editor's text with it.
  const { email, phone, studio, quickLinks, socials, copyrightLeft, copyrightRight } = useSection('footer')
  const properties = useProperties().slice(0, 4)
  const scope = useRef(null)
  const go = useSectionNav()

  const details = [
    { label: 'Email', value: email, href: email ? `mailto:${email}` : null },
    { label: 'Phone', value: phone, href: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null },
    { label: 'Studio', value: studio, href: null },
  ]

  // An empty column is a hole in the grid, not a column — the CMS defaults every
  // one of these to `[]`, and a site with no properties published would otherwise
  // leave a titled heading standing over nothing.
  const columns = [
    { title: 'Quick Links', links: quickLinks },
    { title: 'Properties', links: properties.map((p) => ({ label: p.name, href: `/properties/${p.slug}` })) },
    { title: 'Socials', links: socials },
  ].filter((col) => col.links.length > 0)

  const handleNav = (e, href) => {
    if (href === '#') return // placeholder social links
    e.preventDefault()
    go(href)
  }

  useGSAP(
    () => {
      gsap.from('[data-foot]', {
        y: 40,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: { trigger: scope.current, start: 'top 75%' },
      })
    },
    { scope }
  )

  return (
    // A dark anchor in *both* themes, and now the bottom half of one continuous
    // dark close: the CallToAction panel above runs straight into this ground
    // rather than sitting on a white band above it.
    //
    // Deliberately carries no data-band, following the closing image band on the
    // about page and the dark sections on the property page. The navbar picks its
    // chrome by observing [data-band="light"] under itself; tagging this one would
    // flip the header to charcoal type over a near-black ground.
    //
    // Because the ground no longer changes with the theme, every colour here is
    // drawn from the *fixed* half of the palette — void, bone, accent-soft,
    // line-inv — never the role tokens (surface/content/accent/line), which swap
    // under .dark and would invert against a ground that doesn't.
    <footer
      id="contact"
      ref={scope}
      className="relative overflow-hidden bg-void px-6 pb-10 pt-20 text-bone md:px-12 md:pt-24"
    >
      {/* ── 01 · Contact strip ─────────────────────────────────── */}
      {/* Open, hairline-ruled columns rather than a bordered card grid. A card
          grid draws its cell separation with a `gap-px` over a `bg-line` fill —
          a trick that needs the gap colour to contrast with the cells, which
          stops working when both go dark. Rules do the same job here without
          asking three panels to float on an unlit page. */}
      <div data-foot className="relative grid border-t border-[var(--color-line-inv)] md:grid-cols-3">
        {details.map((d, i) => {
          const inner = (
            <div className="flex h-full flex-col gap-3 py-8 md:py-10">
              <span className="eyebrow text-bone/50">{d.label}</span>
              <span className="font-display text-lg font-medium tracking-[-0.01em] md:text-xl">
                {d.value}
              </span>
            </div>
          )
          const cell = `${i > 0 ? 'border-t border-[var(--color-line-inv)] md:border-t-0 md:border-l md:pl-10' : ''}`
          return d.href ? (
            <a
              key={d.label}
              href={d.href}
              className={`${cell} group transition-colors duration-300 hover:text-accent-soft`}
            >
              {inner}
            </a>
          ) : (
            <div key={d.label} className={cell}>
              {inner}
            </div>
          )
        })}
      </div>

      {/* ── 02 · Link columns ──────────────────────────────────── */}
      {/* All three read left-aligned. An earlier pass centred the middle column
          and right-aligned the last, which looked balanced as a block but gave
          the eye three different left edges to find on the way down. */}
      <div
        data-foot
        className="relative mt-16 grid grid-cols-1 gap-x-8 gap-y-10 border-t border-[var(--color-line-inv)] pt-12 sm:grid-cols-2 md:mt-20 md:grid-cols-3 md:gap-12 md:pt-16"
      >
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col items-start gap-6">
            <h3 className="eyebrow text-bone/50">{col.title}</h3>
            <ul className="flex flex-col gap-3.5">
              {/* Keyed on href *and* label because neither alone is unique:
                  two properties may legitimately share a name (the label), and
                  the placeholder social links all share `#` (the href). */}
              {col.links.map((l) => (
                <li key={`${l.href}|${l.label}`}>
                  <a
                    href={l.href}
                    onClick={(e) => handleNav(e, l.href)}
                    className="group relative inline-flex min-h-11 items-center font-display text-[17px] font-medium tracking-[-0.01em] text-bone/60 transition-colors duration-300 hover:text-bone md:text-[19px]"
                  >
                    {l.label}
                    {/* Wipes in from the left instead of the whole label just
                        changing colour — the one piece of motion in a block
                        that is otherwise static, and it tracks the reading
                        direction rather than blinking on. */}
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent-soft transition-[width] duration-300 ease-brand group-hover:w-full"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── 03 · Wordmark ──────────────────────────────────────── */}
      {/* brightness-0 crushes the mark to a black silhouette, invert lifts it to
          white. Both are needed: plain `invert` on the original would hue-shift
          the CG Blue fill to its complement, orange. This used to be a pair of
          per-theme treatments at two different opacities; on a ground that no
          longer changes, one treatment covers both. */}
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none relative mx-auto mt-24 w-full max-w-none select-none opacity-[0.06] brightness-0 invert md:mt-28"
      />

      {/* ── 04 · Copyright ─────────────────────────────────────── */}
      <div className="relative mt-12 flex flex-col gap-2 border-t border-[var(--color-line-inv)] pt-8 text-bone/50 md:flex-row md:justify-between">
        <p className="eyebrow">{copyrightLeft}</p>
        <p className="eyebrow">{copyrightRight}</p>
      </div>
    </footer>
  )
}
