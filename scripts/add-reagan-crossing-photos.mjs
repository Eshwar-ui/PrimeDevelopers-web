// Adds photography to the two Reagan Crossing draft records, from the
// client's Drive folder (LCA Visual Studio shoot, "Marketing Shots & Units
// without Numbers"). Same login/PATCH pattern as update-centro-content.mjs.
//
// Pairing each photo to a phase, not guessed: the development's own signage
// in-frame tells them apart. RRC-169 and RRC-37/RRC-87 show NIVA Dental
// Specialists, Keds and Best Brains — all three named in the page pack's
// Phase I tenant list — on a single-story building. RRC-13 and RRC-21 show
// a two-story building with a "Shrishti" banner upstairs, matching the
// Phase II cap-rate tenant "Shrishti USA" (unit 1201) — Phase II is the
// office-over-retail phase. No photo here is claimed for a unit number; the
// pack explicitly withholds tenant names pending sign-off (SHOW_TENANT_NAMES
// in the other scripts), and nothing below writes a tenant to any unit.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/add-reagan-crossing-photos.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/add-reagan-crossing-photos.mjs --commit
//
// PHOTO_DIR holds the converted files (WebP gallery images, JPEG OG crops);
// defaults to the scratchpad folder this session prepared them in.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMIT = process.argv.includes('--commit')
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`
const PHOTO_DIR =
  process.env.PHOTO_DIR ??
  'C:/Users/Eshwar/AppData/Local/Temp/claude/469258884f1fa4a5/02315005-1a06-43ae-ab6a-2bdb10179a81/scratchpad/rrc-images/web'

const PHASES = [
  {
    slug: 'reagan-crossing-phase-1',
    folder: 'properties/reagan-crossing-phase-1',
    hero: { file: 'RRC-169.webp', alt: 'Reagan Crossing Phase I corner retail building with NIVA Dental Specialists signage, Ronald Reagan Blvd, Leander TX' },
    gallery: [
      { file: 'RRC-37.webp', alt: 'Reagan Crossing Phase I retail strip with Keds and MOVE Beauty Medspa storefronts' },
      { file: 'RRC-87.webp', alt: 'Reagan Crossing Phase I retail strip with The Brass Tap and Best Brains storefronts' },
    ],
    og: { file: 'reagan-crossing-phase-1-og.jpg', alt: 'Reagan Crossing Phase I, Leander TX' },
  },
  {
    slug: 'reagan-crossing-phase-2',
    folder: 'properties/reagan-crossing-phase-2',
    hero: { file: 'RRC-13.webp', alt: 'Reagan Crossing Phase II two-story office-over-retail building, Ronald Reagan Blvd, Leander TX' },
    gallery: [
      { file: 'RRC-21.webp', alt: 'Ground-floor retail for lease beneath second-floor offices at Reagan Crossing Phase II' },
    ],
    og: { file: 'reagan-crossing-phase-2-og.jpg', alt: 'Reagan Crossing Phase II, Leander TX' },
  },
]

for (const phase of PHASES) {
  for (const { file } of [phase.hero, ...phase.gallery, phase.og]) readFileSync(join(PHOTO_DIR, file)) // fail early
}

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

const uploadImage = async (token, folder, file) => {
  const form = new FormData()
  form.append('folder', folder)
  const type = file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  form.append('file', new Blob([readFileSync(join(PHOTO_DIR, file))], { type }), file)
  return (await call('/uploads/image', { token, method: 'POST', body: form })).url
}

const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})

for (const phase of PHASES) {
  const property = await call(`/admin/properties/${phase.slug}`, { token })
  if (!property) {
    console.log(`${phase.slug}: not found — skipped. Run create-reagan-crossing.mjs --commit first.`)
    continue
  }

  console.log(`${phase.slug} (updatedAt ${property.updatedAt})`)
  console.log(`  hero: ${phase.hero.file} → property.image + detail.covers.detailHero + detail.seo.heroAlt`)
  for (const g of phase.gallery) console.log(`  gallery: ${g.file} → property.gallery[]`)
  console.log(`  og: ${phase.og.file} → detail.seo.ogImage`)

  if (!COMMIT) {
    console.log(`  dry run — nothing uploaded. Re-run with --commit.\n`)
    continue
  }

  const heroUrl = await uploadImage(token, phase.folder, phase.hero.file)
  const galleryUrls = []
  for (const g of phase.gallery) galleryUrls.push(await uploadImage(token, phase.folder, g.file))
  const ogUrl = await uploadImage(token, `${phase.folder}/social`, phase.og.file)
  console.log(`  uploaded hero → ${heroUrl}`)
  galleryUrls.forEach((u, i) => console.log(`  uploaded gallery[${i}] → ${u}`))
  console.log(`  uploaded og → ${ogUrl}`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(`${phase.slug}-photos-backup-${stamp}.json`, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))

  const detail = {
    ...property.detail,
    covers: { ...property.detail?.covers, detailHero: heroUrl },
    seo: {
      ...property.detail?.seo,
      ogImage: ogUrl,
      ogImageAlt: phase.og.alt,
      heroAlt: phase.hero.alt,
    },
    // Written as values rather than by URL key, per lib/images.js's imageAlt()
    // convention — see update-centro-content.mjs.
    imageAlts: [
      ...(property.detail?.imageAlts ?? []),
      { src: heroUrl, alt: phase.hero.alt },
      ...phase.gallery.map((g, i) => ({ src: galleryUrls[i], alt: g.alt })),
    ],
  }

  await call(`/admin/properties/${property.id}`, {
    token,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: heroUrl,
      gallery: [...(property.gallery ?? []), ...galleryUrls],
      detail,
      expectedUpdatedAt: property.updatedAt,
    }),
  })
  console.log(`  saved.\n`)
}
