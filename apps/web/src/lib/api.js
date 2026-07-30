/**
 * Client for the Prime Developers API (apps/api).
 *
 * Replaces direct Supabase table access from the browser. Storage reads still
 * go straight to Supabase — see lib/supabase.js — because public bucket URLs
 * need no credentials and routing image bytes through the API would only add a
 * hop.
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

let authToken = null

/** Set by AuthContext on login, cleared on logout. */
export function setAuthToken(token) {
  authToken = token
}

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (cause) {
    // fetch only rejects on network failure, never on an HTTP error status.
    // Distinguish the two so "API is down" doesn't read as "bad request".
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, cause)
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
