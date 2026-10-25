import { useCallback, useMemo } from 'react'
import { sectionDefaults, useContentRefetch, useSection } from '../context/ContentContext'
import { api } from '../lib/api'

/**
 * A content section with a stable identity — rebuilt only when its stored
 * contents change. `useSection` returns a fresh object on every call, and an
 * effect keyed on that loops (see capStore).
 */
export function useStableSection(key) {
  const section = useSection(key)
  const signature = JSON.stringify(section)
  return useMemo(() => section, [signature]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Change one content section and write it back, re-reading it first so a
 * save made since (another tab, another editor) isn't overwritten. The same
 * pattern as capStore, for any section with ContentContext defaults.
 * `mutate` receives the current section and returns the next one.
 */
export function useSaveSection(key) {
  const refetch = useContentRefetch()
  return useCallback(
    async (mutate) => {
      // The admin read: drafts included and never cached (see capStore).
      const all = await api.get('/admin/content')
      const current = { ...sectionDefaults(key), ...(all?.[key] ?? {}) }
      const next = mutate(current)
      await api.put(`/content/${key}`, { data: next })
      await refetch()
      return next
    },
    [key, refetch],
  )
}
