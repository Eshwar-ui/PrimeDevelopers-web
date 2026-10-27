import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

// Mirrors LEAD_STATUSES in apps/api/src/modules/leads/dto. The admin used to
// offer only new ⇄ read, so three of the five statuses the API accepts could
// never be set.
export const LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
]

const LeadsContext = createContext(null)

// Newest first, a page at a time — the API no longer hands over every lead
// ever received in one response. A hundred covers months of enquiries, so the
// badge and the dashboard, which only care about recent ones, see them all.
const PAGE_SIZE = 100

/**
 * One copy of the leads list for the whole admin. The sidebar badge, the
 * dashboard and the Leads page all read it, so marking a lead read on one is
 * reflected on the others without a refetch each.
 */
export function LeadsProvider({ children }) {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  // A full page came back, so there may be older leads to fetch.
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const reload = useCallback(async () => {
    try {
      const page = await api.get(`/admin/leads?limit=${PAGE_SIZE}`)
      setLeads(page)
      setHasMore(page.length >= PAGE_SIZE)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  // The next page starts after the oldest lead held. De-duplicated by id, so
  // an API that ignores paging (an older deploy) can't double the list.
  const loadMore = useCallback(async () => {
    const oldest = leads?.at(-1)
    if (!oldest) return
    setLoadingMore(true)
    try {
      const page = await api.get(`/admin/leads?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest.id)}`)
      setLeads((list) => {
        const held = new Set((list ?? []).map((l) => l.id))
        return [...(list ?? []), ...page.filter((l) => !held.has(l.id))]
      })
      setHasMore(page.length >= PAGE_SIZE)
      setError(null)
    } catch (err) {
      setError(`Could not load older leads — ${err.message}`)
    } finally {
      setLoadingMore(false)
    }
  }, [leads])

  useEffect(() => {
    reload()
  }, [reload])

  // Optimistic: the select already shows the new value, so waiting on the
  // round trip to repaint the card would read as the change not taking. A
  // failure reloads, putting the true value back.
  const setStatus = useCallback(
    async (id, status) => {
      setLeads((list) => list?.map((l) => (l.id === id ? { ...l, status } : l)) ?? list)
      try {
        await api.patch(`/admin/leads/${id}`, { status })
      } catch (err) {
        setError(`Could not update that lead — ${err.message}`)
        reload()
      }
    },
    [reload],
  )

  const remove = useCallback(async (id) => {
    try {
      await api.del(`/admin/leads/${id}`)
      setLeads((list) => list?.filter((l) => l.id !== id) ?? list)
      setError(null)
    } catch (err) {
      setError(`Could not delete that lead — ${err.message}`)
    }
  }, [])

  const value = useMemo(() => {
    const newCount = leads?.filter((l) => l.status === 'new').length ?? 0
    return { leads, error, newCount, reload, setStatus, remove, hasMore, loadMore, loadingMore }
  }, [leads, error, reload, setStatus, remove, hasMore, loadMore, loadingMore])

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>
}

export function useLeads() {
  const ctx = useContext(LeadsContext)
  if (!ctx) throw new Error('useLeads must be used inside <LeadsProvider>')
  return ctx
}
