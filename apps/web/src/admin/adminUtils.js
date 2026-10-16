import { useEffect } from 'react'

// Non-component helpers shared across the admin. Kept out of the component
// files so Fast Refresh can keep hot-swapping those.

/** `${title} · Prime Admin` — every admin tab used to carry the homepage's title. */
export function useAdminTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} · Prime Admin`
  }, [title])
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const STEPS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/** "3 hours ago", "yesterday". Under a minute reads "just now". */
export function timeAgo(date) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

/**
 * Key-order-insensitive serialisation, for dirty checks. A value rebuilt from a
 * defaults object and the stored row can hold the same data in a different key
 * order, and plain `JSON.stringify` would call that a change.
 */
export const stable = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
