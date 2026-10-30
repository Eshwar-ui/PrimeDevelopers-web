// Set `detail.seo.latitude` / `.longitude` on one property.
//
// Those two fields are what turn on the `geo.position` meta tag
// (usePropertyHead.js:83) and the Place node's `geo` and `hasMap` in the
// JSON-LD (structuredData.js:156). Without them a property page ships no
// coordinates at all, and today none of the six carry any.
//
// A script rather than the admin because the property editor has no SEO
// fields — `detail.seo` is only ever written by these scripts. Re-running
// update-centro-content.mjs would set them, but it also re-uploads five
// photographs to S3, which is a lot of motion for two numbers.
//
// Same API path, backup and `expectedUpdatedAt` guard as the other scripts
// here. Everything else in `detail.seo` is carried through untouched.
//
// Get the coordinates from a geocoder, not a map click — the Census geocoder
// (geocoding.geo.census.gov) is free and authoritative for US street
// addresses. The dry run prints a Google Maps link: open it and confirm the
// pin lands on the property before committing.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/set-property-geo.mjs <slug> <lat> <lon>
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/set-property-geo.mjs <slug> <lat> <lon> --commit
import { writeFileSync } from 'node:fs'

const COMMIT = process.argv.includes('--commit')
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`
const [SLUG, RAW_LAT, RAW_LON] = process.argv.slice(2).filter((a) => !a.startsWith('--'))

if (!SLUG || RAW_LAT === undefined || RAW_LON === undefined) {
  throw new Error('Usage: node scripts/set-property-geo.mjs <slug> <latitude> <longitude> [--commit]')
}

// Stored as numbers, never strings. Both consumers gate on `Number.isFinite`,
// so a quoted "30.548629" is silently dropped from the page — no error, no
// tag, nothing to notice in a diff.
const latitude = Number(RAW_LAT)
const longitude = Number(RAW_LON)
if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) throw new Error(`Latitude out of range: ${RAW_LAT}`)
if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error(`Longitude out of range: ${RAW_LON}`)

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
const seo = property.detail?.seo ?? {}

console.log(`${SLUG} (updatedAt ${property.updatedAt})`)
console.log(`  address:   ${property.address ?? '(none)'}`)
console.log(`  latitude:  ${JSON.stringify(seo.latitude)} → ${latitude}`)
console.log(`  longitude: ${JSON.stringify(seo.longitude)} → ${longitude}`)
console.log(`\n  check the pin: https://www.google.com/maps?q=${latitude},${longitude}`)

if (!COMMIT) {
  console.log('\nDry run — nothing written. Re-run with --commit.')
  process.exit(0)
}

const backup = `${SLUG}-seo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), seo }, null, 2))
console.log(`backed up previous detail.seo to ${backup}`)

await call(`/admin/properties/${property.id}`, {
  token,
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    detail: { ...property.detail, seo: { ...seo, latitude, longitude } },
    expectedUpdatedAt: property.updatedAt,
  }),
})
console.log('Saved.')
