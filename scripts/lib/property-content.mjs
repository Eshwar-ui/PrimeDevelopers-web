// Shared plumbing for the per-property content scripts (POW Lewisville Phase I
// and Phase II). Same flow as update-pow-leander-content.mjs, factored out so
// the two phases cannot drift: log in as an admin, read the record by slug,
// print a dry-run diff, and only with --commit back the record up, upload the
// prepared photos through /uploads/image and PATCH it with `expectedUpdatedAt`
// so an edit made meanwhile is refused rather than overwritten.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

export const COMMIT = process.argv.includes('--commit')
// --preview: no login, nothing written to the API. Reads the public record,
// applies the patch with the photos pointing at PREVIEW_MEDIA, and writes the
// result to tmp/<slug>.preview.json for a local mock API to serve.
const PREVIEW = process.argv.includes('--preview')
const PREVIEW_MEDIA = process.env.PREVIEW_MEDIA ?? 'http://localhost:4010/__photos'
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

/**
 * @param {object} o
 * @param {string} o.slug
 * @param {string} o.folder          upload folder for the photos
 * @param {string} o.photoDir        prepared photos (may not exist)
 * @param {Record<string,string>} o.files  slot key → file name in photoDir
 * @param {string[]} o.galleryOrder  slot keys, in the order the gallery should hold them
 * @param {(detail: object, img: Record<string,string>) => object} o.patch  detail fields to merge
 * @param {object} [o.top]           top-level fields to set (buildings/sold/available)
 */
export async function applyContent({ slug, folder, photoDir, files, galleryOrder, patch, top = {} }) {
  if (PREVIEW) {
    const property = await call(`/properties/${slug}`)
    const img = Object.fromEntries(
      Object.keys(files).filter((k) => photoDir && existsSync(join(photoDir, files[k]))).map((k) => [k, `${PREVIEW_MEDIA}/${files[k]}`]),
    )
    const shot = galleryOrder.map((k) => img[k]).filter(Boolean)
    const out = {
      ...property,
      ...top,
      gallery: shot.length ? shot : property.gallery,
      detail: { ...property.detail, ...patch(property.detail ?? {}, img) },
    }
    mkdirSync('tmp', { recursive: true })
    writeFileSync(join('tmp', `${slug}.preview.json`), JSON.stringify(out, null, 2))
    console.log(`preview written to tmp/${slug}.preview.json (${Object.keys(img).length} photos)`)
    return
  }

  const email = process.env.PRIME_ADMIN_EMAIL
  const password = process.env.PRIME_ADMIN_PASSWORD
  if (!email || !password) throw new Error('Set PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')

  const onHand = photoDir ? Object.keys(files).filter((k) => existsSync(join(photoDir, files[k]))) : []
  const missing = Object.keys(files).filter((k) => !onHand.includes(k))
  // Only replace the gallery once there are photographs to replace it with;
  // the old site-wide slides, attachment(*) images and template sample go with it.
  const newGallery = (current, img) => {
    const shot = galleryOrder.map((k) => img[k]).filter(Boolean)
    return shot.length ? shot : current
  }

  const { accessToken: token } = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const property = await call(`/admin/properties/${slug}`, { token })

  const placeholder = Object.fromEntries(onHand.map((k) => [k, `<upload: ${files[k]}>`]))
  const preview = patch(property.detail ?? {}, placeholder)
  console.log(`${slug} (updatedAt ${property.updatedAt})`)
  console.log(`  images: ${onHand.length} on hand, ${missing.length} missing${photoDir ? '' : ' (no photo folder)'}`)
  if (missing.length) console.log(`    missing: ${missing.map((k) => files[k]).join(', ')}`)
  console.log(`  gallery: ${newGallery(property.gallery, placeholder) === property.gallery ? 'unchanged' : 'replaced'}`)
  for (const [k, v] of Object.entries(top)) console.log(`  ${k}: ${property[k]} → ${v}`)
  for (const k of Object.keys(preview)) {
    const before = JSON.stringify(property.detail?.[k] ?? null)
    const after = JSON.stringify(preview[k])
    console.log(`  detail.${k}: ${before === after ? 'unchanged' : before === 'null' ? 'added' : 'changed'}`)
  }

  if (!COMMIT) {
    console.log('\nDry run — nothing uploaded or written. Re-run with --commit.')
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${slug}-content-backup-${stamp}.json`
  writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))
  console.log(`\nbacked up previous state to ${backup}`)

  const img = {}
  for (const key of onHand) {
    const name = files[key]
    const form = new FormData()
    form.append('folder', folder)
    const type = name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    form.append('file', new Blob([readFileSync(join(photoDir, name))], { type }), basename(name))
    img[key] = (await call('/uploads/image', { token, method: 'POST', body: form })).url
    console.log(`uploaded ${name} → ${img[key]}`)
  }

  await call(`/admin/properties/${property.id}`, {
    token,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...top,
      gallery: newGallery(property.gallery, img),
      detail: { ...property.detail, ...patch(property.detail ?? {}, img) },
      expectedUpdatedAt: property.updatedAt,
    }),
  })
  console.log(`Saved — ${slug} carries the handoff copy.`)
}

/** imageAlts entries for every uploaded slot except the OG card. */
export const imageAltsFor = (detail, img, altFor) => [
  ...(detail.imageAlts ?? []).filter((a) => !Object.values(img).includes(a.src)),
  ...Object.entries(img).filter(([k]) => k !== 'og').map(([k, src]) => ({ src, alt: altFor(k) })),
]

export const defaultPhotoDir = () =>
  process.env.POW_PHOTO_DIR ?? (existsSync('pow-lewisville-web-photos') ? 'pow-lewisville-web-photos' : '')
