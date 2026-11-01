// node --test. Covers the admin session in lib/api.js against a fake API —
// nothing here touches the network.
//
// lib/api.js reads Vite's import.meta.env, which Node doesn't have, so each
// test loads its own copy of the source with the env filled in. A fresh copy
// is also a fresh page load: the module keeps its tokens in module state.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const BASE = 'http://api.test'
const MINUTE = 60_000
const ACCESS_TTL = 15 * MINUTE
const USER = { id: 'admin-1', email: 'editor@example.test' }
const PHOTO = 'https://bucket.example.test/properties/photo.jpg'

const source = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
let copies = 0

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (claims) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.signature`

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function photoForm() {
  const form = new FormData()
  form.append('file', new Blob(['jpeg bytes'], { type: 'image/jpeg' }), 'photo.jpg')
  form.append('folder', 'properties')
  return form
}

/** Date.now under the test's control, so "twenty minutes later" takes no time. */
function mockClock(t) {
  const clock = { now: Date.parse('2026-11-01T09:00:00Z'), advance: (ms) => (clock.now += ms) }
  t.mock.method(Date, 'now', () => clock.now)
  return clock
}

/**
 * A page load: a fresh copy of lib/api.js over a fresh localStorage, holding
 * `stored` as if an earlier visit had signed in.
 */
async function loadApi({ cookie = false, stored = null } = {}) {
  const items = new Map(stored ? [['pd.admin.refresh', stored]] : [])
  const storage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })

  const env = JSON.stringify({ VITE_API_BASE_URL: BASE, VITE_REFRESH_COOKIE: String(cookie) })
  const code = `${source.replaceAll('import.meta.env', `(${env})`)}\n// copy ${++copies}\n`
  const api = await import(`data:text/javascript,${encodeURIComponent(code)}`)

  const page = { api, authLost: 0, stored: () => items.get('pd.admin.refresh') ?? null }
  api.setAuthLostHandler(() => page.authLost++)
  return page
}

/**
 * The API, reduced to what the session cares about: it rotates the refresh
 * token on every use, accepts only the newest access token, and lets that one
 * lapse after 15 minutes. `refreshReply` overrides /auth/refresh for the
 * failure cases.
 */
function fakeApi(t, clock, { cookie = false, clockSkew = 0 } = {}) {
  const server = { access: null, accessUntil: 0, refresh: null, issued: 0, calls: [], refreshReply: null }

  server.issue = () => {
    server.issued++
    // The API's own clock, which may disagree with the browser's.
    const iat = Math.floor((clock.now + clockSkew) / 1000)
    server.access = jwt({ sub: USER.id, n: server.issued, iat, exp: iat + ACCESS_TTL / 1000 })
    server.accessUntil = clock.now + ACCESS_TTL
    server.refresh = `refresh-${server.issued}`
    return cookie ? { accessToken: server.access } : { accessToken: server.access, refreshToken: server.refresh }
  }
  server.routes = () => server.calls.map((c) => c.route)

  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const route = `${init.method ?? 'GET'} ${new URL(url).pathname}`
    server.calls.push({ route, init })

    if (route === 'POST /api/auth/refresh') {
      if (server.refreshReply) return server.refreshReply()
      // In cookie mode the token rides in the HttpOnly cookie, which the fake
      // can't see; in token mode a rotated-away token is refused.
      const presented = JSON.parse(init.body).refreshToken
      if (!cookie && presented !== server.refresh) return json(401, { message: 'Invalid or expired refresh token' })
      return json(200, server.issue())
    }

    const bearer = init.headers?.Authorization
    if (bearer !== `Bearer ${server.access}` || clock.now >= server.accessUntil) {
      return json(401, { message: 'Unauthorized' })
    }
    if (route === 'GET /api/auth/me') return json(200, USER)
    if (route === 'POST /api/uploads/image') return json(201, { url: PHOTO })
    if (route === 'PATCH /api/admin/properties/centro-plaza') return json(200, { slug: 'centro-plaza' })
    return json(404, { message: 'Not found' })
  })

  return server
}

