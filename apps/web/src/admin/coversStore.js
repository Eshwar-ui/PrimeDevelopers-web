import { useCallback } from 'react'
import { useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { withFreshRetry } from './unitsStore'

/**
 * Set (or clear) the photo one placement shows for one property.
 *
 * Written against a fresh copy of the property, and `detail` alone, for the
 * reason useSaveUnit gives: `detail` is replaced whole, and the copy this page
 * loaded may be older than a save made since in the property editor or Units.
 * The write carries that copy's `updatedAt`, and is re-applied to a newer one
 * if a save slipped in between (see withFreshRetry).
 * `url` empty clears the choice, so the placement falls back to the main image.
 */
export function useSaveCover() {
  const refetch = useContentRefetch()
  return useCallback(
    (property, placement, url) =>
      withFreshRetry(async () => {
        const fresh = await api.get(`/admin/properties/${encodeURIComponent(property.slug)}`)
        const covers = { ...(fresh.detail?.covers ?? {}) }
        if (url) covers[placement] = url
        else delete covers[placement]
        const saved = await api.patch(`/admin/properties/${fresh.id}`, {
          detail: { ...fresh.detail, covers },
          expectedUpdatedAt: fresh.updatedAt,
        })
        await refetch()
        return saved
      }),
    [refetch],
  )
}
