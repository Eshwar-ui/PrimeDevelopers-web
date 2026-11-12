// Lists every file in the public POW Lewisville Drive folder (LCA Visual
// Studios, "LWV-POW Lewisville") into scripts/pow-lewisville-drive-index.json:
// [{ path: 'Units/LEW-Unit-103/LEW-Unit-235.jpg', id }]. Reads Drive's public
// embedded folder view, so it needs no Google login. Skips the macOS `._*`
// resource-fork files.
//
//   node scripts/list-pow-lewisville-drive.mjs
import { writeFileSync } from 'node:fs'

const ROOT = '1oUd3UxV8OFXd0_maJxbB2Hq2YyGL2rmK'

async function list(id) {
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`)).text()
  const entries = []
  const re = /id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?flip-entry-title">([^<]*)</g
  for (const [, entryId, href, title] of html.matchAll(re)) {
    entries.push({ id: entryId, title: title.replace(/&amp;/g, '&').trim(), folder: href.includes('/folders/') })
  }
  return entries
}

async function walk(id, prefix) {
  const out = []
  for (const e of await list(id)) {
    if (e.title.startsWith('._')) continue
    const path = prefix ? `${prefix}/${e.title}` : e.title
    if (e.folder) out.push(...(await walk(e.id, path)))
    else out.push({ path, id: e.id })
  }
  return out
}

const files = (await walk(ROOT, '')).sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }))
writeFileSync('scripts/pow-lewisville-drive-index.json', JSON.stringify(files, null, 1) + '\n')
const by = Object.groupBy(files, (f) => f.path.split('/')[0])
for (const [k, v] of Object.entries(by)) console.log(`${k}: ${v.length}`)
console.log(`unit folders: ${new Set(files.filter((f) => f.path.startsWith('Units/')).map((f) => f.path.split('/')[1])).size}`)
