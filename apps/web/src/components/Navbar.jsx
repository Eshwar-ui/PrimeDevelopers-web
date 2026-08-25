import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import gsap from 'gsap'
import { useNavigate, useLocation } from 'react-router-dom'
import { lenis } from '../hooks/useSmoothScroll'
import { useSection } from '../context/ContentContext'
import { useTheme } from '../context/ThemeContext'
import ArrowRight from './ArrowRight'
import { WhatsappLogo } from '@phosphor-icons/react'
import logoOnDark from '../assets/prime-logo.svg'
import logoOnLight from '../assets/prime-logo-dark.svg'

// Homepage section ids tracked for the scroll-spy active-link highlight —
// structural, tied to actual DOM ids on the homepage, not admin-editable.
const sections = ['about', 'properties']

// The rail used to sit short on the homepage and widen as you scrolled, so it
// fitted inside the bay the old hero cut out of its photograph for it. That
// hero is gone — the new one is a full-bleed frame with nothing cut out of it —
// and with it the `COLLAPSED` fraction and the `--nav-bay` measurement that
// told the hero where to stop cutting. The header now runs the full measure on
// every route, which is what the design draws.

export default function Navbar() {
  const { links } = useSection('navbar')
  const contact = useSection('contact_page')
  const { isDark } = useTheme()
  const [active, setActive] = useState(null)
  const [overLight, setOverLight] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const inBand = useRef(new Set())
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!menuOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => event.key === 'Escape' && setMenuOpen(false)
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!whatsappOpen) return undefined
    const onKeyDown = (event) => event.key === 'Escape' && setWhatsappOpen(false)
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [whatsappOpen])

  // The lockup doubles as the Home link, so the rail only needs an explicit
  // Home entry when the admin-managed list doesn't already carry one.
  const linksWithHome = links.some((l) => l.to === '/') ? links : [{ label: 'Home', to: '/' }, ...links]
  const linksWithAcademy = linksWithHome.some((l) => l.to === '/learn')
    ? linksWithHome
    : [...linksWithHome, { label: 'Learn', to: '/learn' }]
  const navLinks = linksWithAcademy.filter((link) => link.to !== '/contact')
  const phoneHref = contact.phone ? `tel:${contact.phone.replace(/[^d+]/g, '')}` : null
  const whatsapp = contact.socials?.find((item) => item.label?.trim().toLowerCase() === 'whatsapp')
  const whatsappChatHref = whatsapp?.href && whatsapp.href !== '#' ? whatsapp.href : null
  const whatsappJoinHref = whatsappChatHref
    ? `${whatsappChatHref}${whatsappChatHref.includes('?') ? '&' : '?'}text=${encodeURIComponent("Hi, I'd like to join the Prime Developer WhatsApp group.")}`
    : null

  const handleNav = (e, link) => {
    e.preventDefault()
    setMenuOpen(false)
    if (link.to) {
      navigate(link.to)
      return
    }
    const target = `#${link.section}`
    if (pathname !== '/') {
      navigate('/')
      setTimeout(() => lenis.current?.scrollTo(target, { offset: -20 }), 140)
    } else {
      lenis.current?.scrollTo(target, { offset: -20 })
    }
  }

  const goHome = (e) => {
    e.preventDefault()
    setMenuOpen(false)
    if (pathname !== '/') navigate('/')
    else lenis.current?.scrollTo(0)
  }

  const goContact = (e) => {
    e.preventDefault()
    setMenuOpen(false)
    navigate('/contact')
  }

  const isActive = (link) =>
    link.to ? pathname === link.to : pathname === '/' && active === link.section

  const animateNavLabel = (event, entering) => {
    const label = event.currentTarget.querySelector('[data-nav-label]')
    if (!label) return

    gsap.killTweensOf(label)
    if (prefersReducedMotion) {
      gsap.set(label, { clearProps: 'transform' })
      return
    }

    gsap.to(label, {
      y: entering ? -2 : 0,
      duration: entering ? 0.32 : 0.5,
      ease: 'power4.out',
      overwrite: true,
      onComplete: entering ? undefined : () => gsap.set(label, { clearProps: 'transform' }),
    })
  }
  // Active home-section highlight.
  useEffect(() => {
    inBand.current.clear()
    setActive(null)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) inBand.current.add(e.target.id)
          else inBand.current.delete(e.target.id)
        })
        setActive(sections.find((id) => inBand.current.has(id)) ?? null)
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    sections.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [pathname])

  // Interior pages are still dark; the light bands (tagged data-band="light",
  // the homepage hero among them) flip the chrome to charcoal. A thin band
  // through the nav is observed — reliable under Lenis, unlike scroll events.
  useEffect(() => {
    let observer
    // The bands the live observer is watching. Rebuilding is only worth doing
    // when this set actually changes: the mutation watch below is on the whole
    // subtree, and plenty of things under <main> add and remove nodes without
    // touching a band — drei mounts and unmounts an element per 3D unit label
    // as they declutter, which on a property page is churn on every frame.
    // Without this guard each of those frames would re-query the document and
    // construct a fresh IntersectionObserver for the same five sections.
    let watched = []
    const same = (next) => next.length === watched.length && next.every((el, i) => el === watched[i])

    // `force` is for the resize path, where the bands are unchanged but the
    // rootMargin is derived from the viewport height and has to be recomputed.
    const build = (force = false) => {
      const els = Array.from(document.querySelectorAll('[data-band="light"]'))
      if (observer && !force && same(els)) return
      if (observer) observer.disconnect()
      watched = els
      const seen = new Set()
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) seen.add(e.target)
            else seen.delete(e.target)
          })
          setOverLight(seen.size > 0)
        },
        // Clamped at 0. The intent is "a 56px band just under the nav", but
        // subtracting from an innerHeight that is smaller than 56 — a viewport
        // not yet laid out, which reads as 0 in an embedded frame — yields
        // `--56px`, and the IntersectionObserver constructor throws on it.
        // Thrown from inside an effect, that takes the whole render down.
        { rootMargin: `-40px 0px -${Math.max(0, window.innerHeight - 56)}px 0px` }
      )
      els.forEach((el) => observer.observe(el))
    }

    build()

    // Rebuilt whenever nodes are added or removed anywhere under <main>, not on
    // the pathname alone. The page transition holds the incoming route back
    // until the outgoing one has finished leaving, so at the moment the pathname
    // changes there is nothing mounted to find: the observer would come up
    // watching no bands, never fire, and leave `overLight` false — bone type and
    // a bone logo on a bone hero, with only the accent-coloured active link
    // still legible.
    //
    // `subtree` is what makes that hold for the routes that are code-split. Those
    // mount a Suspense fallback first and swap the real page in *underneath* the
    // transition wrapper, which is not a child of <main> — so watching only
    // <main>'s own children saw the fallback and never the page. It presented as
    // the failure above on every lazy route while the eagerly-imported home page
    // stayed fine, and intermittently even there, since a warm module cache can
    // resolve the import before the callback is delivered.
    //
    // Coalesced to one rebuild per frame: a subtree watch on an animated page
    // fires in bursts, and build() re-queries and reconstructs an observer each
    // time. Only insertions and removals are watched, so style and attribute
    // churn from GSAP costs nothing here.
    const host = document.querySelector('main')
    let queued = 0
    const rebuild = () => {
      cancelAnimationFrame(queued)
      queued = requestAnimationFrame(build)
    }
    const swaps = host && new MutationObserver(rebuild)
    swaps?.observe(host, { childList: true, subtree: true })

    const onResize = () => build(true)
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(queued)
      if (observer) observer.disconnect()
      swaps?.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [pathname])

  // At the very top the header is a bare overlay standing on the hero's own
  // photograph. Once that has scrolled away the links would be reading against
  // whatever the page happens to be showing, so the bar takes a ground of its
  // own. Boolean, so this re-renders on the flip rather than on every frame.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 16)
    update()
    // Lenis scrolls the window for real, so the native event is authoritative
    // and there's no need to wait on the instance existing.
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [pathname])

  // Over a light band → charcoal chrome. Over dark, or with the full-screen
  // mobile menu open, → bone chrome.
  //
  // isDark vetoes the whole thing: data-band="light" marks sections that are
  // light *in the light theme*, and under dark mode those same sections are
  // dark grounds. Without the veto the header would paint charcoal type onto
  // them and disappear.
  const onLight = overLight && !menuOpen && !isDark
  const logo = onLight ? logoOnLight : logoOnDark
  const idle = onLight ? 'text-charcoal/75 hover:text-charcoal' : 'text-bone/75 hover:text-bone'
  const current = onLight ? 'text-accent' : 'text-accent-soft'
  const enquire = onLight
    ? 'bg-charcoal text-white'
    : 'bg-white text-charcoal'
  const enquireDot = 'bg-charcoal text-white'
  const enquireFlood = 'bg-charcoal'
  const burger = onLight ? 'bg-charcoal' : 'bg-bone'

  // At rest the header is a bare overlay reading on the hero's graded sky,
  // which is dark enough at the crown to carry bone type on its own. Once that
  // has scrolled away the links would otherwise sit on whatever the page
  // happens to be showing, so the bar takes a surface of its own, tinted to the
  // band it is over. Suppressed while the mobile menu is open, which paints its
  // own ground.
  const surfaced = scrolled && !menuOpen
  const shell = !surfaced
    ? 'bg-transparent'
    : onLight
      ? 'bg-white/85 shadow-[0_1px_0_var(--color-line),0_10px_30px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl'
      : 'bg-void/80 shadow-[0_1px_0_var(--color-line-inv),0_10px_30px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl'

  return (
    <>
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,padding] duration-500 ${shell} ${
          surfaced ? 'py-3 md:py-3.5' : 'py-4 md:py-5'
        }`}
      >
        {/* Padding inside the measure, matching the hero's container exactly —
            with it outside, the lockup and the headline drift apart by the
            padding once the viewport passes 1560. */}
        <div className="mx-auto max-w-[1560px] px-6 md:px-12">
          <div className="relative flex items-center justify-between gap-6">
          <a href="/" onClick={goHome} className="shrink-0" aria-label="Prime Developer — home">
            <img
              src={logo}
              alt="Prime Developer"
              className="h-8 w-auto transition-opacity duration-500 md:h-10"
            />
          </a>

          {/* Desktop rail */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
            <ul className="flex items-center gap-5 lg:gap-6">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.to ?? `/#${link.section}`}
                    onClick={(e) => handleNav(e, link)}
                    aria-current={isActive(link) ? 'page' : undefined}
                    onMouseEnter={(event) => animateNavLabel(event, true)}
                    onMouseLeave={(event) => animateNavLabel(event, false)}
                    onFocus={(event) => animateNavLabel(event, true)}
                    onBlur={(event) => animateNavLabel(event, false)}
                    className={`group relative block rounded-sm py-2 font-body text-[15px] font-medium transition-colors duration-200 ease-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                      isActive(link) ? current : idle
                    }`}
                  >
                    <span aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 h-5 -translate-y-1/2 scale-x-75 rounded-full bg-accent/15 opacity-0 blur-md transition-[opacity,transform] duration-500 ease-brand group-hover:scale-x-110 group-hover:opacity-100 group-focus-visible:scale-x-110 group-focus-visible:opacity-100 motion-reduce:transition-opacity" />
                    <span data-nav-label className="relative block">
                      {link.label}
                    </span>
                    <span
                      aria-hidden
                      className={`absolute inset-x-0 bottom-0 h-px origin-left bg-current transition-[transform,opacity] duration-500 ease-brand motion-reduce:transition-none ${
                        isActive(link)
                          ? 'scale-x-100 opacity-100'
                          : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100 group-focus-visible:scale-x-100 group-focus-visible:opacity-100'
                      }`}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            {phoneHref && (
              <a
                href={phoneHref}
                aria-label={`Call ${contact.phone}`}
                className={`group hidden min-h-11 items-center gap-2 font-body text-[13px] font-medium transition-colors duration-300 ease-brand xl:inline-flex ${idle}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="size-4 transition-transform duration-300 ease-brand group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transform-none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5 9.6 8l-1.7 1.7a15.7 15.7 0 0 0 6.4 6.4l1.7-1.7 3.5 2.1v2.2a1.8 1.8 0 0 1-1.8 1.8A14.2 14.2 0 0 1 3.5 6.3a1.8 1.8 0 0 1 1.8-1.8h2.2Z" />
                </svg>
                <span>{contact.phone}</span>
              </a>
            )}

            {whatsappChatHref && (
              <button
                type="button"
                onClick={() => setWhatsappOpen(true)}
                aria-label="Open WhatsApp options"
                aria-haspopup="dialog"
                className={`group hidden size-11 items-center justify-center rounded-full border transition-[color,background-color,border-color,transform,box-shadow] duration-300 ease-brand hover:scale-105 hover:border-[#25D366] hover:bg-[#25D366] hover:text-white hover:shadow-[0_10px_24px_-10px_rgba(37,211,102,0.9)] focus-visible:border-[#25D366] focus-visible:bg-[#25D366] focus-visible:text-white active:scale-95 lg:inline-flex ${
                  onLight ? 'border-charcoal/20 text-charcoal/70' : 'border-bone/25 text-bone/80'
                }`}
              >
                <WhatsappLogo weight="fill" className="size-5 transition-transform duration-300 ease-brand group-hover:scale-110 motion-reduce:transform-none" />
              </button>
            )}

            <a
              href="/contact"
              onClick={goContact}
              className={`group relative hidden min-h-11 shrink-0 items-center gap-3 overflow-hidden rounded-full py-1.5 pl-6 pr-1.5 transition-[color,transform] duration-300 ease-brand active:scale-[0.97] lg:inline-flex ${enquire}`}
            >
              <span aria-hidden className={`absolute right-1.5 size-9 rounded-full transition-transform duration-500 ease-brand group-hover:scale-[12] group-focus-visible:scale-[12] motion-reduce:transition-none ${enquireFlood}`} />
              <span className="relative z-10 font-body text-[15px] font-medium transition-[color,transform] duration-300 ease-brand group-hover:translate-x-1 group-hover:!text-white group-focus-visible:translate-x-1 group-focus-visible:!text-white motion-reduce:transform-none">Enquire</span>
              <span
                className={`relative z-10 flex size-9 items-center justify-center rounded-full transition-colors duration-200 group-hover:bg-transparent group-hover:!text-white group-focus-visible:bg-transparent group-focus-visible:!text-white ${enquireDot}`}
              >
                <ArrowRight className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none" />
              </span>
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex size-11 items-center justify-center lg:hidden"
          >
            <span className="relative h-3 w-6">
              <span
                className={`absolute left-0 h-0.5 w-6 rounded-full transition-all duration-300 ${burger} ${
                  menuOpen ? 'top-1.5 rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-6 rounded-full transition-all duration-300 ${burger} ${
                  menuOpen ? 'bottom-1.5 -rotate-45' : 'bottom-0'
                }`}
              />
            </span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Full-screen mobile overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex flex-col justify-center gap-3 bg-void px-6 sm:px-8 lg:hidden"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.to ?? `/#${link.section}`}
                onClick={(e) => handleNav(e, link)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                className="flex min-h-11 items-center font-display text-[clamp(2.25rem,10vw,3rem)] font-light tracking-[-0.02em] text-bone"
              >
                <span className="numeral mr-4 align-middle text-base text-accent-soft">
                  0{i + 1}
                </span>
                {link.label}
              </motion.a>
            ))}
            {(phoneHref || whatsappChatHref) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + navLinks.length * 0.08 }}
                className="mt-7 flex flex-wrap gap-3"
              >
                {phoneHref && (
                  <a href={phoneHref} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-bone/20 px-5 font-body text-sm text-bone">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="size-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5 9.6 8l-1.7 1.7a15.7 15.7 0 0 0 6.4 6.4l1.7-1.7 3.5 2.1v2.2a1.8 1.8 0 0 1-1.8 1.8A14.2 14.2 0 0 1 3.5 6.3a1.8 1.8 0 0 1 1.8-1.8h2.2Z" />
                    </svg>
                    {contact.phone}
                  </a>
                )}
                {whatsappChatHref && (
                  <button type="button" onClick={() => setWhatsappOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 font-body text-sm font-medium text-white">
                    <WhatsappLogo weight="fill" className="size-5" />
                    WhatsApp
                  </button>
                )}
              </motion.div>
            )}

            <motion.a
              href="/contact"
              onClick={goContact}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + navLinks.length * 0.08, ease: 'easeOut' }}
              className="mt-8 inline-flex w-fit items-center gap-3 rounded-full bg-white py-1.5 pl-6 pr-1.5 text-charcoal active:scale-[0.97]"
            >
              <span className="font-body text-[15px] font-medium">Enquire</span>
              <span className="flex size-9 items-center justify-center rounded-full bg-charcoal text-white">
                <ArrowRight className="size-4" />
              </span>
            </motion.a>
          </motion.nav>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {whatsappOpen && (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-center bg-void/65 px-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(event) => event.target === event.currentTarget && setWhatsappOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="whatsapp-dialog-title"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm rounded-panel border border-bone/10 bg-void p-6 text-bone shadow-[0_28px_80px_-28px_rgba(0,0,0,0.85)]"
            >
              <div className="flex items-start justify-between gap-5">
                <div className="flex size-11 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <WhatsappLogo weight="fill" className="size-6" />
                </div>
                <button type="button" onClick={() => setWhatsappOpen(false)} aria-label="Close WhatsApp options" className="grid size-10 place-items-center rounded-full text-bone/55 transition-colors hover:bg-white/10 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="size-5">
                    <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <h2 id="whatsapp-dialog-title" className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">Stay updated on WhatsApp</h2>
              <p className="mt-2 font-body text-sm leading-relaxed text-bone/65">Join the updates group for the latest property announcements, project updates, and news from Prime Developer. Prefer a private conversation? You can chat directly with our team.</p>
              <div className="mt-6 grid gap-3">
                <a href={whatsappJoinHref} target="_blank" rel="noreferrer" onClick={() => setWhatsappOpen(false)} className="group flex min-h-12 items-center justify-between rounded-xl bg-[#25D366] px-4 font-body text-sm font-semibold text-white transition-transform duration-300 ease-brand hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none">
                  Join the updates group
                  <ArrowRight className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-1 motion-reduce:transform-none" />
                </a>
                <a href={whatsappChatHref} target="_blank" rel="noreferrer" onClick={() => setWhatsappOpen(false)} className="group flex min-h-12 items-center justify-between rounded-xl border border-bone/15 px-4 font-body text-sm font-semibold text-bone transition-colors duration-300 hover:border-bone/35 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  Chat with our team
                  <ArrowRight className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-1 motion-reduce:transform-none" />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
