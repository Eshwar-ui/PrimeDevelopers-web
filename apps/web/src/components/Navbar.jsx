import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { lenis } from '../hooks/useSmoothScroll'
import { useSection } from '../context/ContentContext'
import { useTheme } from '../context/ThemeContext'
import ArrowRight from './ArrowRight'
import ThemeToggle from './ThemeToggle'
import logoOnDark from '../assets/prime-logo.svg'
import logoOnLight from '../assets/prime-logo-dark.svg'

// Homepage section ids tracked for the scroll-spy active-link highlight —
// structural, tied to actual DOM ids on the homepage, not admin-editable.
const sections = ['about', 'properties']

// Fraction of its bounds the rail occupies at rest, before scrolling widens it
// to the full measure. Also fixes where the hero's notch ends, so the two stay
// in step by construction rather than by measurement.
const COLLAPSED = 0.7

export default function Navbar() {
  const { links } = useSection('navbar')
  const { isDark } = useTheme()
  const [active, setActive] = useState(null)
  const [overLight, setOverLight] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const inBand = useRef(new Set())
  const boundsRef = useRef(null)
  const railRef = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Only the homepage hero cuts a bay for the rail to sit in; everywhere else
  // the header runs the full measure.
  const isHome = pathname === '/'

  // The lockup doubles as the Home link, so the rail only needs an explicit
  // Home entry when the admin-managed list doesn't already carry one.
  const navLinks = links.some((l) => l.to === '/') ? links : [{ label: 'Home', to: '/' }, ...links]

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

  // The rail spans COLLAPSED of its bounds at rest and widens to the full
  // bounds across the first half-screen of scrolling. Written straight to the
  // node rather than held in state — this runs on every scroll frame, and a
  // re-render per frame is not worth a number nothing else reads.
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const update = () => {
      // Past the top the hero's white bay is gone from under the rail, so the
      // header stops being a transparent overlay and carries its own surface.
      // Boolean, so this only re-renders on the flip, not every frame.
      setScrolled(window.scrollY > 16)
      // The collapse exists to sit inside the homepage hero's notch. Every
      // other hero is a plain band with nothing cut out of it, so holding the
      // rail short there just pulls the CTA in off the measure and leaves the
      // header narrower than the page it sits on.
      //
      // Also skipped on mobile, where the bar is a logo and a burger and has
      // nothing to gain from the expansion.
      if (!isHome || window.innerWidth < 768) {
        el.style.width = '100%'
        return
      }
      const distance = window.innerHeight * 0.5
      const progress = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 1
      el.style.width = `${(COLLAPSED + (1 - COLLAPSED) * progress) * 100}%`
    }
    update()
    // Lenis scrolls the window for real, so the native event is authoritative
    // and there's no need to wait on the instance existing.
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [pathname, isHome])

  // The hero cuts a white bay from its visual so this rail reads on white, and
  // it has to clear the CTA. Derived from the bounds rather than measured off
  // the button, which now slides right as the rail expands — the bay must stay
  // put. Justified layout means the CTA's resting edge is the bounds' edge, so
  // the CMS-driven label widths no longer enter into it.
  useEffect(() => {
    const measure = () => {
      const el = boundsRef.current
      if (!el) return
      const { left, width } = el.getBoundingClientRect()
      const restingEdge = left + width * COLLAPSED
      document.documentElement.style.setProperty('--nav-bay', `${Math.round(restingEdge + 20)}px`)
    }
    measure()
    const id = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', measure)
    }
  }, [])

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
    ? 'bg-charcoal text-white hover:bg-[#1b1b1b]'
    : 'bg-white text-charcoal hover:bg-bone-deep'
  const enquireDot = onLight ? 'bg-white text-charcoal' : 'bg-charcoal text-white'
  const burger = onLight ? 'bg-charcoal' : 'bg-bone'

  // At rest the header is a bare overlay reading on the hero's white bay. Once
  // that bay has scrolled away the links would otherwise sit on whatever the
  // page happens to be showing — imagery, the caption card, the carousel
  // controls — so the bar takes a surface of its own, tinted to the band it is
  // over. Suppressed while the mobile menu is open, which paints its own ground.
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
          {/* Bounds are fixed; the rail inside them is what grows. Measuring
              the wrapper rather than the rail gives the notch a reference that
              doesn't move as the rail expands. */}
          <div ref={boundsRef}>
            <div
              ref={railRef}
              // Matches what the effect below will write, so an interior page
              // never paints one frame of a short rail before widening it.
              style={{ width: isHome ? `${COLLAPSED * 100}%` : '100%' }}
              className="flex items-center justify-between gap-6"
            >
          <a href="/" onClick={goHome} className="shrink-0" aria-label="Prime Developer — home">
            <img
              src={logo}
              alt="Prime Developer"
              className={`w-auto transition-[height,opacity] duration-500 ${
                surfaced ? 'h-8 md:h-10' : 'h-9 md:h-12'
              }`}
            />
          </a>

          {/* Desktop rail */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-7 lg:gap-9">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.to ?? `/#${link.section}`}
                    onClick={(e) => handleNav(e, link)}
                    aria-current={isActive(link) ? 'page' : undefined}
                    className={`block font-body text-[15px] font-medium transition-colors duration-300 ${
                      isActive(link) ? current : idle
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <ThemeToggle tone={onLight ? 'dark' : 'light'} />

            <a
              href="/contact"
              onClick={goContact}
              className={`group hidden shrink-0 items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 transition-colors duration-500 md:inline-flex ${enquire}`}
            >
              <span className="font-body text-[15px] font-medium">Enquire</span>
              <span
                className={`flex size-9 items-center justify-center rounded-full transition-colors duration-500 ${enquireDot}`}
              >
                <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
              </span>
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex size-11 items-center justify-center md:hidden"
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
            className="fixed inset-0 z-40 flex flex-col justify-center gap-3 bg-void px-8 md:hidden"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.to ?? `/#${link.section}`}
                onClick={(e) => handleNav(e, link)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                className="font-display text-5xl font-light tracking-[-0.02em] text-bone"
              >
                <span className="numeral mr-4 align-middle text-base text-accent-soft">
                  0{i + 1}
                </span>
                {link.label}
              </motion.a>
            ))}
            <motion.a
              href="/contact"
              onClick={goContact}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + navLinks.length * 0.08, ease: 'easeOut' }}
              className="mt-8 inline-flex w-fit items-center gap-3 rounded-full bg-white py-1.5 pl-6 pr-1.5 text-charcoal"
            >
              <span className="font-body text-[15px] font-medium">Enquire</span>
              <span className="flex size-9 items-center justify-center rounded-full bg-charcoal text-white">
                <ArrowRight className="size-4" />
              </span>
            </motion.a>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  )
}
