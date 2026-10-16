import { useEffect, useState } from 'react'
import { useSection } from '../context/ContentContext'

/**
 * The CAP / NNN deals, for a component on the main bundle that only sometimes
 * needs them — the homepage carousel, when a card advertises a deal.
 *
 * Once the admin has saved the CAP section, the deals are in `/content`
 * already. Before that they are the shipped set in data/capListings.js, which
 * is loaded on demand here rather than imported, so seventeen deals' figures
 * don't ride along on every visit for a card that may not exist.
 */
export function useCapItemsLazy(needed) {
  const stored = useSection('cap_listings')
  const hasStored = Array.isArray(stored.items)
  const [shipped, setShipped] = useState(null)

  useEffect(() => {
    if (!needed || hasStored || shipped) return
    let live = true
    import('../data/capListings').then((m) => live && setShipped(m.CAP_LISTINGS_DEFAULTS.items))
    return () => {
      live = false
    }
  }, [needed, hasStored, shipped])

  return hasStored ? stored.items : shipped ?? []
}
