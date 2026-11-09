// Uploads every Reagan Crossing Drive photo into the two phase galleries.
// add-reagan-crossing-photos.mjs did the hero, OG image and first few
// gallery shots. This script adds the rest of the Drive folder: the 50
// marketing shots, the 13 loose shots, and the per-suite folders.
//
// Input: reagan-crossing-web-photos/, the Drive download
// (download-reagan-crossing-drive.sh) converted to WebP at 2400px long
// edge, q80. 201 files, about 46 MB. The folder is gitignored, like the
// download.
//
// Choosing a phase for each photo:
//   - Suite folders and loose suite shots follow the page pack's
//     unit-number rule, also used by the update-reagan-crossing-phase-*
//     scripts: 100s–700s are Phase I, 900s/1100s/1200s are Phase II. The
//     building numbers in frame agree with it: the 11180 shots show 15301,
//     Malabar 901 shows 15261, and the 15161 shots show "BLDG 4".
//   - Marketing shots are placed by what is in frame. Two-story
//     office-over-retail buildings, 153xx address numbers, and the monument
//     sign that lists Malabar and Vaping Apes (both Phase II by suite)
//     go to Phase II. The single-story NIVA and Best Brains / Brass Tap
//     buildings and their signs go to Phase I, as in
//     add-reagan-crossing-photos.mjs. Close-ups with nothing to identify
//     them default to Phase I. To move a photo, change its entry in
//     MARKETING_PHASE_2 below.
//   - Alt text uses the phase and suite number, never a tenant name. The
//     pack holds tenant names back until sign-off (SHOW_TENANT_NAMES).
//
// Resumable: each uploaded URL is saved to
// reagan-crossing-gallery-upload-progress.json as soon as it exists, and a
// re-run reuses those URLs instead of uploading again. Each phase is
// PATCHed once, after all of its uploads, with expectedUpdatedAt.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/upload-reagan-crossing-gallery.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/upload-reagan-crossing-gallery.mjs --commit
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const COMMIT = process.argv.includes('--commit')
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`
const PHOTO_DIR = process.env.PHOTO_DIR ?? 'reagan-crossing-web-photos'
const PROGRESS = 'reagan-crossing-gallery-upload-progress.json'

const SLUGS = { 1: 'reagan-crossing-phase-1', 2: 'reagan-crossing-phase-2' }
const PHASE_NAME = { 1: 'Reagan Crossing Phase I', 2: 'Reagan Crossing Phase II' }

// Already on the live pages from add-reagan-crossing-photos.mjs.
const ALREADY_UPLOADED = new Set(['RRC-169', 'RRC-37', 'RRC-87', 'RRC-13', 'RRC-21'])

// Marketing shots that go to Phase II. Every other marketing shot goes to Phase I.
const MARKETING_PHASE_2 = new Set([
  'RRC-2', // 15321 on the building
  'RRC-12', 'RRC-13', 'RRC-14', 'RRC-35', // two-story office over retail
  'RRC-21', 'RRC-26', 'RRC-27', 'RRC-30', 'RRC-34', // second-floor railings, same facade as 15301
  'RRC-51', 'RRC-52', 'RRC-6', 'RRC-7', // monument sign with Malabar / Vaping Apes
  'RRC-8', 'RRC-19', 'RRC-53', 'RRC-54', 'RRC-57', 'RRC-59', // tenants from that sign
  'RRC-60', 'RRC-61', 'RRC-70', 'RRC-82', 'RRC-83',
])

/** The suite number(s) in a folder or file name: "RRC-STE-412" → "412", "RRC-HoC-110-112-114" → "110-112-114". */
const suiteOf = (name) => name.match(/\d+/g)?.join('-') ?? null
/** Phase from the first suite number: below 900 is Phase I (100s–700s, plus "BLDG 4" at 15161). */
const phaseOfSuite = (suite) => {
  const n = Number(suite.split('-')[0])
  if (n === 15161) return 1
  if (n >= 15200) return 2 // 15261, 15301, 15321…
  return n < 900 ? 1 : 2
}

const photos = []
for (const folder of readdirSync(PHOTO_DIR).sort()) {
  for (const file of readdirSync(join(PHOTO_DIR, folder)).sort()) {
    if (!file.endsWith('.webp')) continue
    const base = file.replace(/\.webp$/, '')
    const rel = `${folder}/${file}`
    let phase, alt
    if (folder === 'Marketing-Shots-Units-without-Numbers') {
      phase = MARKETING_PHASE_2.has(base) ? 2 : 1
      alt = `${PHASE_NAME[phase]} retail and office buildings on Ronald Reagan Blvd, Leander TX`
    } else {
      // Suite folders name the suite; loose root shots name it in the file.
      // Srishti has no number in its folder name. It is Phase II's unit 1201 (the cap-rate list).
      const suite = folder === 'RRC-Srishti' ? '1201' : suiteOf(folder === 'root' ? base : folder)
      if (!suite) throw new Error(`No suite number in ${rel}. Add it to the mapping by hand.`)
      phase = phaseOfSuite(suite)
      alt = `${PHASE_NAME[phase]}, suite ${suite.replace(/-/g, ', ')} storefront, Leander TX`
    }
    if (ALREADY_UPLOADED.has(base) && folder === 'Marketing-Shots-Units-without-Numbers') continue
    photos.push({ rel, phase, alt })
  }
}

for (const p of [1, 2]) {
  const mine = photos.filter((x) => x.phase === p)
  console.log(`${SLUGS[p]}: ${mine.length} photos`)
  const byFolder = {}
  for (const x of mine) byFolder[x.rel.split('/')[0]] = (byFolder[x.rel.split('/')[0]] ?? 0) + 1
  console.log('  ' + Object.entries(byFolder).map(([f, n]) => `${f} (${n})`).join(', '))
}
console.log(`total: ${photos.length} (skipped ${ALREADY_UPLOADED.size} already live)\n`)

if (!COMMIT) {
  console.log('Dry run: nothing uploaded. Re-run with --commit.')
  process.exit(0)
}

const email = process.env.PRIME_ADMIN_EMAIL
const password = process.env.PRIME_ADMIN_PASSWORD
if (!email || !password) throw new Error('Set PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')

async function call(path, { token, ...init } = {}) {
  // The API rate-limits uploads (429 after ~100 in a row). Wait it out and
  // retry rather than stopping; the progress file covers a hard stop anyway.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    })
    const body = await res.text()
    if (res.status === 429 && attempt <= 10) {
      const wait = (Number(res.headers.get('retry-after')) || 30 * attempt) * 1000
      console.log(`  rate-limited on ${path}; waiting ${Math.round(wait / 1000)}s (attempt ${attempt}/10)`)
      await new Promise((r) => setTimeout(r, wait))
      continue
    }
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
    return body ? JSON.parse(body) : null
  }
}

const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})

const progress = existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf8')) : {}

for (const p of [1, 2]) {
  const slug = SLUGS[p]
  const property = await call(`/admin/properties/${slug}`, { token })
  if (!property) {
    console.log(`${slug}: not found, skipped.`)
    continue
  }
  const mine = photos.filter((x) => x.phase === p)
  const urls = []
  for (const [i, x] of mine.entries()) {
    if (!progress[x.rel]) {
      const form = new FormData()
      form.append('folder', `properties/${slug}/gallery`)
      form.append('file', new Blob([readFileSync(join(PHOTO_DIR, x.rel))], { type: 'image/webp' }), x.rel.split('/').pop())
      progress[x.rel] = (await call('/uploads/image', { token, method: 'POST', body: form })).url
      writeFileSync(PROGRESS, JSON.stringify(progress, null, 2))
    }
    urls.push(progress[x.rel])
    if ((i + 1) % 20 === 0) console.log(`  ${slug}: ${i + 1}/${mine.length} uploaded`)
  }

  const existing = property.gallery ?? []
  const fresh = mine.map((x, i) => ({ src: urls[i], alt: x.alt })).filter(({ src }) => !existing.includes(src))
  if (!fresh.length) {
    console.log(`${slug}: gallery already has every photo.\n`)
    continue
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(`${slug}-gallery-backup-${stamp}.json`, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))

  await call(`/admin/properties/${property.id}`, {
    token,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gallery: [...existing, ...fresh.map((f) => f.src)],
      detail: { ...property.detail, imageAlts: [...(property.detail?.imageAlts ?? []), ...fresh] },
      expectedUpdatedAt: property.updatedAt,
    }),
  })
  console.log(`${slug}: added ${fresh.length} photos to the gallery (${existing.length + fresh.length} total). Saved.\n`)
}
