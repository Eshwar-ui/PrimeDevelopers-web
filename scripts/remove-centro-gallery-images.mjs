// Drop three photographs from the Centro Plaza page gallery: the unit 103
// shoot (LcaVisualStudios-4/5/6), portrait frames of blank wall above the
// storefront that the page showed as gallery frames 24–26.
//
// Gallery only. Unit 101+102+103+106's own images still list -4 and -6 — that
// card is unit inventory and is left alone. Same API path, backup and
// `expectedUpdatedAt` guard as update-centro-content.mjs.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/remove-centro-gallery-images.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/remove-centro-gallery-images.mjs --commit
import { writeFileSync } from 'node:fs'

const COMMIT = process.argv.includes('--commit')
const SLUG = 'centro-plaza'
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`
const REMOVE = [4, 5, 6].map((n) => `/drive/units/cen-103/LcaVisualStudios-${n}.jpg`)

const email = process.env.PRIME_ADMIN_EMAIL
const password = process.env.PRIME_ADMIN_PASSWORD
if (!email || !password) throw new Error('Set PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')

async function call(path, { token, ...init } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const property = await call(`/admin/properties/${SLUG}`, { token })

const gallery = property.gallery ?? []
const kept = gallery.filter((src) => !REMOVE.some((end) => src.split('?')[0].endsWith(end)))
console.log(`${SLUG} (updatedAt ${property.updatedAt}): ${gallery.length} → ${kept.length} gallery images`)
for (const src of gallery) if (!kept.includes(src)) console.log(`  remove ${src}`)

if (gallery.length - kept.length !== REMOVE.length) {
  throw new Error(`Expected to remove ${REMOVE.length}, found ${gallery.length - kept.length} — nothing written`)
}
if (!COMMIT) {
  console.log('\nDry run — nothing written. Re-run with --commit.')
  process.exit(0)
}

const backup = `centro-plaza-gallery-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), gallery }, null, 2))
console.log(`backed up previous gallery to ${backup}`)

await call(`/admin/properties/${property.id}`, {
  token,
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ gallery: kept, expectedUpdatedAt: property.updatedAt }),
})
console.log('Saved.')
