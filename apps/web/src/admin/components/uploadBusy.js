import { createContext, useContext, useEffect } from 'react'

/**
 * Lets an upload tell every list it sits inside that it is in flight.
 *
 * RepeatableList addresses rows by position, so a row removed or moved while
 * a photo uploads would shift the one the photo lands in — it would go into
 * the wrong unit, or the wrong building. Each list provides a `report(delta)`
 * here and passes it on to its own parent's, and blocks Remove and the arrows
 * while its count is above zero. Adding a row is still allowed: it appends,
 * so nothing shifts.
 */
export const UploadBusyContext = createContext(null)

/** Counts this component as busy in every enclosing list while `busy` is true. */
export function useReportBusy(busy) {
  const report = useContext(UploadBusyContext)
  useEffect(() => {
    if (!busy || !report) return undefined
    report(1)
    return () => report(-1)
  }, [busy, report])
}
