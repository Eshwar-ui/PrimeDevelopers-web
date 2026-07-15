import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { lenis } from '../hooks/useSmoothScroll'
import logo from '../assets/prime-logo.svg'

// `to` → a route; `section` → an anchor on the home page.
const links = [
  { label: 'About', to: '/about' },
  { label: 'Projects', to: '/projects' },
  { label: 'Contact', to: '/contact' },
]
const sections = ['about', 'projects']

export default function Navbar() {
  const [active, setActive] = useState(null)
  const [onDark, setOnDark] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const inBand = useRef(new Set())
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Route to a page, or smooth-scroll to a home-page section (navigating home
  // first when we're on another route).
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

  const isActive = (link) =>
    link.to ? pathname === link.to : pathname === '/' && active === link.section

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

  useEffect(() => {
    // Light chrome whenever the nav overlays a dark section (hero, testimonials,
    // footer); dark chrome over the light bone sections. Uses an Intersection
    // Observer with a thin band through the nav — reliable under Lenis, unlike
    // scroll events.
    const els = ['hero', 'about-hero', 'projects-hero', 'contact-hero', 'testimonials', 'contact']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
    const inBand = new Set()
    let observer

    const build = () => {
      if (observer) observer.disconnect()
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) inBand.add(e.target)
            else inBand.delete(e.target)
          })
          setOnDark(inBand.size > 0)
        },
        { rootMargin: `-40px 0px -${window.innerHeight - 56}px 0px` }
      )
      els.forEach((el) => observer.observe(el))
    }

    build()
    window.addEventListener('resize', build)
    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', build)
    }
  }, [pathname])

  // Over the hero photo → light chrome; over bone sections → ink chrome.
  const light = onDark && !menuOpen
  const chrome = light ? 'border-bone/70 bg-bone/10' : 'border-ink/15 bg-ink/[0.04]'
  const logoTone = light ? '' : 'opacity-90 brightness-0'

  return (
    <>
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-4 md:px-8 md:py-5"
      >
        <a
          href="/"
          onClick={goHome}
          className={`flex h-[46px] items-center justify-center rounded-full border px-5 backdrop-blur-md transition-colors duration-300 ${chrome}`}
        >
          <img
            src={logo}
            alt="Prime Developers"
            className={`h-5 w-auto transition-[filter,opacity] duration-300 md:h-6 ${logoTone}`}
          />
        </a>

        {/* Desktop links */}
        <nav
          className={`hidden rounded-full border p-2 backdrop-blur-md transition-colors duration-300 md:block ${chrome}`}
        >
          <ul className="flex items-center gap-1 px-1">
            {links.map((link) => {
              const activeLink = isActive(link)
              const inactive = light
                ? 'text-bone/90 hover:text-bone'
                : 'text-ink/70 hover:text-ink'
              return (
                <li key={link.label}>
                  <a
                    href={link.to ?? `/#${link.section}`}
                    onClick={(e) => handleNav(e, link)}
                    className={`group relative block rounded-full px-4 py-1 font-display text-[17px] font-medium transition-colors duration-300 ${
                      activeLink ? 'text-bone' : inactive
                    }`}
                  >
                    {activeLink && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 z-0 rounded-full bg-accent"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className={`flex size-[46px] items-center justify-center rounded-full border backdrop-blur-md transition-colors duration-300 md:hidden ${chrome}`}
        >
          <div className="relative h-3 w-5">
            <span
              className={`absolute left-0 h-0.5 w-5 rounded-full transition-all duration-300 ${
                light ? 'bg-bone' : 'bg-ink'
              } ${menuOpen ? 'top-1.5 rotate-45' : 'top-0'}`}
            />
            <span
              className={`absolute bottom-0 left-0 h-0.5 w-5 rounded-full transition-all duration-300 ${
                light ? 'bg-bone' : 'bg-ink'
              } ${menuOpen ? 'bottom-1.5 -rotate-45' : 'bottom-0'}`}
            />
          </div>
        </button>
      </motion.header>

      {/* Full-screen mobile overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex flex-col justify-center gap-2 bg-ink px-8 md:hidden"
          >
            {links.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.to ?? `/#${link.section}`}
                onClick={(e) => handleNav(e, link)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                className="font-display text-4xl font-light uppercase tracking-[0.02em] text-bone"
              >
                <span className="eyebrow mr-3 align-middle text-accent-soft">
                  0{i + 1}
                </span>
                {link.label}
              </motion.a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  )
}