/** An admin who has just signed in, as AuthContext.signIn leaves them. */
async function signedIn(t, opts = {}) {
  const clock = mockClock(t)
  const server = fakeApi(t, clock, opts)
  const page = await loadApi(opts)
  page.api.setTokens(server.issue())
  return { clock, server, page, api: page.api }
}

/** Uploads a photo the way lib/uploads.js does. */
async function uploadPhoto(api) {
  await api.ensureFreshSession()
  return api.apiFetch('/uploads/image', { method: 'POST', body: photoForm() })
}

/* ── An upload after the editor has been idle ───────────────────────── */

test('an upload after the access token lapses refreshes first and sends the file once', async (t) => {
  const { clock, server, page, api } = await signedIn(t)
  clock.advance(20 * MINUTE) // typing descriptions

  assert.deepEqual(await uploadPhoto(api), { url: PHOTO })
  assert.deepEqual(server.routes(), ['POST /api/auth/refresh', 'POST /api/uploads/image'])
  assert.equal(server.calls[1].init.headers.Authorization, `Bearer ${server.access}`)
  assert.equal(page.authLost, 0)
  assert.equal(api.hasSession(), true)
})

test('a token within a minute of running out is refreshed before an upload too', async (t) => {
  const { clock, server, api } = await signedIn(t)
  clock.advance(ACCESS_TTL - 30_000)

  await uploadPhoto(api)
  assert.deepEqual(server.routes(), ['POST /api/auth/refresh', 'POST /api/uploads/image'])
})

test('a live token goes straight to the upload, with no refresh', async (t) => {
  const { clock, server, api } = await signedIn(t)
  clock.advance(5 * MINUTE)

  await uploadPhoto(api)
  assert.deepEqual(server.routes(), ['POST /api/uploads/image'])
})

test('expiry is measured from when the token arrived, so a wrong PC clock does not matter', async (t) => {
  // The API's clock is 10 minutes behind the browser's: read naively, `exp`
  // would say this brand-new token has five minutes left.
  const { clock, server, api } = await signedIn(t, { clockSkew: -10 * MINUTE })
  clock.advance(6 * MINUTE)

  await uploadPhoto(api)
  assert.deepEqual(server.routes(), ['POST /api/uploads/image'])
})

test('an upload refused with 401 is refreshed and sent again with the same FormData', async (t) => {
  const { server, page, api } = await signedIn(t)
  // The token looks fine here but the API has stopped taking it.
  server.access = 'revoked'

  const body = photoForm()
  assert.deepEqual(await api.apiFetch('/uploads/image', { method: 'POST', body }), { url: PHOTO })
  assert.deepEqual(server.routes(), ['POST /api/uploads/image', 'POST /api/auth/refresh', 'POST /api/uploads/image'])
  assert.equal(server.calls[2].init.body, body)
  assert.equal(server.calls[2].init.headers.Authorization, `Bearer ${server.access}`)
  assert.equal(page.authLost, 0)
})

test('an upload is retried once only — a second 401 still ends the session', async (t) => {
  const { server, page, api } = await signedIn(t)
  // Every token is refused, however new.
  const issue = server.issue
  server.issue = () => {
    const pair = issue()
    server.access = 'never'
    return pair
  }
  server.access = 'never'

  await assert.rejects(api.apiFetch('/uploads/image', { method: 'POST', body: photoForm() }), { status: 401 })
  assert.deepEqual(server.routes(), ['POST /api/uploads/image', 'POST /api/auth/refresh', 'POST /api/uploads/image'])
  assert.equal(page.authLost, 1)
  assert.equal(api.hasSession(), false)
})

/* ── A refresh that fails without the API refusing the token ────────── */

test('a dropped connection during refresh keeps the session, and the next save works', async (t) => {
  const { clock, server, page, api } = await signedIn(t)
  const token = api.getRefreshToken()
  clock.advance(20 * MINUTE)
  server.refreshReply = () => {
    throw new TypeError('Failed to fetch')
  }

  const save = () => api.api.patch('/admin/properties/centro-plaza', { name: 'Centro Plaza' })
  await assert.rejects(save(), { name: 'ApiError', status: 0 })
  assert.equal(page.authLost, 0)
  assert.equal(api.hasSession(), true)
  assert.equal(api.getRefreshToken(), token)
  assert.equal(page.stored(), token)

  // The connection comes back; the same session carries on.
  server.refreshReply = null
  assert.deepEqual(await save(), { slug: 'centro-plaza' })
  assert.equal(page.authLost, 0)
})

