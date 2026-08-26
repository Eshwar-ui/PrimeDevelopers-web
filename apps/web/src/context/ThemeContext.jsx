import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'

const STORAGE_KEY = 'prime-theme'
const ThemeContext = createContext(null)

// Mirrors the inline boot script in index.html. That script runs before paint
// so the first frame is already the right colour; this is the same decision
// made again once React is up, and the two must not disagree.
//
// Dark is the default, and it does not consult prefers-color-scheme. The
// homepage is a dark composition — graded photography, near-black grounds, the
// approved design — and handing a visitor whose laptop happens to be in light
// mode a pale interpretation of it means the page the client signed off is the
// one most people never see. Light remains a real theme, reachable from the
// toggle and remembered once chosen; it is simply no longer the opening frame.
function preferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(preferredTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    // Keeps the browser's own chrome — address bar, form controls, scrollbars —
    // in step with the page instead of leaving a light strip above a dark site.
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      // Matches --color-base, the document ground, so the browser chrome sits on
      // the same colour the page actually starts with.
      theme === 'dark' ? '#0b1216' : '#ffffff'
    )
  }, [theme])

  // The OS listener that used to live here is gone with the OS default it
  // served. Watching prefers-color-scheme only made sense while the system was
  // choosing the opening theme; now that dark is the brand's own default, a
  // machine flipping at sunset has no business repainting the site.

  /**
   * `origin` is the toggle's centre in viewport pixels; the reveal circle grows
   * from there. Passing it as a percentage keeps the keyframe resolution-free.
   */
  const toggle = useCallback((origin) => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'

    const root = document.documentElement
    if (origin) {
      root.style.setProperty('--theme-x', `${(origin.x / window.innerWidth) * 100}%`)
      root.style.setProperty('--theme-y', `${(origin.y / window.innerHeight) * 100}%`)
    }

    localStorage.setItem(STORAGE_KEY, next)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // No View Transitions API (Safari, Firefox) — fall back to transitioning the
    // colour properties directly. The class is dropped afterwards so these
    // transitions never bleed into ordinary interaction.
    if (!document.startViewTransition || reduced) {
      if (!reduced) {
        root.classList.add('theme-fade')
        window.setTimeout(() => root.classList.remove('theme-fade'), 460)
      }
      setTheme(next)
      return
    }

    // flushSync is what makes this work: startViewTransition snapshots the DOM
    // as soon as its callback returns, and React's normal async update would
    // not have landed by then — the "after" frame would still be the old theme.
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        root.classList.toggle('dark', next === 'dark')
        setTheme(next)
      })
    })

    // Toggling again mid-reveal aborts the one in flight, and an aborted
    // transition *rejects* — which surfaces as an uncaught error even though
    // the interruption is the intended behaviour and the theme still lands.
    // Sinking it here keeps the console honest about real faults.
    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  }, [])

  const value = useMemo(() => ({ theme, isDark: theme === 'dark', toggle }), [theme, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
