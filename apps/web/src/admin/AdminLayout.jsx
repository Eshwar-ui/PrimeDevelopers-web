import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ArrowSquareOut, Buildings, CurrencyCircleDollar, Images, Newspaper, SignOut, SquaresFour, Storefront, TextAa, Tray } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { LeadsProvider, useLeads } from './LeadsContext'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: SquaresFour, end: true },
  { to: '/admin/properties', label: 'Properties', icon: Buildings },
  { to: '/admin/units', label: 'Units', icon: Storefront },
  { to: '/admin/covers', label: 'Cover images', icon: Images },
  { to: '/admin/cap', label: 'CAP / NNN', icon: CurrencyCircleDollar },
  { to: '/admin/news', label: 'News', icon: Newspaper },
  { to: '/admin/content', label: 'Site content', icon: TextAa },
  { to: '/admin/leads', label: 'Leads', icon: Tray, badge: 'newLeads' },
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

const footLink = `flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-xs font-bold uppercase tracking-wide text-bone-3 transition-colors hover:bg-white/5 hover:text-bone ${focusRing}`

/**
 * Rendered twice — once in the static desktop rail, once inside the drawer —
 * so the two can never drift apart. `onNavigate` is what the drawer uses to
 * close itself; the desktop rail passes nothing.
 */
function SidebarBody({ onLogout, onNavigate }) {
  const { session } = useAuth()
  const { newCount } = useLeads()
  const badges = { newLeads: newCount }

  return (
    <>
      <div>
        <p className="px-3 font-display text-lg font-medium">Prime Admin</p>
        <nav aria-label="Admin" className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const count = item.badge ? badges[item.badge] : 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  // min-h-11 is the 44px touch-target floor; the old py-2 rows
                  // came out at 36px.
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${focusRing} ${
                    isActive ? 'bg-white/10 text-bone' : 'text-bone-2 hover:bg-white/5 hover:text-bone'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon weight={isActive ? 'fill' : 'regular'} className="size-5 shrink-0" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-ember px-2 py-0.5 text-[11px] font-bold leading-none text-void">
                        <span aria-hidden>{count}</span>
                        <span className="sr-only">, {count} new</span>
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col border-t border-white/10 pt-4">
        {session?.user?.email && (
          <p className="truncate px-3 pb-2 text-xs text-bone-3" title={session.user.email}>
            Signed in as <span className="text-bone-2">{session.user.name || session.user.email}</span>
          </p>
        )}
        {/* bone-3 rather than bone/40: at 12px these are normal-size text, so
            they need 4.5:1, and /40 measured 3.81:1 against --color-void. */}
        <a href="/" target="_blank" rel="noreferrer" className={footLink}>
          <ArrowSquareOut weight="bold" className="size-4" aria-hidden />
          View site
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <button type="button" onClick={onLogout} className={`${footLink} cursor-pointer`}>
          <SignOut weight="bold" className="size-4" aria-hidden />
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

  // <main> is the scroll container, so the browser's own reset-to-top on
  // navigation doesn't reach it: without this, opening a property from the
  // foot of the list lands halfway down its editor.
  useEffect(() => {
    document.getElementById('admin-main')?.scrollTo(0, 0)
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
    <LeadsProvider>
    {/* A fixed-viewport shell: <main> is the scroll container, not the window.
        It already carried overflow-y-auto, but with no bounded height it never
        scrolled — the document did — so the editors' sticky bars, which stick
        to their nearest scrolling ancestor, had nothing to stick to, and Log
        out sat at the foot of a sidebar as long as the page. */}
    <div className="flex h-[100dvh] overflow-hidden bg-void font-body text-bone">
      <aside
        className="hidden w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-white/10 px-3 py-6 lg:flex"
      >
        <SidebarBody onLogout={onLogout} />
      </aside>

      {/* min-w-0 is what actually stops the overflow: a flex child defaults to
          min-width:auto, so wide admin tables were forcing the column past the
          viewport instead of scrolling inside it. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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

        <main id="admin-main" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
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
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between overflow-y-auto border-r border-white/10 bg-void px-3 py-6 focus:outline-none lg:hidden"
            >
              <SidebarBody onLogout={onLogout} onNavigate={() => setMenuOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </LeadsProvider>
  )
}
