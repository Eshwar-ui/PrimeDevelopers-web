import { useCallback, useEffect, useRef } from 'react'

/**
 * How long a form has been on screen, sent with it as `fillMs`.
 *
 * A person takes seconds to type a name and an email; a script takes none, so
 * the API drops anything sent faster than a person could (MIN_FILL_MS in
 * apps/api's leads service). Started on mount, and `restart`ed when the same
 * form is shown again for another message.
 */
export function useFormClock() {
  const startedAt = useRef(0)
  useEffect(() => {
    startedAt.current = Date.now()
  }, [])
  const elapsed = useCallback(() => (startedAt.current ? Date.now() - startedAt.current : undefined), [])
  const restart = useCallback(() => {
    startedAt.current = Date.now()
  }, [])
  return { elapsed, restart }
}
