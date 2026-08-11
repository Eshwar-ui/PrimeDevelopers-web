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
// re-derives one from the refresh token. The refresh token is the thing worth
// persisting, and localStorage is the honest choice here: this is a static SPA
// with no server to set an httpOnly cookie, so pretending otherwise would just
// be theatre. Its blast radius is bounded by rotation — a stolen token works
// once, and using it locks out the legitimate holder, which surfaces the theft.

const REFRESH_KEY = 'pd.admin.refresh'

let accessToken = null
let refreshToken = localStorage.getItem(REFRESH_KEY)
let onAuthLost = null

/** AuthContext registers here so an expired session updates the UI. */
export function setAuthLostHandler(fn) {
  onAuthLost = fn
}

export function setTokens(tokens) {
  accessToken = tokens?.accessToken ?? null
  refreshToken = tokens?.refreshToken ?? null
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  else localStorage.removeItem(REFRESH_KEY)
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

async function refreshSession() {
  if (!refreshToken) return false
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!res.ok) throw new Error('refresh rejected')
        setTokens(await res.json())
        return true
      } catch {
        clearTokens()
        onAuthLost?.()
        return false
      } finally {
        refreshInFlight = null
      }
    })()
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
  // 401 would loop. FormData bodies can't be replayed reliably after being
  // consumed, so refresh first and let the caller retry those.
  if (res.status === 401 && !_retried && refreshToken && !(body instanceof FormData)) {
    if (await refreshSession()) {
      return apiFetch(path, { method, body, signal, _retried: true })
    }
  }

  if (res.status === 401 && accessToken) {
    clearTokens()
    onAuthLost?.()
  }

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

/** Ensures a valid access token before a request that can't be replayed. */
export async function ensureFreshSession() {
  if (!accessToken && refreshToken) await refreshSession()
}
