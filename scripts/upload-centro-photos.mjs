// One-off: upload the client's September 2026 Centro Plaza photography to
// production storage and attach it to the CMS.
//
// Source: the client's Drive folder "Centro plaza" (LCA Visual Studio), which
// is laid out as Buildings/<subject>/ and Units/<unit code>/. Two subjects came
// through in that drop:
//
//   Buildings/Centro Plaza Name boards/  → the monument sign at 14300, which is
//     a photograph of the plaza rather than of any one block. Buildings in this
//     CMS carry only a floor-plan image and a model poster, neither of which a
//     signage photograph is, so it belongs in the property gallery.
//   Units/CEN-908/                       → four storefront elevations of a
//     single flex unit. "CEN-908" is Centro Plaza unit 908, which lives in
//     Building 9 — array index 7 of detail.floorPlans.buildings.
//
// The originals are 6.5–8.9MB Lightroom exports at up to 4000x6000. They are
// resized to 2560px on the long edge and stripped of EXIF before upload:
// UploadsService caps an image at 5MB, so shipping the originals would put
// files in the bucket that the admin panel itself would have refused, and the
// camera/GPS metadata has no business on a public bucket.
//
//   node --env-file=.env.seed scripts/upload-centro-photos.mjs
//   node --env-file=.env.seed scripts/upload-centro-photos.mjs --commit
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const COMMIT = process.argv.includes('--commit')
const SLUG = 'centro-plaza'
const BUCKET = 'images'
const BUILDING_INDEX = 7 // Building 9
const UNIT_LABEL = '908'

// Prepared by the session that ran this; see the header for the recipe.
const SRC = process.env.PHOTO_DIR ?? ''

const GALLERY = [{ file: 'nameboard-6.jpg', note: 'CENTRO PLAZA monument sign at 14300' }]
const UNIT_PHOTOS = [
  { file: 'cen908-82.jpg', note: 'storefront, straight on' },
  { file: 'cen908-83.jpg', note: 'storefront, wider' },
  { file: 'cen908-84.jpg', note: 'storefront with neighbouring bay' },
  { file: 'cen908-85.jpg', note: 'three-quarter, corner' },
]

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
if (!SRC) throw new Error('Set PHOTO_DIR to the directory holding the prepared JPEGs')

const supabase = createClient(url, key, { auth: { persistSession: false } })

/**
 * Upload one prepared JPEG and hand back its public URL.
 *
 * Idempotent on byte length. The first run of this script uploaded all five
 * files and then lost the CMS write to a network-level failure, which left
 * storage ahead of the database; a naive retry would have written five more
 * objects under fresh UUIDs and orphaned the first five. Names are UUIDs, so
 * size is the only handle on "this file is already up there" — good enough
 * here, where the five sources differ by tens of kilobytes.
 */
async function put(file, folder) {
  const body = readFileSync(`${SRC}/${file}`)
  if (body.byteLength > 5 * 1024 * 1024) {
    throw new Error(`${file} is ${body.byteLength} bytes — over the 5MB image ceiling`)
  }
  const publicUrl = (p) => supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl

  const { data: listed, error: listErr } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 })
  if (listErr) throw new Error(`list ${folder}: ${listErr.message}`)
  const already = (listed ?? []).find((o) => o.metadata?.size === body.byteLength)
  if (already) {
    return { path: `${folder}/${already.name}`, url: publicUrl(`${folder}/${already.name}`), bytes: body.byteLength, reused: true }
  }

  const path = `${folder}/${randomUUID()}.jpg`
  if (!COMMIT) return { path, url: `(dry run) ${path}`, bytes: body.byteLength, reused: false }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
  if (error) throw new Error(`upload ${path}: ${error.message}`)
  return { path, url: publicUrl(path), bytes: body.byteLength, reused: false }
}

const { data: property, error: readErr } = await supabase
  .from('properties')
  .select('id, slug, gallery, detail')
  .eq('slug', SLUG)
  .single()
