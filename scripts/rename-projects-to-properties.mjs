// One-time update: relabels the live "Projects" → "Properties" and
// "Blog" → "News" text that already exists in the `content` table, as part
// of the site-wide feature rename. Targeted field-by-field edits, not a
// blind text replace — so unrelated copy (e.g. "iconic properties" in
// about_page, which already reads correctly) is left untouched, and a
// property literally named "CAP Rate Projects" keeps its name; that is
// client data, not the feature label.
//
// Idempotent — safe to re-run; each write is a full-row replace of the
// already-correct target shape.
//
// Run with: node --env-file=.env.seed scripts/rename-projects-to-properties.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY')
}

const supabase = createClient(url, key)

async function patchSection(section, mutate) {
  const { data: row, error: readError } = await supabase.from('content').select('data').eq('section', section).single()
  if (readError) {
    console.log(`  skip ${section}: ${readError.message}`)
    return
  }
  const next = mutate(structuredClone(row.data))
  const { error: writeError } = await supabase.from('content').update({ data: next }).eq('section', section)
  if (writeError) throw writeError
  console.log(`  updated ${section}`)
}

async function main() {
  console.log('Renaming Projects → Properties, Blog → News in content rows…')

  await patchSection('navbar', (d) => ({
    ...d,
    links: d.links.map((link) =>
      link.to === '/projects'
        ? { ...link, label: 'Properties', to: '/properties' }
        : link.to === '/blog'
          ? { ...link, label: 'News', to: '/news' }
          : link,
    ),
  }))

  await patchSection('footer', (d) => ({
    ...d,
    quickLinks: d.quickLinks.map((link) =>
      link.href === '/projects' ? { ...link, label: 'Properties', href: '/properties' } : link,
    ),
  }))

  await patchSection('hero', (d) => ({
    ...d,
    ctaHref: d.ctaHref === '#projects' ? '#properties' : d.ctaHref,
    ctaLabel: d.ctaLabel === 'View Projects' ? 'View Properties' : d.ctaLabel,
  }))

  await patchSection('about_home', (d) => ({
    ...d,
    stats: d.stats.map((s) => (s.label === 'Projects Completed' ? { ...s, label: 'Properties Completed' } : s)),
  }))

  await patchSection('about_page', (d) => ({
    ...d,
    ctaLabel: d.ctaLabel === 'Explore our projects' ? 'Explore our properties' : d.ctaLabel,
  }))

  await patchSection('news_page', (d) => ({
    ...d,
    heroParagraph: d.heroParagraph?.startsWith('Project milestones')
      ? d.heroParagraph.replace('Project milestones', 'Property milestones')
      : d.heroParagraph,
  }))

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
