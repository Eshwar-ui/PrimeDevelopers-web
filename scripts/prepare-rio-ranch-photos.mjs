// Downloads the Rio Ranch photos chosen below from the client's Drive folder
// (https://drive.google.com/drive/folders/1dfA755RdvTa-VnTtC-k443I_DQik5F7m —
// the only photo source for these pages; listed by list-rio-ranch-drive.mjs
// into rio-ranch-drive-index.json) into rio-ranch-drive-photos/, and converts
// them into rio-ranch-web-photos/: WebP 2000px wide, quality stepped down until
// each is under ~200 KB, plus the 1200×630 JPG OG crop of each hero. Both
// folders are gitignored. Skips downloads already on disk.
//
//   node scripts/list-rio-ranch-drive.mjs          (once, or when the folder changes)
//   node scripts/prepare-rio-ranch-photos.mjs
//   $env:RIO_PHOTO_DIR="rio-ranch-web-photos"; node scripts/update-rio-ranch-commercial-lots.mjs [--preview|--commit]
//   $env:RIO_PHOTO_DIR="rio-ranch-web-photos"; node scripts/update-rio-ranch-1-acre-lots.mjs [--preview|--commit]
//
// TODO: the picks were made by eye — open land along Ronald Reagan Blvd for the
// commercial lots, oak-lined streets and cul-de-sacs for the acre lots. Confirm
// with the client that each shot shows the right part of Rio Ranch.
// TODO: the Drive folder has no site plan and no flyer, so those slots stay empty.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'apps/web/package.json'))
let sharp
try { sharp = require('sharp') } catch { sharp = createRequire(join(ROOT, 'node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/package.json'))('sharp') }

const RAW = join(ROOT, 'rio-ranch-drive-photos')
const WEB = join(ROOT, 'rio-ranch-web-photos')
const MAX_BYTES = 200 * 1024
mkdirSync(RAW, { recursive: true })
mkdirSync(WEB, { recursive: true })

const index = JSON.parse(readFileSync(join(ROOT, 'scripts/rio-ranch-drive-index.json'), 'utf8'))
const idFor = (path) => index.find((f) => f.path === path)?.id ?? (() => { throw new Error(`not in the Drive index: ${path}`) })()

// Output name → [Drive path, 'webp' | 'og'].
const OUTPUT = {
  // Commercial lots: the open land and new roads along Ronald Reagan Blvd.
  'rio-ranch-commercial-lots-liberty-hill.webp': ['Photos2/RioRanch-46.jpg', 'webp'],
  'rio-ranch-commercial-lots-og-1200x630.jpg': ['Photos2/RioRanch-46.jpg', 'og'],
  'rio-ranch-commercial-land-view.webp': ['Photos/RR_DRONE-53.jpg', 'webp'],
  'rio-ranch-commercial-gallery-01.webp': ['Photos2/RioRanch-45.jpg', 'webp'],
  'rio-ranch-commercial-gallery-02.webp': ['Photos2/RioRanch-50.jpg', 'webp'],
  'rio-ranch-commercial-gallery-03.webp': ['Photos2/RioRanch-58.jpg', 'webp'],
  'rio-ranch-commercial-gallery-04.webp': ['Photos/RR_DRONE-48.jpg', 'webp'],
  'rio-ranch-commercial-gallery-05.webp': ['Photos2/RioRanch-57.jpg', 'webp'],
  // 1 acre lots: the oak-lined streets and cul-de-sacs.
  'rio-ranch-1-acre-lots-liberty-hill.webp': ['Photos2/RioRanch-17.jpg', 'webp'],
  'rio-ranch-1-acre-lots-og-1200x630.jpg': ['Photos2/RioRanch-17.jpg', 'og'],
  'rio-ranch-acre-lot-view.webp': ['Photos2/RioRanch-36.jpg', 'webp'],
  'rio-ranch-1-acre-lots-gallery-01.webp': ['Photos2/RioRanch-18.jpg', 'webp'],
  'rio-ranch-1-acre-lots-gallery-02.webp': ['Photos2/RioRanch-26.jpg', 'webp'],
  'rio-ranch-1-acre-lots-gallery-03.webp': ['Photos2/RioRanch-30.jpg', 'webp'],
  'rio-ranch-1-acre-lots-gallery-04.webp': ['Photos2/RioRanch-2.jpg', 'webp'],
  'rio-ranch-1-acre-lots-gallery-05.webp': ['Photos/RR_DRONE-31.jpg', 'webp'],
}

async function download(path) {
  const dest = join(RAW, path.replace('/', '__'))
  if (existsSync(dest) && statSync(dest).size > 100_000) return dest
  const id = idFor(path)
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`)
      const type = res.headers.get('content-type') ?? ''
      if (!res.ok || !type.startsWith('image/')) throw new Error(`${res.status} ${type}`)
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
      return dest
    } catch (e) {
      if (attempt === 5) throw new Error(`${path}: ${e.message}`)
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
}

async function toWebp(src, dest) {
  for (let quality = 80; quality >= 30; quality -= 6) {
    const out = await sharp(src).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality }).toBuffer()
    if (out.length <= MAX_BYTES || quality <= 34) return writeFileSync(dest, out), out.length
  }
}

const sources = [...new Set(Object.values(OUTPUT).map(([path]) => path))]
const local = Object.fromEntries(await Promise.all(sources.map(async (p) => [p, await download(p)])))

for (const [name, [path, how]] of Object.entries(OUTPUT)) {
  const dest = join(WEB, name)
  const bytes = how === 'og'
    ? (await sharp(local[path]).rotate().resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toFile(dest)).size
    : await toWebp(local[path], dest)
  console.log(`${name.padEnd(46)} ${(bytes / 1024).toFixed(0).padStart(5)} KB  ← ${path}`)
}
