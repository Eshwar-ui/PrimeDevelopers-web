import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/properties', label: 'Properties' },
  { to: '/admin/news', label: 'News' },
  { to: '/admin/content', label: 'Site Content' },
  { to: '/admin/leads', label: 'Leads' },
]

// The sidebar becomes a drawer below Tailwind's `lg` (1024px). The breakpoint
// is chosen against the admin's own content rather than a device size: the
// Properties and Leads tables need the full width to stay legible, and a fixed
// 240px rail was taking half the viewport on a phone.
//
// It is spelled out literally at each use site below — Tailwind only generates
// classes it can find as complete strings in the source, so a `${BP}:flex`
// template would compile to nothing.

// Every focusable control is a link or a button, so this is enough to find the
// trap boundaries without pulling in a focus-trap dependency.
const FOCUSABLE = 'a[href], button:not([disabled])'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone'

/**
 * Rendered twice — once in the static desktop rail, once inside the drawer —
 * so the two can never drift apart. `onNavigate` is what the drawer uses to
 * close itself; the desktop rail passes nothing.
 */
function SidebarBody({ onLogout, onNavigate }) {
  return (
    <>
      <div>
        <p className="font-display text-lg font-medium">Prime Admin</p>
        <nav className="mt-10 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                // min-h-11 is the 44px touch-target floor; the old py-2 rows
                // came out at 36px.
                `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${focusRing} ${
                  isActive ? 'bg-white/10 text-bone' : 'text-bone/55 hover:bg-white/5 hover:text-bone'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex flex-col">
        {/* bone/55 rather than bone/40: at 12px these are normal-size text, so
            they need 4.5:1, and /40 measured 3.81:1 against --color-void. */}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className={`flex min-h-11 items-center text-xs font-bold uppercase tracking-wide text-bone/55 transition-colors hover:text-bone ${focusRing}`}
        >
          View site ↗
        </a>
        <button
          type="button"
          onClick={onLogout}
          className={`flex min-h-11 items-center text-xs font-bold uppercase tracking-wide text-bone/55 transition-colors hover:text-bone ${focusRing}`}
        >
          Log out
        </button>
      </div>
    </>
  )
}

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const panelRef = useRef(null)
  const toggleRef = useRef(null)
  const reduceMotion = useReducedMotion()

  const onLogout = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  // A drawer that survived navigation would cover the page the user just asked
  // for.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        return
      }
      if (e.key !== 'Tab') return

      // Keep Tab inside the drawer: with the overlay covering the page,
      // tabbing onto the content behind it would move focus somewhere the user
      // cannot see.
      const items = panelRef.current?.querySelectorAll(FOCUSABLE)
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    // Captured now rather than read in the cleanup: the toggle stays mounted
    // for the drawer's whole lifetime, and reading a ref after teardown is not
    // guaranteed to give the same node.
    const toggle = toggleRef.current

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      // Send focus back where it came from, so closing doesn't drop the
      // keyboard user at the top of the document.
      toggle?.focus()
    }
  }, [menuOpen])

  const duration = reduceMotion ? 0 : 0.25

  return (
    <div className="flex min-h-[100dvh] bg-void text-bone">
      <aside
        className="hidden w-60 shrink-0 flex-col justify-between border-r border-white/10 p-6 lg:flex"
      >
        <SidebarBody onLogout={onLogout} />
      </aside>

      {/* min-w-0 is what actually stops the overflow: a flex child defaults to
          min-width:auto, so wide admin tables were forcing the column past the
          viewport instead of scrolling inside it. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center gap-3 border-b border-white/10 px-4 py-3 lg:hidden"
        >
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="admin-nav-drawer"
            className={`flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/5 ${focusRing}`}
          >
            <span className="relative h-3 w-5">
              <span
                className={`absolute left-0 h-0.5 w-5 rounded-full bg-bone transition-all duration-300 ${
                  menuOpen ? 'top-1.5 rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-5 rounded-full bg-bone transition-all duration-300 ${
                  menuOpen ? 'bottom-1.5 -rotate-45' : 'bottom-0'
                }`}
              />
            </span>
          </button>
          <p className="font-display text-lg font-medium">Prime Admin</p>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-void/80 lg:hidden"
            />
            <motion.div
              id="admin-nav-drawer"
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration, ease: 'easeOut' }}
              className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between border-r border-white/10 bg-void p-6 focus:outline-none lg:hidden`}
            >
              <SidebarBody onLogout={onLogout} onNavigate={() => setMenuOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
