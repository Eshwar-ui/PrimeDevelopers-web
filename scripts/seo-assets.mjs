// Write robots.txt and sitemap.xml into the build, from the content the site
// is actually publishing.
//
// Run after `vite build` and before the S3 sync — deploy-web-aws.sh does both.
// Neither file can be a checked-in static asset:
//
//   * robots.txt has to say opposite things on the two hosts. The CloudFront
//     copy and the real domain are served the same bundle, and a staging copy
//     that invites crawlers in competes with the production site for its own
//     brand terms. The meta `noindex` main.jsx writes does not cover this —
//     robots.txt is fetched directly and no JavaScript runs for it.
//   * sitemap.xml lists properties and posts that staff add through the CMS,
//     so a hand-written file is wrong the first time anyone publishes.
//
// Generated at deploy rather than served live by the API because a live
// /sitemap.xml would need a new CloudFront behaviour pointing that path at the
// API origin; this needs no infrastructure change at all. The cost is that the
// sitemap is accurate as of the last deploy, which for a site whose listings
// change a few times a month is the right trade.
//
//   node scripts/seo-assets.mjs --site https://theprimedeveloper.com --out apps/web/dist
//
// `--api` defaults to the site origin, which is how the deployed site reaches
// its own API (CloudFront routes /api to the EC2 host).
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STATIC_ROUTES } from '../apps/web/src/lib/seo.js'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = arg('site', 'https://theprimedeveloper.com').replace(/\/$/, '')
const API = arg('api', SITE).replace(/\/$/, '')
// `resolve`, not `join`: --out is usually relative to the repo, but a caller
// passing an absolute path should get that path, not it glued onto the repo.
const OUT = resolve(ROOT, arg('out', 'apps/web/dist'))

// The one host whose copy of the site is the real one. Every other origin —
// CloudFront, a Firebase preview, localhost — is a staging copy and is told
// to stay out of the index entirely. Mirrors isProductionHost() in lib/site.
const PRODUCTION_ORIGIN = 'https://theprimedeveloper.com'
const isProduction = SITE === PRODUCTION_ORIGIN

async function fetchJson(path) {
  try {
    const res = await fetch(`${API}${path}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const body = await res.json()
    return Array.isArray(body) ? body : (body?.data ?? [])
  } catch (error) {
    // A sitemap missing its listings is a bad deploy, not a warning to scroll
    // past: the file would still be written, look valid, and quietly drop
    // every property page from search.
    throw new Error(`Could not read ${API}${path} for the sitemap — ${error.message}`)
  }
}

const iso = (value) => {
  const date = new Date(value ?? NaN)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
}

// ── robots.txt ───────────────────────────────────────────────────────────────
const robots = isProduction
  ? [
      'User-agent: *',
      'Allow: /',
      '',
      // The admin is behind a login and the API answers JSON; neither belongs
      // in an index, and both waste the crawl budget of a small site.
      'Disallow: /admin',
      'Disallow: /api/',
      '',
      `Sitemap: ${SITE}/sitemap.xml`,
      '',
    ].join('\n')
  : ['# Staging copy of theprimedeveloper.com — not for indexing.', 'User-agent: *', 'Disallow: /', ''].join('\n')

// ── sitemap.xml ──────────────────────────────────────────────────────────────
const [properties, news] = isProduction
  ? await Promise.all([fetchJson('/api/properties'), fetchJson('/api/news')])
  : [[], []]

const published = (rows) => rows.filter((row) => row?.slug && row.published !== false)

const urls = [
  ...STATIC_ROUTES.filter((route) => route.sitemap !== false).map((route) => ({
    loc: `${SITE}${route.path}`,
    priority: route.priority,
  })),
  ...published(properties).map((p) => ({
    loc: `${SITE}/properties/${p.slug}`,
    lastmod: iso(p.updatedAt),
    priority: '0.9',
  })),
  ...published(news).map((p) => ({
    loc: `${SITE}/news/${p.slug}`,
    lastmod: iso(p.updatedAt ?? p.publishedAt),
    priority: '0.5',
  })),
]

// Unit, investment and info pages are left out on purpose. They are real
// pages and they are linked from the property they belong to, so a crawler
// still reaches them — but most carry no description and no photograph yet
// (see the Centro gaps in docs/website-audit-2026-10-27.md), and submitting
// 47 near-empty pages per property is how a small site teaches Google that
// its listings are thin. They belong here once the unit data is filled in.
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(({ loc, lastmod, priority }) =>
    [
      '  <url>',
      `    <loc>${loc}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      priority ? `    <priority>${priority}</priority>` : null,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n'),
  ),
  '</urlset>',
  '',
].join('\n')

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'robots.txt'), robots)
writeFileSync(join(OUT, 'sitemap.xml'), sitemap)

console.log(`robots.txt  → ${isProduction ? 'indexable' : 'Disallow: / (staging copy)'}`)
console.log(`sitemap.xml → ${urls.length} URLs (${STATIC_ROUTES.length} static, ${published(properties).length} properties, ${published(news).length} posts)`)
if (!isProduction) console.log(`\n  ${SITE} is not ${PRODUCTION_ORIGIN}, so the sitemap lists only static routes.`)
