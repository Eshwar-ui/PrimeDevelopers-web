import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearTokens, getRefreshToken, setAuthLostHandler, setTokens } from '../lib/api'

const AuthContext = createContext(null)

/**
 * Admin authentication against the API's JWT endpoints, replacing Supabase Auth.
 *
 * `session` keeps the same shape as the Supabase version — undefined while
 * resolving, null when signed out, an object when signed in — so RequireAuth
 * and LoginPage needed no changes.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // A refresh token the API later rejects — revoked, expired, or minted by a
    // different deployment — must not leave the UI believing it is signed in.
    setAuthLostHandler(() => setSession(null))

    if (!getRefreshToken()) {
      setSession(null)
      return
    }

    // Trade the persisted refresh token for a live session. /auth/me is the
    // check that matters: it proves the token still resolves to a real admin,
    // rather than trusting that something in localStorage means anything.
    api
      .get('/auth/me')
      .then((user) => setSession({ user }))
      .catch(() => {
        clearTokens()
        setSession(null)
      })
  }, [])

  const signIn = useCallback(async (email, password) => {
    try {
      setTokens(await api.post('/auth/login', { email, password }))
      setSession({ user: await api.get('/auth/me') })
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
    if (token) {
      try {
        await api.post('/auth/logout', { refreshToken: token })
      } catch {
        // Already revoked, or unreachable. The token is gone from this browser
        // regardless, and logout is idempotent server-side.
      }
    }
    return { error: null }
  }, [])

  const value = useMemo(
    () => ({ session, loading: session === undefined, signIn, signOut }),
    [session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
