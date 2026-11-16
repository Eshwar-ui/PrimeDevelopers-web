#!/usr/bin/env node
// List every property link the CMS holds that is not an absolute https: URL:
// the overview flyer and each resource link. Read-only: it uses the public
// GET /api/properties, the same data visitors see.
//
//   node scripts/scan-resource-links.mjs [--site https://dtw8rs0oq8bpp.cloudfront.net]
//
// A placeholder such as "#" in the flyer field once stopped brochure emails
// entirely (audit task 1). The API now skips bad values, but they still show
// as dead links on the page, so fix them in the admin: Properties → <name> →
// Overview (flyer) or Resources. Exits 1 when it finds any, so it can gate a check.
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const SITE = arg('site', 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')

const isHttps = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

const res = await fetch(`${SITE}/api/properties`)
if (!res.ok) throw new Error(`GET ${SITE}/api/properties → ${res.status}`)
const body = await res.json()
const properties = Array.isArray(body) ? body : (body?.data ?? [])

const bad = []
for (const p of properties) {
  const d = p.detail ?? {}
  const flyer = d.overview?.flyer
  if (flyer !== undefined && flyer !== null && flyer !== '' && !isHttps(flyer)) {
    bad.push({ property: p.slug, field: 'Overview → flyer', label: '', value: flyer })
  }
  for (const link of Array.isArray(d.resourceLinks) ? d.resourceLinks : []) {
    if (!isHttps(link?.url)) bad.push({ property: p.slug, field: 'Resources', label: link?.label ?? '', value: link?.url ?? '(empty)' })
  }
}

console.log(`${properties.length} properties scanned on ${SITE}`)
if (bad.length === 0) {
  console.log('Every flyer and resource link is an absolute https: URL.')
  process.exit(0)
}
console.log(`${bad.length} link(s) to fix in the admin:\n`)
for (const b of bad) console.log(`  ${b.property.padEnd(28)} ${b.field.padEnd(18)} ${b.label ? `"${b.label}" ` : ''}${JSON.stringify(b.value)}`)
process.exit(1)
