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

// The Expertise tab's four doors, hung off its own nav link the same way
// `linksWithAcademy` hangs Learn off the admin's list below — structural
// routing, not admin copy, so it lives here rather than in the CMS. Keyed on
// `/enterprise` so it rides whatever the admin labels that link "Expertise"
// or anything else.
const EXPERTISE_LINK_TO = '/enterprise'
const EXPERTISE_SECTIONS = [
  { label: 'Interiors', to: '/enterprise/interiors' },
  { label: 'Franchise', to: '/enterprise/franchise' },
  { label: 'Collab', to: '/enterprise/collab' },
  { label: 'Invest', to: '/enterprise/invest' },
]

// The rail used to sit short on the homepage and widen as you scrolled, so it
// fitted inside the bay the old hero cut out of its photograph for it. That
// hero is gone — the new one is a full-bleed frame with nothing cut out of it —
// and with it the `COLLAPSED` fraction and the `--nav-bay` measurement that
// told the hero where to stop cutting. The header now runs the full measure on
// every route, which is what the design draws.

export default function Navbar() {
  const nav = useSection('navbar')
  const { links } = nav
  const contact = useSection('contact_page')
  const { isDark } = useTheme()
  const [active, setActive] = useState(null)
  const [overLight, setOverLight] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [expertiseOpen, setExpertiseOpen] = useState(false)
  const inBand = useRef(new Set())
  const expertiseRef = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const prefersReducedMotion = useReducedMotion()
  // Touch has no real :hover-leave, so the CSS-only submenu below has nothing
  // to tell it to close once a tap has triggered :hover. Devices without a
  // fine, always-on pointer get a JS-driven toggle instead; genuine mouse
  // users keep the zero-JS hover behaviour untouched.
  const [supportsHover] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true)
  )

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

  useEffect(() => {
    if (!expertiseOpen) return undefined
    const onPointerDown = (event) => {
      if (expertiseRef.current && !expertiseRef.current.contains(event.target)) setExpertiseOpen(false)
    }
    const onKeyDown = (event) => event.key === 'Escape' && setExpertiseOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [expertiseOpen])

  useEffect(() => setExpertiseOpen(false), [pathname])

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
    ? `${whatsappChatHref}${whatsappChatHref.includes('?') ? '&' : '?'}text=${encodeURIComponent(nav.whatsappMessage)}`
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
    link.to
      ? pathname === link.to || (link.to === EXPERTISE_LINK_TO && pathname.startsWith(`${EXPERTISE_LINK_TO}/`))
      : pathname === '/' && active === link.section

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

    // The strip the chrome is decided from: a 16px band just below the nav.
    // Shared by the observer's rootMargin and the direct measurement below, so
    // the two can never disagree about where it is.
    const STRIP_TOP = 40
    const STRIP_BOTTOM = 56

    const viewportHeight = () =>
      window.innerHeight || document.documentElement?.clientHeight || 800

    // Does this band cross the strip right now? The same question the observer
    // answers, asked directly off layout.
    const crossesStrip = (el) => {
      const r = el.getBoundingClientRect()
      return r.top < STRIP_BOTTOM && r.bottom > STRIP_TOP && r.width > 0
    }

    // Which bands are currently across the strip. Held out here rather than per
    // build so the observer's deltas and the direct measurement below agree on
    // one set instead of each keeping its own.
    let seen = new Set()

    // Reads layout and decides the chrome. Defaults to re-querying so the
    // deferred call below cannot act on a list that has since gone stale.
    const measure = (els) => {
      const bands = els ?? Array.from(document.querySelectorAll('[data-band="light"]'))
      seen = new Set(bands.filter(crossesStrip))
      setOverLight(seen.size > 0)
    }

    // `force` is for the resize path, where the bands are unchanged but the
    // rootMargin is derived from the viewport height and has to be recomputed.
    const build = (force = false) => {
      const els = Array.from(document.querySelectorAll('[data-band="light"]'))

      // Only the *observer* is skipped when the band set is unchanged. The
      // measurement below always runs, and that distinction is the whole point:
      // the first build fires before the page has laid out, when every band is
      // still a zero rect and nothing crosses anything. Every later mutation
      // then finds the same set of bands, so a guard that returned early here
      // would leave that first, wrong answer standing for the life of the page.
      // It is precisely why the home page kept a white navbar on a white hero
      // while the code-split routes — whose band set genuinely changes — came
      // out right.
      const rebuild = !observer || force || !same(els)
      if (rebuild) {
        if (observer) observer.disconnect()
        watched = els
        // The strip is expressed as "everything except the band between
        // STRIP_TOP and STRIP_BOTTOM from the top". The height is read
        // defensively: an unlaid-out or embedded viewport reports 0, and
        // `0 - 56` is negative, which the constructor rejects outright.
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) seen.add(e.target)
              else seen.delete(e.target)
            })
            setOverLight(seen.size > 0)
          },
          { rootMargin: `-${STRIP_TOP}px 0px -${Math.max(STRIP_BOTTOM, viewportHeight()) - STRIP_BOTTOM}px 0px` }
        )
        els.forEach((el) => observer.observe(el))
      }

      // Measured rather than waited for. The observer's first callback is
      // asynchronous, so until it lands the chrome would keep whatever the
      // previous page set — which on a route change is by definition the wrong
      // page. Reading layout here settles it in the same frame, and leaves the
      // observer to do the one thing it is good at: keeping it right while the
      // visitor scrolls.
      measure(els)

      // And once more after the frame has been laid out. A page that mounts all
      // of its markup at once produces no further mutations to rebuild on, so
      // if the first measurement lands before layout — a hero sized in dvh, a
      // web font still swapping, an image that has not reserved its box yet —
      // nothing would ever correct it. One deferred re-read closes that window
      // without polling, and it is the difference between the home page being
      // right on arrival and staying wrong until the visitor scrolls.
      requestAnimationFrame(() => measure())
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
    //
    // The pending frame is *kept*, not cancelled and re-booked. Cancelling on
    // every mutation starves the callback outright: during a route mount the
    // bursts arrive faster than one frame — React committing sections, images
    // resolving, GSAP inserting nodes — so each one pushes the rebuild a frame
    // further out and it never runs at all. That left the navbar on whatever
    // bands it happened to find first, which on a code-split route is nothing,
    // so it stayed dressed for a dark ground on a white page. The home page hid
    // it by settling quickly enough to land one frame of quiet.
    const host = document.querySelector('main')
    let queued = 0
    const rebuild = () => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        build()
      })
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
    ? 'border-charcoal/10 shadow-[0_8px_24px_-16px_rgba(32,32,32,0.65)] hover:shadow-[0_13px_28px_-15px_rgba(32,32,32,0.55)]'
    : 'border-white/60 shadow-[0_10px_28px_-16px_rgba(0,0,0,0.6)] hover:shadow-[0_15px_32px_-15px_rgba(0,0,0,0.5)]'
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
              {navLinks.map((link) => {
                const hasSubmenu = link.to === EXPERTISE_LINK_TO
                return (
                  <li
                    key={link.label}
                    ref={hasSubmenu ? expertiseRef : undefined}
                    className={hasSubmenu ? 'group/sub relative' : undefined}
                    // Visibility is driven entirely by `expertiseOpen`, not CSS
                    // :hover — a client-side route change doesn't move the
                    // pointer, so a still-hovered panel would otherwise have
                    // nothing telling it the selection was already made.
                    onMouseEnter={hasSubmenu && supportsHover ? () => setExpertiseOpen(true) : undefined}
                    onMouseLeave={hasSubmenu && supportsHover ? () => setExpertiseOpen(false) : undefined}
                    onFocus={hasSubmenu ? () => setExpertiseOpen(true) : undefined}
                    onBlur={
                      hasSubmenu
                        ? (e) => {
                            if (!e.currentTarget.contains(e.relatedTarget)) setExpertiseOpen(false)
                          }
                        : undefined
                    }
                  >
                    <a
                      href={link.to ?? `/#${link.section}`}
                      onClick={(e) => {
                        // A touch tap can't hover, so the first tap only opens
                        // the panel; a second tap (or a mouse click, which
                        // never sets this — the hover handler above already
                        // opened it) falls through to the normal navigate.
                        if (hasSubmenu && !supportsHover && !expertiseOpen) {
                          e.preventDefault()
                          setExpertiseOpen(true)
                          return
                        }
                        setExpertiseOpen(false)
                        handleNav(e, link)
                      }}
                      aria-current={isActive(link) ? 'page' : undefined}
                      aria-haspopup={hasSubmenu ? 'true' : undefined}
                      aria-expanded={hasSubmenu ? expertiseOpen : undefined}
                      onMouseEnter={(event) => animateNavLabel(event, true)}
                      onMouseLeave={(event) => animateNavLabel(event, false)}
                      onFocus={(event) => animateNavLabel(event, true)}
                      onBlur={(event) => animateNavLabel(event, false)}
                      className={`group relative flex items-center gap-1.5 rounded-sm py-2 font-body text-[15px] font-medium transition-colors duration-200 ease-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                        isActive(link) ? current : idle
                      }`}
                    >
                      <span aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 h-5 -translate-y-1/2 scale-x-75 rounded-full bg-accent/15 opacity-0 blur-md transition-[opacity,transform] duration-500 ease-brand group-hover:scale-x-110 group-hover:opacity-100 group-focus-visible:scale-x-110 group-focus-visible:opacity-100 motion-reduce:transition-opacity" />
                      <span data-nav-label className="relative block">
                        {link.label}
                      </span>
                      {hasSubmenu && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          aria-hidden
                          className={`relative size-3 shrink-0 transition-transform duration-300 ease-brand ${
                            expertiseOpen ? 'rotate-180' : ''
                          }`}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                        </svg>
                      )}
                      <span
                        aria-hidden
                        className={`absolute inset-x-0 bottom-0 h-px origin-left bg-current transition-[transform,opacity] duration-500 ease-brand motion-reduce:transition-none ${
                          isActive(link)
                            ? 'scale-x-100 opacity-100'
                            : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100 group-focus-visible:scale-x-100 group-focus-visible:opacity-100'
                        }`}
                      />
                    </a>

                    {hasSubmenu && (
                      // A gap-free hover bridge: the panel sits a few pixels
                      // below the link, and without padding standing in for
                      // that gap the pointer leaving the link's box on its way
                      // down closes the menu before it ever reaches it.
                      <div
                        className={`absolute left-1/2 top-full w-56 -translate-x-1/2 pt-3 transition-[opacity,transform] duration-200 ease-brand ${
                          expertiseOpen ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
                        }`}
                      >
                        <ul className="overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
                          {EXPERTISE_SECTIONS.map((section) => (
                            <li key={section.to}>
                              <a
                                href={section.to}
                                onClick={(e) => {
                                  setExpertiseOpen(false)
                                  handleNav(e, section)
                                }}
                                className="block rounded-xl px-4 py-2.5 font-body text-[14px] font-semibold text-content/70 transition-colors duration-150 hover:bg-accent/10 hover:text-accent"
                              >
                                {section.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                )
              })}
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
              className={`group relative isolate hidden min-h-12 shrink-0 items-center gap-5 overflow-hidden rounded-full border bg-white px-6 font-body text-[15px] font-semibold tracking-[-0.01em] text-charcoal transition-[color,transform,box-shadow] duration-300 ease-brand hover:-translate-y-px hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:translate-y-px active:scale-[0.985] motion-reduce:transform-none lg:inline-flex ${enquire}`}
            >
              <span aria-hidden className="absolute inset-0 z-0 origin-right scale-x-0 rounded-full bg-charcoal transition-transform duration-300 ease-brand group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none" />
              <span className="relative z-10 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transform-none">{nav.enquireLabel}</span>
              <span className="relative z-10 size-5 overflow-hidden" aria-hidden>
                <ArrowRight className="absolute inset-0 size-5 transition-transform duration-300 ease-brand group-hover:translate-x-6 group-focus-visible:translate-x-6 motion-reduce:transform-none" />
                <ArrowRight className="absolute inset-0 size-5 -translate-x-6 transition-transform duration-300 ease-brand group-hover:translate-x-0 group-focus-visible:translate-x-0 motion-reduce:hidden" />
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
              <div key={link.label}>
                <motion.a
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
                {link.to === EXPERTISE_LINK_TO && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 + 0.06, ease: 'easeOut' }}
                    className="ml-11 mt-1 flex flex-wrap gap-x-5 gap-y-1"
                  >
                    {EXPERTISE_SECTIONS.map((section) => (
                      <a
                        key={section.to}
                        href={section.to}
                        onClick={(e) => handleNav(e, section)}
                        className="min-h-11 py-1 font-body text-lg text-bone/55 transition-colors hover:text-bone"
                      >
                        {section.label}
                      </a>
                    ))}
                  </motion.div>
                )}
              </div>
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
              className="group relative isolate mt-8 inline-flex min-h-12 w-fit items-center gap-5 overflow-hidden rounded-full border border-white/60 bg-white px-6 font-body text-[15px] font-semibold tracking-[-0.01em] text-charcoal shadow-[0_10px_28px_-16px_rgba(0,0,0,0.6)] transition-[color,transform,box-shadow] duration-300 ease-brand hover:-translate-y-px hover:text-white hover:shadow-[0_15px_32px_-15px_rgba(0,0,0,0.5)] focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:translate-y-px active:scale-[0.985] motion-reduce:transform-none"
            >
              <span aria-hidden className="absolute inset-0 z-0 origin-right scale-x-0 rounded-full bg-charcoal transition-transform duration-300 ease-brand group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none" />
              <span className="relative z-10 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transform-none">{nav.enquireLabel}</span>
              <span className="relative z-10 size-5 overflow-hidden" aria-hidden>
                <ArrowRight className="absolute inset-0 size-5 transition-transform duration-300 ease-brand group-hover:translate-x-6 group-focus-visible:translate-x-6 motion-reduce:transform-none" />
                <ArrowRight className="absolute inset-0 size-5 -translate-x-6 transition-transform duration-300 ease-brand group-hover:translate-x-0 group-focus-visible:translate-x-0 motion-reduce:hidden" />
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
              <h2 id="whatsapp-dialog-title" className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">{nav.whatsappDialogHeading}</h2>
              <p className="mt-2 font-body text-sm leading-relaxed text-bone/65">{nav.whatsappDialogParagraph}</p>
              <div className="mt-6 grid gap-3">
                <a href={whatsappJoinHref} target="_blank" rel="noreferrer" onClick={() => setWhatsappOpen(false)} className="group flex min-h-12 items-center justify-between rounded-xl bg-[#25D366] px-4 font-body text-sm font-semibold text-white transition-transform duration-300 ease-brand hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none">
                  {nav.whatsappJoinLabel}
                  <ArrowRight className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-1 motion-reduce:transform-none" />
                </a>
                <a href={whatsappChatHref} target="_blank" rel="noreferrer" onClick={() => setWhatsappOpen(false)} className="group flex min-h-12 items-center justify-between rounded-xl border border-bone/15 px-4 font-body text-sm font-semibold text-bone transition-colors duration-300 hover:border-bone/35 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {nav.whatsappChatLabel}
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