for (const status of [502, 503, 429]) {
  test(`a ${status} from refresh keeps the session and surfaces an error before the upload`, async (t) => {
    const { clock, server, page, api } = await signedIn(t)
    clock.advance(20 * MINUTE)
    server.refreshReply = () => json(status, { message: 'Service Unavailable' })

    await assert.rejects(uploadPhoto(api), (err) => {
      assert.equal(err.name, 'ApiError')
      assert.equal(err.status, status)
      assert.match(err.message, /Nothing was lost/)
      return true
    })
    // No file was sent on a token known to be dead.
    assert.deepEqual(server.routes(), ['POST /api/auth/refresh'])
    assert.equal(page.authLost, 0)
    assert.equal(api.hasSession(), true)
    assert.equal(page.stored(), server.refresh)
  })
}

for (const status of [401, 403]) {
  test(`a ${status} from refresh ends the session`, async (t) => {
    const { clock, server, page, api } = await signedIn(t)
    clock.advance(20 * MINUTE)
    server.refreshReply = () => json(status, { message: 'Invalid or expired refresh token' })

    await assert.rejects(uploadPhoto(api), { name: 'ApiError', status: 401 })
    assert.deepEqual(server.routes(), ['POST /api/auth/refresh'])
    assert.equal(page.authLost, 1)
    assert.equal(api.hasSession(), false)
    assert.equal(page.stored(), null)
  })
}

test('concurrent 401s still share a single refresh', async (t) => {
  const { clock, server, page, api } = await signedIn(t)
  clock.advance(20 * MINUTE)

  const saves = [1, 2, 3].map(() => api.api.patch('/admin/properties/centro-plaza', { name: 'Centro Plaza' }))
  await Promise.all(saves)
  assert.equal(server.routes().filter((r) => r === 'POST /api/auth/refresh').length, 1)
  assert.equal(page.authLost, 0)
})

/* ── Restoring the session on page load ─────────────────────────────── */

test('on page load, an unreachable API keeps the stored token so a retry can restore it', async (t) => {
  const clock = mockClock(t)
  const server = fakeApi(t, clock)
  server.issue() // an earlier visit signed in and left refresh-1 behind
  const { api, stored } = await loadApi({ stored: server.refresh })
  server.refreshReply = () => json(503, { message: 'Service Unavailable' })

  await assert.rejects(api.restoreSession(), { name: 'ApiError', status: 503 })
  assert.equal(stored(), 'refresh-1')
  assert.equal(api.getRefreshToken(), 'refresh-1')

  server.refreshReply = null
  assert.deepEqual(await api.restoreSession(), USER)
})

test('on page load, a refused token signs the admin out', async (t) => {
  const clock = mockClock(t)
  const server = fakeApi(t, clock)
  server.issue()
  const page = await loadApi({ stored: 'refresh-from-another-deployment' })

  assert.equal(await page.api.restoreSession(), null)
  assert.equal(page.stored(), null)
  assert.equal(page.api.hasSession(), false)
})

test('cookie mode: refresh sends no token, and a failed refresh keeps the marker', async (t) => {
  const clock = mockClock(t)
  const server = fakeApi(t, clock, { cookie: true })
  const { api, stored } = await loadApi({ cookie: true, stored: 'cookie' })
  server.refreshReply = () => {
    throw new TypeError('Failed to fetch')
  }

  await assert.rejects(api.restoreSession(), { name: 'ApiError', status: 0 })
  assert.equal(stored(), 'cookie')

  server.refreshReply = null
  assert.deepEqual(await api.restoreSession(), USER)
  const refresh = server.calls.find((c) => c.route === 'POST /api/auth/refresh').init
  assert.equal(refresh.body, '{}')
  assert.equal(refresh.credentials, 'same-origin')
  assert.equal(stored(), 'cookie')
})
