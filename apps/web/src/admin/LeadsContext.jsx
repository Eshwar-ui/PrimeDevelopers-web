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

/**
 * One copy of the leads list for the whole admin. The sidebar badge, the
 * dashboard and the Leads page all read it, so marking a lead read on one is
 * reflected on the others without a refetch each.
 */
export function LeadsProvider({ children }) {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      setLeads(await api.get('/admin/leads'))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

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
    return { leads, error, newCount, reload, setStatus, remove }
  }, [leads, error, reload, setStatus, remove])

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>
}

export function useLeads() {
  const ctx = useContext(LeadsContext)
  if (!ctx) throw new Error('useLeads must be used inside <LeadsProvider>')
  return ctx
}
