// Sets the order properties are listed in (Property.sortOrder, ascending — the
// /properties default and everywhere else the list is shown). Later phases sit
// right after their first phase; the listing folds them into one card anyway.
// Anything not named here keeps its place after the named ones.
//
//   node scripts/set-property-order.mjs            (dry run: prints current → new)
//   node scripts/set-property-order.mjs --commit   (saves; needs PRIME_ADMIN_EMAIL / PRIME_ADMIN_PASSWORD)
const ORDER = [
  'centro-plaza',
  'reagan-crossing',
  'reagan-crossing-phase-2',
  'pow-leander',
  'pow-lewisville',
  'pow-lewisville-phase-ii',
  'spur-plaza',
  'rio-ranch-1-acre-lots',
  'rio-ranch-commercial-lots',
  'cap-rate-projects', // not in the requested order — kept last
]

const COMMIT = process.argv.includes('--commit')
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`

async function call(path, { token, ...init } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

const email = process.env.PRIME_ADMIN_EMAIL
const password = process.env.PRIME_ADMIN_PASSWORD
if (!email || !password) throw new Error('Set PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')
const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})

for (const [i, slug] of ORDER.entries()) {
  const sortOrder = (i + 1) * 10
  const p = await call(`/admin/properties/${slug}`, { token }).catch((e) => (/→ 404/.test(e.message) ? null : Promise.reject(e)))
  if (!p) {
    console.log(`  ${slug}: not found — skipped`)
    continue
  }
  if (p.sortOrder === sortOrder) {
    console.log(`  ${slug}: ${sortOrder} (unchanged)`)
    continue
  }
  console.log(`  ${slug}: ${p.sortOrder} → ${sortOrder}`)
  if (COMMIT) {
    await call(`/admin/properties/${p.id}`, {
      token,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sortOrder, expectedUpdatedAt: p.updatedAt }),
    })
  }
}
console.log(COMMIT ? '\nSaved.' : '\nDry run — nothing saved. Re-run with --commit.')
