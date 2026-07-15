import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import MagneticButton from './MagneticButton'
import ArrowRight from './ArrowRight'
import { useSectionNav } from '../hooks/useSectionNav'
import logo from '../assets/prime-logo.svg'

const details = [
  { label: 'Email', value: 'hello@primedevelopers.com', href: 'mailto:hello@primedevelopers.com' },
  { label: 'Phone', value: '+1 (512) 419-2837', href: 'tel:+15124192837' },
  { label: 'Studio', value: 'East 6th Street, Austin, TX', href: null },
]

const columns = [
  {
    title: 'Quick Links',
    align: 'left',
    links: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      { label: 'Projects', href: '/projects' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Projects',
    align: 'center',
    links: [
      { label: 'Cedar Grove Residences', href: '/projects' },
      { label: 'Sunnyvale Estates', href: '/projects' },
      { label: 'Riverside Villas', href: '/projects' },
      { label: 'Oakridge Meadows', href: '/projects' },
    ],
  },
  {
    title: 'Socials',
    align: 'right',
    links: [
      { label: 'Instagram', href: '#' },
      { label: 'LinkedIn', href: '#' },
      { label: 'X', href: '#' },
      { label: 'Facebook', href: '#' },
    ],
  },
]

const alignCls = {
  left: 'md:items-start md:text-left',
  center: 'md:items-center md:text-center',
  right: 'md:items-end md:text-right',
}

export default function Footer() {
  const scope = useRef(null)
  const go = useSectionNav()

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
      className="relative overflow-hidden border-t border-[var(--color-line-inv)] bg-ink px-6 pb-8 pt-24 text-bone md:px-[75px] md:pt-32"
    >
      {/* Big statement + magnetic CTA */}
      <div className="grid items-end gap-12 lg:grid-cols-[1fr_auto]">
        <h2
          data-foot
          className="font-display font-light uppercase leading-[1.05] tracking-[0.02em]"
          style={{ fontSize: 'clamp(2rem, 4.4vw, 3.5rem)' }}
        >
          Let&apos;s build
          <br />
          something lasting
        </h2>

        <div data-foot className="self-center">
          <MagneticButton
            href="mailto:hello@primedevelopers.com"
            className="group flex size-40 shrink-0 flex-col items-center justify-center gap-2 rounded-full bg-accent text-center text-bone md:size-48"
          >
            <span className="font-display text-lg font-bold">Start a project</span>
            <ArrowRight className="size-6 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
          </MagneticButton>
        </div>
      </div>

      {/* Contact details — hairline-divided */}
      <div
        data-foot
        className="mt-24 grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-[var(--color-line-inv)] md:grid-cols-3"
      >
        {details.map((d) => {
          const inner = (
            <div className="flex h-full flex-col gap-2.5 bg-ink p-8">
              <span className="font-body text-[13px] font-bold uppercase tracking-[0.22em] text-bone/40">
                {d.label}
              </span>
              <span className="font-display text-xl font-medium tracking-[-0.01em]">
                {d.value}
              </span>
            </div>
          )
          return d.href ? (
            <a key={d.label} href={d.href} className="[&>div]:transition-colors [&>div]:hover:bg-[#17171a]">
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
        className="mt-20 grid grid-cols-1 gap-12 border-t border-[var(--color-line-inv)] pt-16 md:grid-cols-3"
      >
        {columns.map((col) => (
          <div key={col.title} className={`flex flex-col items-start gap-7 ${alignCls[col.align]}`}>
            <h3 className="font-body text-[13px] font-bold uppercase tracking-[0.22em] text-bone/45">
              {col.title}
            </h3>
            <ul className="flex flex-col gap-4">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    onClick={(e) => handleNav(e, l.href)}
                    className="font-display text-[19px] font-medium tracking-[-0.01em] text-bone/70 transition-colors duration-300 hover:text-bone"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Oversized wordmark */}
      <img
        src={logo}
        alt=""
        aria-hidden
        className="pointer-events-none mx-auto mt-24 w-full max-w-none select-none opacity-[0.14]"
      />

      {/* Copyright bar */}
      <div className="mt-12 flex flex-col gap-2 text-bone/50 md:flex-row md:justify-between">
        <p className="eyebrow">© 2026 Prime Developers</p>
        <p className="eyebrow">Austin · Texas</p>
      </div>
    </footer>
  )
}
