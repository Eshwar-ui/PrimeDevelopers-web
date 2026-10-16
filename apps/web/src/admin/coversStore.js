import { useCallback } from 'react'
import { useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'

/**
 * Set (or clear) the photo one placement shows for one property.
 *
 * Written against a fresh copy of the property, and `detail` alone, for the
 * reason useSaveUnit gives: `detail` is replaced whole, and the copy this page
 * loaded may be older than a save made since in the property editor or Units.
 * `url` empty clears the choice, so the placement falls back to the main image.
 */
export function useSaveCover() {
  const refetch = useContentRefetch()
  return useCallback(
    async (property, placement, url) => {
      const fresh = await api.get(`/admin/properties/${encodeURIComponent(property.slug)}`)
      const covers = { ...(fresh.detail?.covers ?? {}) }
      if (url) covers[placement] = url
      else delete covers[placement]
      const saved = await api.patch(`/admin/properties/${fresh.id}`, { detail: { ...fresh.detail, covers } })
      await refetch()
      return saved
    },
    [refetch],
  )
}
