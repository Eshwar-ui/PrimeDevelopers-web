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
// ever received in one response. A hundred covers months of enquiries.
const PAGE_SIZE = 100

/**
 * One list of leads, paged: the inbox, or with `filtered` the submissions the
 * spam checks caught. `onChanged` runs after anything that moves the counts.
 */
function useLeadList({ filtered = false, enabled = true, onChanged } = {}) {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  // A full page came back, so there may be older leads to fetch.
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const scope = filtered ? '&filtered=true' : ''

  const reload = useCallback(async () => {
    try {
      const page = await api.get(`/admin/leads?limit=${PAGE_SIZE}${scope}`)
      setLeads(page)
      setHasMore(page.length >= PAGE_SIZE)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [scope])

  // The next page starts after the oldest lead held, named by its createdAt and
  // id together — not by its id alone, which found nothing once that lead was
  // deleted and quietly ended the list. De-duplicated by id all the same.
  const loadMore = useCallback(async () => {
    const oldest = leads?.at(-1)
    if (!oldest) return
    setLoadingMore(true)
    try {
      const cursor = `&before=${encodeURIComponent(oldest.createdAt)}&beforeId=${encodeURIComponent(oldest.id)}`
      const page = await api.get(`/admin/leads?limit=${PAGE_SIZE}${scope}${cursor}`)
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
  }, [leads, scope])

  useEffect(() => {
    if (enabled) reload()
  }, [enabled, reload])

  // Optimistic: the select already shows the new value, so waiting on the
  // round trip to repaint the card would read as the change not taking. A
  // failure reloads, putting the true value back.
  const setStatus = useCallback(
    async (id, status) => {
      setLeads((list) => list?.map((l) => (l.id === id ? { ...l, status } : l)) ?? list)
      try {
        await api.patch(`/admin/leads/${id}`, { status })
        onChanged?.()
      } catch (err) {
        setError(`Could not update that lead — ${err.message}`)
        reload()
      }
    },
    [reload, onChanged],
  )

  const remove = useCallback(
    async (id) => {
      try {
        await api.del(`/admin/leads/${id}`)
        setLeads((list) => list?.filter((l) => l.id !== id) ?? list)
        setError(null)
        onChanged?.()
      } catch (err) {
        setError(`Could not delete that lead — ${err.message}`)
      }
    },
    [onChanged],
  )

  // A filtered lead that is a real enquiry after all: into the inbox with it.
  const moveToInbox = useCallback(
    async (id) => {
      try {
        await api.patch(`/admin/leads/${id}`, { spam: false })
        setLeads((list) => list?.filter((l) => l.id !== id) ?? list)
        setError(null)
        onChanged?.()
      } catch (err) {
        setError(`Could not move that lead — ${err.message}`)
      }
    },
    [onChanged],
  )

  return useMemo(
    () => ({ leads, error, reload, setStatus, remove, moveToInbox, hasMore, loadMore, loadingMore }),
    [leads, error, reload, setStatus, remove, moveToInbox, hasMore, loadMore, loadingMore],
  )
}

/**
 * One copy of the inbox for the whole admin. The sidebar badge, the dashboard
 * and the Leads page all read it, so marking a lead read on one is reflected
 * on the others without a refetch each.
 *
 * The counts — the badge's "new", the Leads page's chips, how many were
 * filtered — come from the server's summary, not from the leads loaded so far,
 * which are only the newest page.
 */
export function LeadsProvider({ children }) {
  const [summary, setSummary] = useState(null)

  const reloadSummary = useCallback(async () => {
    try {
      setSummary(await api.get('/admin/leads/summary'))
    } catch {
      // Counting what is loaded instead is a fine fallback for a badge.
      setSummary(null)
    }
  }, [])

  const inbox = useLeadList({ onChanged: reloadSummary })
  const { reload: reloadInbox } = inbox

  useEffect(() => {
    reloadSummary()
  }, [reloadSummary])

  // After a filtered lead moves to the inbox, both the list and the counts.
  const refreshAll = useCallback(() => {
    reloadInbox()
    reloadSummary()
  }, [reloadInbox, reloadSummary])

  const value = useMemo(() => {
    const loadedNew = inbox.leads?.filter((l) => l.status === 'new').length ?? 0
    const newCount = summary?.byStatus?.new ?? loadedNew
    return { ...inbox, reload: refreshAll, newCount, summary, refreshAll }
  }, [inbox, summary, refreshAll])

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>
}

export function useLeads() {
  const ctx = useContext(LeadsContext)
  if (!ctx) throw new Error('useLeads must be used inside <LeadsProvider>')
  return ctx
}

/**
 * The submissions the spam checks filtered out, loaded only while `enabled`
 * (the Leads page's "Show filtered"). Moving one to the inbox refreshes the
 * inbox and the counts.
 */
export function useFilteredLeads(enabled) {
  const { refreshAll } = useLeads()
  return useLeadList({ filtered: true, enabled, onChanged: refreshAll })
}
