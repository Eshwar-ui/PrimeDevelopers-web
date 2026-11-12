// Downloads the POW Lewisville Drive photos (both phases) named in pow-lewisville-drive-manifest.json
// into pow-lewisville-drive-photos/ and converts them into pow-lewisville-web-photos/:
// WebP 2000px wide, quality stepped down until each is under 200 KB, plus the
// 1200×630 JPG OG crops of each phase hero. Both folders are gitignored. Skips files
// already on disk, so it is safe to re-run.
//
//   node scripts/prepare-pow-lewisville-photos.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-pow-lewisville-content.mjs   (and …-phase-ii-content.mjs)
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'apps/web/package.json'))
let sharp
try { sharp = require('sharp') } catch { sharp = createRequire(join(ROOT, 'node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/package.json'))('sharp') }

const RAW = join(ROOT, 'pow-lewisville-drive-photos')
const WEB = join(ROOT, 'pow-lewisville-web-photos')
const MAX_BYTES = 200 * 1024
mkdirSync(RAW, { recursive: true })
mkdirSync(WEB, { recursive: true })

const manifest = Object.entries(JSON.parse(readFileSync(join(ROOT, 'scripts/pow-lewisville-drive-manifest.json'), 'utf8')))
  .filter(([k]) => !k.startsWith('_'))

async function download(id, dest) {
  if (existsSync(dest) && statSync(dest).size > 100_000) return
  // Drive drops some of many parallel downloads ("fetch failed"); retry those.
  let res
  for (let attempt = 1; ; attempt++) {
    try { res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`); break }
    catch (e) { if (attempt === 5) throw e; await new Promise((r) => setTimeout(r, 2000 * attempt)) }
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) throw new Error(`${id}: ${res.status} ${type}`)
  writeFileSync(dest, buf)
}

async function toWebp(src, dest) {
  for (let quality = 78; quality >= 40; quality -= 6) {
    const out = await sharp(src).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality }).toBuffer()
    if (out.length <= MAX_BYTES || quality <= 46) return writeFileSync(dest, out), { quality, bytes: out.length }
  }
}

const failures = []
await Promise.all(manifest.map(async ([name, [path, id]]) => {
  const raw = join(RAW, `${name}.jpg`)
  try {
    await download(id, raw)
    const r = await toWebp(raw, join(WEB, `${name}.webp`))
    console.log(`${name}.webp  ${(r.bytes / 1024).toFixed(0)} KB  q${r.quality}  ← ${path}`)
  } catch (e) {
    failures.push(`${name} (${path}): ${e.message}`)
  }
}))

// One OG card per phase, cropped from that phase's hero.
for (const [hero, og] of [
  ['pow-lewisville-office-warehouse-exterior', 'pow-lewisville-og-1200x630'],
  ['pow-lewisville-phase-ii-aerial', 'pow-lewisville-phase-ii-og-1200x630'],
]) {
  const src = join(RAW, `${hero}.jpg`)
  if (!existsSync(src)) continue
  const out = await sharp(src).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  writeFileSync(join(WEB, `${og}.jpg`), out)
  console.log(`${og}.jpg  ${(out.length / 1024).toFixed(0)} KB`)
}

if (failures.length) {
  console.error(`\n${failures.length} failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