if (readErr) throw readErr

// The building index is positional and the array has been reordered before —
// B-09's floor plan still sits in a `building-4` storage folder from an earlier
// ordering. Assert on the label rather than trusting the index.
const buildings = [...(property.detail?.floorPlans?.buildings ?? [])]
const building = buildings[BUILDING_INDEX]
if (!building) throw new Error(`No building at index ${BUILDING_INDEX}`)
const units = [...(building.unitList ?? [])]
const unitIndex = units.findIndex((u) => String(u?.label).trim() === UNIT_LABEL)
if (unitIndex < 0) throw new Error(`No unit "${UNIT_LABEL}" in ${building.building}`)

const existing = (units[unitIndex].images ?? []).filter(Boolean)

console.log(`${property.slug}: ${building.building}, unit ${units[unitIndex].label} (index ${unitIndex})`)
console.log(`gallery: ${(property.gallery ?? []).length} existing\n`)

const galleryUrls = []
for (const { file, note } of GALLERY) {
  const r = await put(file, `projects/${SLUG}/gallery`)
  galleryUrls.push(r.url)
  console.log(`gallery   ${file.padEnd(16)} ${String(Math.round(r.bytes / 1024)).padStart(4)}KB  ${r.reused ? 'reused' : 'new   '}  ${note}`)
}

const unitUrls = []
for (const { file, note } of UNIT_PHOTOS) {
  const r = await put(file, `projects/${SLUG}/building-${BUILDING_INDEX}/unit-photos`)
  unitUrls.push(r.url)
  console.log(`unit ${UNIT_LABEL}  ${file.padEnd(16)} ${String(Math.round(r.bytes / 1024)).padStart(4)}KB  ${r.reused ? 'reused' : 'new   '}  ${note}`)
}

if (!COMMIT) {
  console.log('\nDry run — nothing uploaded and nothing written. Re-run with --commit.')
  process.exit(0)
}

// Re-running must not stack duplicates. put() already resolves each file to
// the object it uploaded the first time, so the URLs are stable and the only
// question is whether the CMS is holding a different set.
const sameUnitPhotos =
  existing.length === unitUrls.length && existing.every((u, i) => u === unitUrls[i])
if (existing.length && !sameUnitPhotos) {
  throw new Error(
    `Unit ${UNIT_LABEL} already holds ${existing.length} different photograph(s). ` +
      'Refusing to overwrite — clear them in the admin first, or edit this script.',
  )
}

units[unitIndex] = { ...units[unitIndex], images: unitUrls }
buildings[BUILDING_INDEX] = { ...building, unitList: units }

// The client's photography leads the gallery rather than trailing 17 older
// frames, so the new frames go to the front — and a URL already in the list is
// moved there rather than added a second time.
const gallery = [
  ...galleryUrls,
  ...(property.gallery ?? []).filter((u) => !galleryUrls.includes(u)),
]

const patch = {
  gallery,
  detail: { ...property.detail, floorPlans: { ...property.detail.floorPlans, buildings } },
}

let writeErr = null
for (let attempt = 1; attempt <= 3; attempt++) {
  const { error } = await supabase.from('properties').update(patch).eq('id', property.id)
  if (!error) { writeErr = null; break }
  writeErr = error
  // A PostgREST error with a blank code is a failed fetch rather than a
  // rejection from the server — worth another go before giving up.
  console.warn(`write attempt ${attempt} failed: ${JSON.stringify(error)}`)
  await new Promise((r) => setTimeout(r, 1000 * attempt))
}
if (writeErr) throw new Error(`CMS write failed: ${JSON.stringify(writeErr)}`)

console.log(
  `\nCMS updated: gallery ${(property.gallery ?? []).length} → ${gallery.length} ` +
    `(${galleryUrls.length} leading), ${unitUrls.length} photographs on unit ${UNIT_LABEL}.`,
)
