// One-time update: adds "Blog" to the nav, seeds blog_page hero copy, and
// creates one sample published post so the feature is visibly working.
//
// Run with: node --env-file=.env.seed scripts/seed-blog.js

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY')
}

const supabase = createClient(url, key)

async function main() {
  const { error: navError } = await supabase.from('content').upsert({
    section: 'navbar',
    data: {
      links: [
        { label: 'About', to: '/about' },
        { label: 'Projects', to: '/projects' },
        { label: 'Blog', to: '/blog' },
        { label: 'Contact', to: '/contact' },
      ],
    },
  })
  if (navError) throw navError

  const { error: blogPageError } = await supabase.from('content').upsert({
    section: 'blog_page',
    data: {
      heroEyebrow: 'Journal — Prime Developers',
      heroHeading: 'News and *notes* from the field.',
      heroParagraph: 'Project milestones, market notes, and updates from our team across Texas.',
    },
  })
  if (blogPageError) throw blogPageError

  const { error: postError } = await supabase.from('blog_posts').upsert(
    {
      slug: 'welcome-to-the-prime-developers-journal',
      title: 'Welcome to the Prime Developers Journal',
      excerpt: 'A new home for project milestones, market notes, and updates from our team.',
      body: "We're launching this journal to share what we're building across Texas — from groundbreakings to grand openings, market notes, and the occasional look behind the scenes.\n\nCheck back regularly for updates on our active developments in Dallas-Fort Worth, Austin, and beyond.",
      published: true,
      published_at: new Date(2026, 0, 15).toISOString(),
      sort_order: 0,
    },
    { onConflict: 'slug' }
  )
  if (postError) throw postError

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
