import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import MagneticButton from './MagneticButton'
import ArrowRight from './ArrowRight'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection, useProjects } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import logo from '../assets/prime-logo.svg'

const alignCls = {
  left: 'md:items-start md:text-left',
  center: 'md:items-center md:text-center',
  right: 'md:items-end md:text-right',
}

export default function Footer() {
  const { email, phone, studio, ctaHeading, quickLinks, socials, copyrightLeft, copyrightRight } = useSection('footer')
  const projects = useProjects().slice(0, 4)
  const scope = useRef(null)
  const go = useSectionNav()

  const details = [
    { label: 'Email', value: email, href: email ? `mailto:${email}` : null },
    { label: 'Phone', value: phone, href: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null },
    { label: 'Studio', value: studio, href: null },
  ]

  const columns = [
    { title: 'Quick Links', align: 'left', links: quickLinks },
    { title: 'Projects', align: 'center', links: projects.map((p) => ({ label: p.name, href: `/projects/${p.slug}` })) },
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
    <footer
      id="contact"
      ref={scope}
      className="relative overflow-hidden border-t border-[var(--color-line-inv)] bg-void px-6 pb-8 pt-24 text-bone md:px-[75px] md:pt-32"
    >
      {/* ember dusk glow, bottom-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(50% 45% at 100% 100%, rgba(252,164,46,0.14) 0%, rgba(252,164,46,0) 100%)',
        }}
      />

      {/* Big statement + magnetic CTA */}
      <div className="relative grid items-end gap-12 lg:grid-cols-[1fr_auto]">
        <h2
          data-foot
          className="font-display font-light leading-[0.98] tracking-[-0.02em]"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)' }}
        >
          {renderEmphasis(ctaHeading)}
        </h2>

        <div data-foot className="self-center">
          <MagneticButton
            href={email ? `mailto:${email}` : undefined}
            className="group relative flex size-40 shrink-0 flex-col items-center justify-center gap-2 rounded-full bg-accent text-center text-void md:size-48"
          >
            <span className="font-body text-sm font-bold uppercase tracking-[0.1em]">
              Start a project
            </span>
            <ArrowRight className="size-6 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
          </MagneticButton>
        </div>
      </div>

      {/* Contact details — hairline-divided */}
      <div
        data-foot
        className="relative mt-24 grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-[var(--color-line-inv)] md:grid-cols-3"
      >
        {details.map((d) => {
          const inner = (
            <div className="flex h-full flex-col gap-2.5 bg-void p-8">
              <span className="eyebrow text-bone/40">{d.label}</span>
              <span className="font-display text-xl font-medium tracking-[-0.01em]">{d.value}</span>
            </div>
          )
          return d.href ? (
            <a key={d.label} href={d.href} className="[&>div]:transition-colors [&>div]:hover:bg-carbon">
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
        className="relative mt-20 grid grid-cols-1 gap-12 border-t border-[var(--color-line-inv)] pt-16 md:grid-cols-3"
      >
        {columns.map((col) => (
          <div key={col.title} className={`flex flex-col items-start gap-7 ${alignCls[col.align]}`}>
            <h3 className="eyebrow text-bone/45">{col.title}</h3>
            <ul className="flex flex-col gap-4">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    onClick={(e) => handleNav(e, l.href)}
                    className="font-display text-[19px] font-medium tracking-[-0.01em] text-bone/65 transition-colors duration-300 hover:text-bone"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Oversized wordmark — flattened to a white silhouette to read on the dark ground.
          (Plain `invert` would hue-shift the CG Blue fill to its complement — orange.) */}
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none relative mx-auto mt-24 w-full max-w-none select-none opacity-[0.12] brightness-0 invert"
      />

      {/* Copyright bar */}
      <div className="relative mt-12 flex flex-col gap-2 text-bone/45 md:flex-row md:justify-between">
        <p className="eyebrow">{copyrightLeft}</p>
        <p className="eyebrow">{copyrightRight}</p>
      </div>
    </footer>
  )
}
