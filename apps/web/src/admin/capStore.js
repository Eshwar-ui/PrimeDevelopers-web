import { useCallback, useMemo } from 'react'
import { useContentRefetch, useSection } from '../context/ContentContext'
import { api } from '../lib/api'
import { CAP_LISTINGS_DEFAULTS } from '../data/capListings'

const SECTION = 'cap_listings'

/**
 * The section as the admin sees it: what is stored, over the shipped set.
 *
 * Memoised on the stored row's contents. `useSection` builds a fresh object on
 * every call, so without this the section's identity changed every render —
 * and the settings page, which re-seeds its form when the section changes,
 * re-rendered itself in a loop until React gave up.
 */
export function useCapSection() {
  const stored = useSection(SECTION)
  const key = JSON.stringify(stored)
  return useMemo(() => ({ ...CAP_LISTINGS_DEFAULTS, ...stored }), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Whether the section has ever been saved. ContentContext carries no default
 * for it (the shipped set lives in data/capListings.js), so an unsaved section
 * comes back as an empty object.
 */
export function useCapSectionStored() {
  return Object.keys(useSection(SECTION)).length > 0
}

/**
 * Change the section and write it back — re-reading it first.
 *
 * The API replaces a content section whole, and every listing lives in this
 * one row. Saving the copy this page loaded would overwrite anything another
 * tab (or the same editor, on another listing) saved since — so each save
 * fetches the row fresh, applies its one change to that, and writes the
 * result. The query string is there to step past any shared cache: the
 * endpoint is cacheable for a minute, which is right for visitors and wrong
 * for a read that is about to be written back.
 *
 * `mutate` receives the current section and returns the next one.
 */
export function useSaveCapSection() {
  const refetch = useContentRefetch()
  return useCallback(
    async (mutate) => {
      const all = await api.get(`/content?fresh=${Date.now()}`)
      const current = { ...CAP_LISTINGS_DEFAULTS, ...(all?.[SECTION] ?? {}) }
      const next = mutate(current)
      await api.put(`/content/${SECTION}`, { data: next })
      await refetch()
      return next
    },
    [refetch],
  )
}
