/**
 * Client for the Prime Developers API (apps/api).
 *
 * This is the browser's only data path. Nothing here talks to Supabase — the
 * anon key is gone from the app entirely. Image and model URLs still point at
 * Supabase's public buckets, but those are plain URLs in an <img>/loader and
 * need no credentials.
 */

const BASE = import.meta.env.VITE_API_BASE_URL

if (!BASE) {
  throw new Error(
    'Missing VITE_API_BASE_URL — copy .env.example to .env and point it at the API (http://localhost:3001 in development).',
  )
}

/** A non-2xx response. `status` lets callers distinguish 404 from 500. */
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/**
 * Nest returns `message` as a string for thrown exceptions but as an array of
 * strings for validation failures. Flatten both into something displayable.
 */
function messageFrom(body, status) {
  const raw = body?.message
  if (Array.isArray(raw)) return raw.join('. ')
  if (typeof raw === 'string') return raw
  return `Request failed (${status})`
}

// ── Tokens ────────────────────────────────────────────────────────────────
// The access token is short-lived and kept in memory only; a page reload
// re-derives one from the refresh token.
//
// Where the refresh token lives depends on the deployment:
//
// - Cookie mode (VITE_REFRESH_COOKIE=true — AWS, where the site and the API
//   share an origin): the API sets it as an HttpOnly, SameSite=Strict cookie
//   scoped to /api/auth and never puts it in a response body. This code never
//   sees it, so no injected script can steal it. All that is stored here is a
//   marker meaning "a session exists, try to restore it".
// - Otherwise (Render, cross-origin to the Firebase site, where a strict cookie
//   cannot be sent): the token itself, in localStorage, bounded by rotation — a
//   stolen token works once, and its use ends every session of that admin.

const COOKIE_MODE = import.meta.env.VITE_REFRESH_COOKIE === 'true'
const COOKIE_MARKER = 'cookie'
const REFRESH_KEY = 'pd.admin.refresh'

function readStored() {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

let accessToken = null
let accessExpiresAt = null
let refreshToken = readStored()
let onAuthLost = null

/** AuthContext registers here so an expired session updates the UI. */
export function setAuthLostHandler(fn) {
  onAuthLost = fn
}

/**
 * When the access token stops working, on this machine's clock, or null if it
 * can't be read.
 *
 * Measured as the token's lifetime (exp − iat) from the moment it arrived, not
 * from `exp` itself, so an office PC whose clock is ten minutes out still
 * refreshes on time. Tokens only ever come fresh off /auth/login or
 * /auth/refresh, so "arrived" and "issued" are the same instant.
 */
function expiryOf(token) {
  try {
    const { exp, iat } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof exp !== 'number') return null
    return typeof iat === 'number' ? Date.now() + (exp - iat) * 1000 : exp * 1000
  } catch {
    return null
  }
}

export function setTokens(tokens) {
  accessToken = tokens?.accessToken ?? null
  accessExpiresAt = accessToken ? expiryOf(accessToken) : null
  refreshToken = COOKIE_MODE ? (accessToken ? COOKIE_MARKER : null) : (tokens?.refreshToken ?? null)
  try {
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
    else localStorage.removeItem(REFRESH_KEY)
  } catch {
    /* storage unavailable: the session simply does not survive a reload */
  }
}

/** The body /auth/refresh and /auth/logout expect: empty in cookie mode. */
export function refreshBody(token = refreshToken) {
  return COOKIE_MODE ? {} : { refreshToken: token }
}

export function clearTokens() {
  setTokens(null)
}

export const getRefreshToken = () => refreshToken
export const hasSession = () => Boolean(accessToken || refreshToken)

// Concurrent 401s must not each fire their own refresh: the API rotates on
// every use, so the second would present an already-revoked token and log the
// admin out mid-session. They share one in-flight promise instead.
let refreshInFlight = null

/** The newest refresh token any tab has stored — another tab may have rotated it. */
const storedRefreshToken = readStored

/**
 * One refresh at a time across every open tab, where the browser supports it.
 *
 * The API treats a rotated-away token presented again as stolen and ends every
 * session for that admin. Two tabs refreshing in the same instant with the same
 * token would look exactly like that, so they queue on a shared lock, and each
 * re-reads the token inside it rather than trusting the copy it loaded at startup.
 */
function withRefreshLock(work) {
  return navigator.locks?.request ? navigator.locks.request('pd.admin.refresh', work) : work()
}

/** The session is over: forget it and send the UI to the login page. */
function endSession() {
  clearTokens()
  onAuthLost?.()
  return false
}

/**
 * Trades the refresh token for a new pair.
 *
 * Resolves true on success and false when the API refused the token, which ends
 * the session. Anything else — the network dropped, a 502/503 while a deploy
 * rolls over — says nothing about the token, so it rejects with an ApiError and
 * leaves the session alone. Treating those as a logout would unmount whatever
 * the editor was in the middle of, unsaved edits and all, over a blip.
 */
