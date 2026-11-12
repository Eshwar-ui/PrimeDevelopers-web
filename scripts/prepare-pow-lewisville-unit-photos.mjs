// Downloads every photo in the POW Lewisville Drive folder (the index from
// list-pow-lewisville-drive.mjs; drone videos skipped — they go to YouTube) into
// pow-lewisville-drive-photos/all/<Drive path>, then picks the best photos for
// each unit and converts them for the web.
//
// "Best" per unit folder (Units/LEW-Unit-<n>/ — the folder name is the unit;
// file names inside do not match it):
//   1. score each photo on sharpness (variance of a Laplacian over a 512px
//      greyscale copy) with a penalty for under- or over-exposure;
//   2. drop near-duplicates (8×8 average-hash within 6 bits of a kept photo);
//   3. keep the top MAX_PER_UNIT, best first — the first is the unit card photo.
//
// Output: pow-lewisville-web-photos/units/pow-lewisville-unit-<n>-<k>.webp
// (2000px wide, under ~200 KB) and scripts/pow-lewisville-unit-photos.json
// ({ "<n>": [{ file, source, score }] }), which the content scripts read.
// Skips downloads already on disk, so it is safe to re-run.
//
//   node scripts/list-pow-lewisville-drive.mjs
//   node scripts/prepare-pow-lewisville-unit-photos.mjs
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'apps/web/package.json'))
let sharp
try { sharp = require('sharp') } catch { sharp = createRequire(join(ROOT, 'node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/package.json'))('sharp') }

const MAX_PER_UNIT = 3
const MAX_BYTES = 200 * 1024
const RAW = join(ROOT, 'pow-lewisville-drive-photos', 'all')
const WEB = join(ROOT, 'pow-lewisville-web-photos', 'units')
mkdirSync(WEB, { recursive: true })

const index = JSON.parse(readFileSync(join(ROOT, 'scripts/pow-lewisville-drive-index.json'), 'utf8'))
  .filter((f) => !f.path.startsWith('Drone Videos/'))

async function download({ path, id }) {
  const dest = join(RAW, path)
  if (existsSync(dest) && statSync(dest).size > 100_000) return dest
  mkdirSync(dirname(dest), { recursive: true })
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

// A few at a time: Drive drops some of many parallel downloads.
async function pool(items, size, fn) {
  const out = []
  let next = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

let done = 0
const failures = []
await pool(index, 6, async (f) => {
  try { await download(f) } catch (e) { failures.push(e.message) }
  if (++done % 25 === 0 || done === index.length) console.log(`downloaded ${done}/${index.length}`)
})

async function score(file) {
  const { data, info } = await sharp(file).rotate().resize({ width: 512 }).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  let sum = 0, sumSq = 0, n = 0, mean = 0
  for (const v of data) mean += v
  mean /= data.length
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = data[i - w] + data[i + w] + data[i - 1] + data[i + 1] - 4 * data[i]
      sum += lap; sumSq += lap * lap; n++
    }
  }
  const sharpness = sumSq / n - (sum / n) ** 2
  // Mid-grey ~120 is ideal for these daylight exteriors; penalise the extremes.
  const exposure = 1 - Math.min(1, Math.abs(mean - 120) / 120)
  const hash = await sharp(file).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer()
  const avg = hash.reduce((a, b) => a + b, 0) / 64
  return { sharpness, exposure, score: Math.round(sharpness * (0.5 + exposure)), bits: [...hash].map((v) => (v > avg ? 1 : 0)) }
}
const distance = (a, b) => a.reduce((d, bit, i) => d + (bit !== b[i]), 0)

async function toWebp(src, dest) {
  for (let quality = 78; quality >= 40; quality -= 6) {
    const out = await sharp(src).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality }).toBuffer()
    if (out.length <= MAX_BYTES || quality <= 46) return writeFileSync(dest, out), out.length
  }
}

const units = Object.groupBy(index.filter((f) => f.path.startsWith('Units/')), (f) => f.path.split('/')[1].replace('LEW-Unit-', ''))
const picks = {}
for (const [unit, photos] of Object.entries(units).sort(([a], [b]) => a - b)) {
  const scored = (await Promise.all(photos.map(async (p) => {
    const file = join(RAW, p.path)
    return existsSync(file) ? { source: p.path, file, ...(await score(file)) } : null
  }))).filter(Boolean).sort((a, b) => b.score - a.score)
  const kept = []
  for (const s of scored) {
    if (kept.length === MAX_PER_UNIT) break
    if (kept.some((k) => distance(k.bits, s.bits) <= 6)) continue
    kept.push(s)
  }
  picks[unit] = []
  for (const [k, s] of kept.entries()) {
    const name = `pow-lewisville-unit-${unit}-${k + 1}.webp`
    const bytes = await toWebp(s.file, join(WEB, name))
    picks[unit].push({ file: `units/${name}`, source: s.source, score: s.score })
  }
  console.log(`unit ${unit}: kept ${kept.length} of ${scored.length} (${picks[unit].map((p) => p.source.split('/').pop()).join(', ')})`)
}
writeFileSync(join(ROOT, 'scripts/pow-lewisville-unit-photos.json'), JSON.stringify(picks, null, 1) + '\n')

const empty = Object.keys(units).length
console.log(`\n${Object.keys(picks).length} units with photos → scripts/pow-lewisville-unit-photos.json (${empty} folders had files)`)
if (failures.length) {
  console.error(`\n${failures.length} downloads failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
