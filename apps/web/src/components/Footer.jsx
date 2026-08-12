import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import MagneticButton from './MagneticButton'
import ArrowRight from './ArrowRight'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import logo from '../assets/prime-logo.svg'

const alignCls = {
  left: 'md:items-start md:text-left',
  center: 'md:items-center md:text-center',
  right: 'md:items-end md:text-right',
}

export default function Footer() {
  const { email, phone, studio, ctaHeading, quickLinks, socials, copyrightLeft, copyrightRight } = useSection('footer')
  const properties = useProperties().slice(0, 4)
  const scope = useRef(null)
  const go = useSectionNav()

  const details = [
    { label: 'Email', value: email, href: email ? `mailto:${email}` : null },
    { label: 'Phone', value: phone, href: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null },
    { label: 'Studio', value: studio, href: null },
  ]

  const columns = [
    { title: 'Quick Links', align: 'left', links: quickLinks },
    { title: 'Properties', align: 'center', links: properties.map((p) => ({ label: p.name, href: `/properties/${p.slug}` })) },
    { title: 'Socials', align: 'right', links: socials },
  ]

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
    // surface-alt, and data-band like every other light section — the navbar
    // reads that attribute to pick its own colour, and the footer is tall
    // enough to sit under it on a short page.
    <footer
      id="contact"
      ref={scope}
      data-band="light"
      className="relative overflow-hidden border-t border-[var(--color-line)] bg-surface-alt px-6 pb-8 pt-24 text-content md:px-12 md:pt-32"
    >
      {/* The saffron dusk glow that sat in this corner is gone. It was lift for
          a near-black ground; over a light one it reads as a stain, and saffron
          has been dropped from the light system everywhere else. */}

      {/* Big statement + magnetic CTA */}
      <div className="relative grid items-end gap-12 lg:grid-cols-[1fr_auto]">
        <h2
          data-foot
          className="font-display font-bold leading-[0.98] tracking-[-0.02em] text-content"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)' }}
        >
          {renderEmphasis(ctaHeading)}
        </h2>

        <div data-foot className="self-center">
          <MagneticButton
            href={email ? `mailto:${email}` : undefined}
            // text-white, not text-content: the disc is filled with the accent
            // in both themes, so its label is a pigment rather than a role
            // token — under dark mode text-content would go near-white anyway,
            // but under light it would turn charcoal-on-blue.
            className="group relative flex size-40 shrink-0 flex-col items-center justify-center gap-2 rounded-full bg-accent text-center text-white md:size-48"
          >
            <span className="font-body text-sm font-bold uppercase tracking-[0.1em]">
              Start a property
            </span>
            <ArrowRight className="size-6 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
          </MagneticButton>
        </div>
      </div>

      {/* Contact details — hairline-divided */}
      <div
        data-foot
        className="relative mt-24 grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-line md:grid-cols-3"
      >
        {details.map((d) => {
          const inner = (
            <div className="flex h-full flex-col gap-2.5 bg-surface p-8">
              <span className="eyebrow text-content/45">{d.label}</span>
              <span className="font-display text-xl font-bold tracking-[-0.01em] text-content">
                {d.value}
              </span>
            </div>
          )
          return d.href ? (
            <a key={d.label} href={d.href} className="[&>div]:transition-colors [&>div]:hover:bg-surface-alt">
              {inner}
            </a>
          ) : (
            <div key={d.label}>{inner}</div>
          )
        })}
      </div>

      {/* Three aligned link columns */}
      <div
        data-foot
        className="relative mt-20 grid grid-cols-1 gap-12 border-t border-[var(--color-line)] pt-16 md:grid-cols-3"
      >
        {columns.map((col) => (
          <div key={col.title} className={`flex flex-col items-start gap-7 ${alignCls[col.align]}`}>
            <h3 className="eyebrow text-content/45">{col.title}</h3>
            <ul className="flex flex-col gap-4">
              {/* Keyed on href *and* label because neither alone is unique:
                  two properties may legitimately share a name (the label), and
                  the placeholder social links all share `#` (the href). */}
              {col.links.map((l) => (
                <li key={`${l.href}|${l.label}`}>
                  <a
                    href={l.href}
                    onClick={(e) => handleNav(e, l.href)}
                    className="font-display text-[19px] font-medium tracking-[-0.01em] text-content/65 transition-colors duration-300 hover:text-accent"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Oversized wordmark, flattened to a silhouette and flipped per theme.
          brightness-0 crushes it to black — right on the light ground — and
          dark mode inverts that to white. Plain `invert` on the original would
          hue-shift the CG Blue fill to its complement, orange, which is why the
          mark is knocked to black first in both cases. Carried lighter on light:
          the same 12% that reads as a whisper against near-black is a smudge
          against near-white. */}
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none relative mx-auto mt-24 w-full max-w-none select-none opacity-[0.07] brightness-0 dark:opacity-[0.12] dark:invert"
      />

      {/* Copyright bar */}
      <div className="relative mt-12 flex flex-col gap-2 text-content/45 md:flex-row md:justify-between">
        <p className="eyebrow">{copyrightLeft}</p>
        <p className="eyebrow">{copyrightRight}</p>
      </div>
    </footer>
  )
}