async function refreshSession() {
  if (!refreshToken && !storedRefreshToken()) return false
  if (!refreshInFlight) {
    refreshInFlight = withRefreshLock(async () => {
      try {
        refreshToken = storedRefreshToken() ?? refreshToken
        if (!refreshToken) return endSession()
        let res
        try {
          res = await fetch(`${BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Same-origin in cookie mode, so the browser attaches the cookie itself.
            credentials: 'same-origin',
            body: JSON.stringify(refreshBody()),
          })
        } catch (cause) {
          throw new ApiError('Could not reach the server. Check your connection and try again.', 0, cause)
        }
        if (res.status === 401 || res.status === 403) return endSession()
        const payload = await res.json().catch(() => null)
        if (!res.ok || !payload?.accessToken) {
          throw new ApiError(
            `Could not renew your session (${res.status}). Nothing was lost — try again in a moment.`,
            res.status,
            payload,
          )
        }
        setTokens(payload)
        return true
      } finally {
        refreshInFlight = null
      }
    })
  }
  return refreshInFlight
}

// ── Requests ──────────────────────────────────────────────────────────────

async function send(path, { method, body, signal }) {
  const isForm = body instanceof FormData
  return fetch(`${BASE}/api${path}`, {
    method,
    signal,
    headers: {
      // Let the browser set multipart's Content-Type — it has to append the
      // boundary, and setting it by hand produces an unparseable request.
      ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    ...(body !== undefined && { body: isForm ? body : JSON.stringify(body) }),
  })
}

/**
 * Claims a response the inline script in index.html started before this bundle
 * had finished downloading.
 *
 * Single-use by design: the entry is removed as soon as it is claimed, so a
 * later `refetch()` — after an admin publishes a change, say — goes to the
 * network rather than replaying the page-load snapshot.
 */
function claimPrefetched(path) {
  const store = typeof window !== 'undefined' && window.__PD_PREFETCH__
  if (!store) return null
  const pending = store[path]
  if (!pending) return null
  delete store[path]
  return pending
}

export async function apiFetch(path, { method = 'GET', body, signal, _retried } = {}) {
  // Anonymous GETs may already be in flight from the <head>. An authenticated
  // caller is deliberately excluded: the prefetch was sent without a bearer
  // token, so its response is the public view and would silently hide drafts.
  if (method === 'GET' && !accessToken && !_retried) {
    const pending = claimPrefetched(path)
    // A rejection here is not fatal — the prefetch is an optimisation, and
    // falling through re-requests the same thing the ordinary way.
    if (pending) {
      try {
        return await pending
      } catch {
        /* fall through to a normal request */
      }
    }
  }

  let res
  try {
    res = await send(path, { method, body, signal })
  } catch (cause) {
    // fetch only rejects on network failure, never on an HTTP error status.
    // Distinguish the two so "API is down" doesn't read as "bad request".
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, cause)
  }

  // One retry, and only when a refresh token exists — otherwise an anonymous
  // 401 would loop. FormData goes too: unlike a stream it is re-serialised on
  // every send, so the upload simply goes again. A refresh that fails for a
  // transient reason rejects here, with the session still intact.
  if (res.status === 401 && !_retried && refreshToken) {
    if (await refreshSession()) {
      return apiFetch(path, { method, body, signal, _retried: true })
    }
  }

  if (res.status === 401 && accessToken) endSession()

  if (res.status === 204) return null

  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(messageFrom(payload, res.status), res.status, payload)
  return payload
}

export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => apiFetch(path, { ...opts, method: 'PATCH', body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' }),
}

/** Refresh this long before the access token runs out, so it can't lapse in flight. */
const EXPIRY_MARGIN_MS = 60_000

/**
 * Ensures a live access token before a request too expensive to send twice — a
 * photo or a model upload. An editor who spends twenty minutes on descriptions
 * and then adds photos is holding a token that died five minutes ago (production
 * tokens last 15 minutes). Rejects with an ApiError if the server can't be
 * reached; the session is kept, so the editor can retry.
 */
export async function ensureFreshSession() {
  if (!refreshToken) return
  const stale = !accessToken || (accessExpiresAt !== null && accessExpiresAt - Date.now() < EXPIRY_MARGIN_MS)
  if (stale && !(await refreshSession())) {
    throw new ApiError('Your session has expired. Sign in again.', 401)
  }
}

/**
 * Turns a stored refresh token back into a signed-in admin on page load.
 *
 * Resolves to the user, or null when there is no session or the API says the
 * token is no good. Rejects, with the token kept, when the API couldn't be
 * asked — so trying again, or reloading once a deploy has finished, still works.
 */
export async function restoreSession() {
  if (!refreshToken) return null
  try {
    return await apiFetch('/auth/me')
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) {
      clearTokens()
      return null
    }
    throw err
  }
}
