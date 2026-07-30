// One-time update: adds "News" to the nav, seeds news_page hero copy, and
// creates one sample published post so the feature is visibly working.
//
// Run with: node --env-file=.env.seed scripts/seed-news.js

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
        { label: 'Properties', to: '/properties' },
        { label: 'News', to: '/news' },
        { label: 'Contact', to: '/contact' },
      ],
    },
  })
  if (navError) throw navError

  const { error: newsPageError } = await supabase.from('content').upsert({
    section: 'news_page',
    data: {
      heroEyebrow: 'Journal — Prime Developers',
      heroHeading: 'News and *notes* from the field.',
      heroParagraph: 'Property milestones, market notes, and updates from our team across Texas.',
    },
  })
  if (newsPageError) throw newsPageError

  const { error: postError } = await supabase.from('news').upsert(
    {
      slug: 'welcome-to-the-prime-developers-journal',
      title: 'Welcome to the Prime Developers Journal',
      excerpt: 'A new home for property milestones, market notes, and updates from our team.',
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
