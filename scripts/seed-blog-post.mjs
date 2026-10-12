// Publish a journal post from scripts/posts/<slug>.md.
//
// The .md file is stored as the post body verbatim, front matter included —
// that block is where the site reads a post's category and byline from (see
// apps/web/src/lib/posts.js). Title, excerpt, cover and date live in POSTS
// below because they are columns of their own.
//
// Dry run by default: prints what it would write. Upserts on slug, so running
// it again updates the post in place rather than duplicating it.
//
//   node --env-file=apps/api/.env scripts/seed-blog-post.mjs <slug>
//   node --env-file=apps/api/.env scripts/seed-blog-post.mjs <slug> --commit
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const POSTS = {
  'cap-rates-and-nnn-leases-explained': {
    title: 'CAP Rates and NNN Leases, Explained: A Plain-English Guide for Investors',
    excerpt:
      'What a cap rate actually measures, what a triple-net lease shifts onto the tenant, and the questions worth asking before you invest in a stabilized commercial property.',
    coverImage:
      'https://nrtqntqutquapydsnjbm.supabase.co/storage/v1/object/public/images/projects/centro-plaza/drive/buildings/building-01/LcaVisualStudios-2.jpg',
    publishedAt: '2026-10-12T15:00:00.000Z',
    sortOrder: 0,
  },
}

const COMMIT = process.argv.includes('--commit')
const slug = process.argv.slice(2).find((a) => !a.startsWith('--'))
const post = POSTS[slug]
if (!post) throw new Error(`Usage: seed-blog-post.mjs <slug> [--commit]\nKnown: ${Object.keys(POSTS).join(', ')}`)

const here = path.dirname(fileURLToPath(import.meta.url))
const body = readFileSync(path.join(here, 'posts', `${slug}.md`), 'utf8').replace(/\r\n/g, '\n')

const row = {
  slug,
  title: post.title,
  excerpt: post.excerpt,
  body,
  cover_image: post.coverImage,
  published: true,
  published_at: post.publishedAt,
  sort_order: post.sortOrder,
  updated_at: new Date().toISOString(),
}

if (!COMMIT) {
  console.log('Dry run — pass --commit to write.\n')
  console.log({ ...row, body: `${body.slice(0, 160)}… (${body.length} chars)` })
  process.exit(0)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await supabase.from('news').upsert(row, { onConflict: 'slug' }).select('id, slug, published')
if (error) throw error
console.log('Written:', data)
