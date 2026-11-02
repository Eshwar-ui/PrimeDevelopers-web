// Bake each route's <head> into its own HTML file, so a link shared on
// WhatsApp, LinkedIn, Slack or X shows that page rather than the whole site.
//
// WHY THIS EXISTS
// The site is a client-rendered SPA: every URL is served the one index.html
// and React writes the real title, description and og: tags once it has
// booted and the API has answered. Google executes JavaScript and so reads
// them, but no social scraper does — Facebook, LinkedIn, X, WhatsApp and
// Slack fetch the HTML, read the head, and leave. Every property link ever
// pasted into a chat has therefore shown the generic index.html title and no
// image, however carefully the page filled its own tags in afterwards.
//
// WHAT IT DOES NOT DO
// Only the head is prerendered — the body stays the empty SPA shell. The
// scrapers read nothing else, and rendering React to static HTML here would
// mean running the whole app, its 3D viewer included, under node at build
// time for no reader that exists. Google still gets the body the way it
// always has, by running the app.
//
// FALLING BACK SAFELY
// A route with no file of its own still resolves to the root index.html, and
// that file is written with the home page's head — so a property published in
// the CMS between deploys degrades to a generic-but-valid preview instead of
// a broken page. That is also why nothing here fails the build when a record
// is missing.
//
// REQUIRES AN INFRASTRUCTURE CHANGE TO TAKE EFFECT
// CloudFront currently answers every extensionless path with /index.html, so
// these files are uploaded but never served until the distribution resolves
// `/about` to `/about/index.html` first. See docs/seo-setup.md.
//
//   node scripts/prerender.mjs --site https://theprimedeveloper.com --out apps/web/dist
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderHead } from '../apps/web/src/lib/head.js'
import { INDEXABLE, STATIC_ROUTES, newsHead, propertyHead, resolveHead, staticHead } from '../apps/web/src/lib/seo.js'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = arg('site', 'https://theprimedeveloper.com').replace(/\/$/, '')
const API = arg('api', SITE).replace(/\/$/, '')
const OUT = resolve(ROOT, arg('out', 'apps/web/dist'))
const isProduction = SITE === 'https://theprimedeveloper.com'

const shell = readFileSync(join(OUT, 'index.html'), 'utf8')

// index.html ships a title and a description of its own, and a second copy of
// either is worse than the generic one it replaces — a scraper picking the
// first would show the site's description on every page. They come out, and
// the per-route head goes in where the title was, keeping the inline scripts
// below it untouched so their CSP hashes still match (deploy-web-aws.sh
// checks them against the live header).
const TITLE = /[ \t]*<title>[\s\S]*?<\/title>\n?/i
const DESCRIPTION = /[ \t]*<meta\s+name="description"[\s\S]*?\/?>\n?/i

if (!TITLE.test(shell)) {
  throw new Error('dist/index.html has no <title> to replace — has the template changed?')
}

async function fetchJson(path) {
  try {
    const res = await fetch(`${API}${path}`)
    if (!res.ok) throw new Error(String(res.status))
    const body = await res.json()
    return Array.isArray(body) ? body : (body?.data ?? [])
  } catch (error) {
    // Not fatal, by design: the routes that did resolve are still worth
    // writing, and the ones that did not fall back to the root index.html.
    // A deploy that stops because the API blinked would be the worse outcome.
    console.warn(`warning: could not read ${API}${path} (${error.message}) — those routes keep the generic head`)
    return []
  }
}

/** `/` → index.html, `/properties/x` → properties/x/index.html. */
function write(path, spec) {
  const head = renderHead(resolveHead(spec, { origin: SITE, robots: isProduction ? INDEXABLE : 'noindex, nofollow' }))
  const html = shell.replace(DESCRIPTION, '').replace(TITLE, `${head}\n`)
  const file = path === '/' ? join(OUT, 'index.html') : join(OUT, path.replace(/^\//, ''), 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}

const [properties, news] = await Promise.all([fetchJson('/api/properties'), fetchJson('/api/news')])
const published = (rows) => rows.filter((row) => row?.slug && row.published !== false)

let count = 0
for (const route of STATIC_ROUTES) {
  write(route.path, staticHead(route.path))
  count += 1
}
for (const property of published(properties)) {
  const spec = propertyHead(property)
  if (!spec) continue
  write(spec.path, spec)
  count += 1
}
for (const post of published(news)) {
  const spec = newsHead(post)
  if (!spec) continue
  write(spec.path, spec)
  count += 1
}

console.log(
  `prerendered ${count} heads (${STATIC_ROUTES.length} static, ${published(properties).length} properties, ${published(news).length} posts) for ${SITE}`,
)
if (!isProduction) console.log(`  robots: noindex, nofollow — ${SITE} is a staging copy`)
