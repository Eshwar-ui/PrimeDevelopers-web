import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearTokens, getRefreshToken, refreshBody, restoreSession, setAuthLostHandler, setTokens } from '../lib/api'

const AuthContext = createContext(null)

/**
 * Admin authentication against the API's JWT endpoints, replacing Supabase Auth.
 *
 * `session` keeps the same shape as the Supabase version — undefined while
 * resolving, null when signed out, an object when signed in — so RequireAuth
 * and LoginPage needed no changes.
 *
 * `restoreError` is set when a stored session could not be checked because the
 * API was unreachable. `session` stays undefined then: the admin is neither in
 * nor out, and `retry` asks again.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [restoreError, setRestoreError] = useState(null)

  // Trade the persisted refresh token for a live session. /auth/me is the
  // check that matters: it proves the token still resolves to a real admin,
  // rather than trusting that something in localStorage means anything. Only
  // the API rejecting it signs the admin out — a deploy in progress or a
  // dropped connection keeps the token, so trying again can still restore it.
  const restore = useCallback(() => {
    setRestoreError(null)
    restoreSession()
      .then((user) => setSession(user ? { user } : null))
      .catch(setRestoreError)
  }, [])

  useEffect(() => {
    // A refresh token the API later rejects — revoked, expired, or minted by a
    // different deployment — must not leave the UI believing it is signed in.
    setAuthLostHandler(() => setSession(null))
    restore()
  }, [restore])

  const signIn = useCallback(async (email, password) => {
    try {
      setTokens(await api.post('/auth/login', { email, password }))
      setSession({ user: await api.get('/auth/me') })
      setRestoreError(null)
      return { error: null }
    } catch (error) {
      clearTokens()
      setSession(null)
      return { error }
    }
  }, [])

  const signOut = useCallback(async () => {
    const token = getRefreshToken()
    // Clear locally first, so a failed network call can never leave the UI
    // looking signed in. The server-side revoke is best-effort after that.
    clearTokens()
    setSession(null)
    setRestoreError(null)
    if (token) {
      try {
        await api.post('/auth/logout', refreshBody(token))
      } catch {
        // Already revoked, or unreachable. The token is gone from this browser
        // regardless, and logout is idempotent server-side.
      }
    }
    return { error: null }
  }, [])

  const value = useMemo(
    () => ({
      session,
      loading: session === undefined && !restoreError,
      restoreError,
      retry: restore,
      signIn,
      signOut,
    }),
    [session, restoreError, restore, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
