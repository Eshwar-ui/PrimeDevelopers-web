import { useEffect, useState } from 'react'

/**
 * Tracks a media query, so layout state lives on the same breakpoint the CSS
 * uses rather than on a measured box the two could disagree about.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    // Re-read on mount as well as on change: between first render and this
    // effect the viewport may already have been resized past the breakpoint.
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * The index of the first query in `queries` that currently matches, or -1.
 *
 * A tier table is a list of queries, and `useMediaQuery` cannot be mapped over
 * one — a hook per entry means the hook count changes with the table's length,
 * which is exactly what the rules of hooks forbid. This subscribes to the whole
 * list in one effect instead, so a table can grow a tier without the component
 * changing shape.
 *
 * Order matters: the queries are expected to overlap (a 1400px viewport matches
 * both a 1280 and a 768 floor), so the caller lists them narrowest-last and
 * takes the first hit.
 */
export function useFirstMatchingQuery(queries) {
  // The array identity changes on every render when it is built inline; its
  // contents do not. Keying the effect on the joined text is what stops this
  // resubscribing sixty times a second.
  const key = queries.join('|')
  const [index, setIndex] = useState(() =>
    typeof window === 'undefined' ? -1 : queries.findIndex((q) => window.matchMedia(q).matches)
  )

  useEffect(() => {
    const lists = key.split('|').map((q) => window.matchMedia(q))
    const onChange = () => setIndex(lists.findIndex((list) => list.matches))
    onChange()
    lists.forEach((list) => list.addEventListener('change', onChange))
    return () => lists.forEach((list) => list.removeEventListener('change', onChange))
  }, [key])

  return index
}
