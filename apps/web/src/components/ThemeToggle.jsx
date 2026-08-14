import { useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

/**
 * Sun and moon share the frame and trade places on a rotate-and-scale, so the
 * control reads as one object turning over rather than two icons swapping.
 */
export default function ThemeToggle({ className = '', tone = 'dark' }) {
  const { isDark, toggle } = useTheme()
  const ref = useRef(null)

  // The reveal circle grows from the button's centre, so the wipe has to start
  // where the user actually clicked rather than a fixed corner.
  const onClick = () => {
    const r = ref.current?.getBoundingClientRect()
    toggle(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined)
  }

  const ring =
    tone === 'light'
      ? 'text-bone/75 hover:text-bone hover:bg-white/10'
      : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`relative grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300 ${ring} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute size-5 transition-all duration-500 ${
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        }`}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>

      <svg
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute size-5 transition-all duration-500 ${
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        }`}
      >
        <path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  )
}
