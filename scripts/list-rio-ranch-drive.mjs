// Lists every file in the public Rio Ranch Drive folder into
// scripts/rio-ranch-drive-index.json: [{ path, id }]. Same approach as
// list-pow-lewisville-drive.mjs (Drive's public embedded folder view, no login).
// This folder is the only photo source for the Rio Ranch pages.
//
//   node scripts/list-rio-ranch-drive.mjs
import { writeFileSync } from 'node:fs'

const ROOT = '1dfA755RdvTa-VnTtC-k443I_DQik5F7m'

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
writeFileSync('scripts/rio-ranch-drive-index.json', JSON.stringify(files, null, 1) + '\n')
for (const f of files) console.log(f.path)
console.log(`${files.length} files`)
