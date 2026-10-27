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
 * `next` as given, or — when it is an updater function — applied to `prev`.
 *
 * Every `onChange` in the admin's editors may be handed either, the way
 * React's setState is. An updater is what makes a late change safe: a photo
 * upload resolves seconds after the file was picked, and a plain value built
 * then (`{ ...unit, images }`) carries that moment's copy of everything else,
 * so it quietly undid whatever was typed — or uploaded — in the meantime. An
 * updater is applied to the state as it is when it lands instead.
 */
export const resolveNext = (next, prev) => (typeof next === 'function' ? next(prev) : next)

/**
 * A `patch({ key: value })` partial applied to `prev`, where any value may be
 * an updater for that key — so `patch({ gallery })` works whether `gallery`
 * is a list or a function of the current list.
 */
export const mergeFields = (prev, partial) => {
  const base = prev ?? {}
  const next = { ...base }
  for (const [key, value] of Object.entries(resolveNext(partial, base) ?? {})) next[key] = resolveNext(value, base[key])
  return next
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
