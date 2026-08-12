// One-time update: adds the "Enterprise" link to the live nav, so the
// /enterprise route is reachable from the header. The nav is CMS-driven, so
// seed.js only covers a fresh database — this patches the row already in
// production.
//
// Inserted after Properties rather than appended: the rail reads
// About → Properties → Enterprise → News → Contact, offering before journal,
// with Contact left as the terminal item.
//
// Idempotent — safe to re-run; a nav that already carries /enterprise is
// left exactly as it is, including a hand-reordered one.
//
// Run with: node --env-file=.env.seed scripts/add-enterprise-nav.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY')
}

const supabase = createClient(url, key)

const ENTERPRISE = { label: 'Enterprise', to: '/enterprise' }

async function main() {
  const { data: row, error: readError } = await supabase
    .from('content')
    .select('data')
    .eq('section', 'navbar')
    .single()
  if (readError) throw readError

  const links = row.data?.links ?? []
  if (links.some((link) => link.to === '/enterprise')) {
    console.log('Nav already carries /enterprise — nothing to do.')
    return
  }

  // Anchored to Properties; if the nav has been reshaped and that link is
  // gone, fall back to sitting just before Contact rather than guessing.
  const after = links.findIndex((link) => link.to === '/properties')
  const beforeContact = links.findIndex((link) => link.to === '/contact')
  const at = after >= 0 ? after + 1 : beforeContact >= 0 ? beforeContact : links.length
  const next = [...links.slice(0, at), ENTERPRISE, ...links.slice(at)]

  const { error: writeError } = await supabase
    .from('content')
    .update({ data: { ...row.data, links: next } })
    .eq('section', 'navbar')
  if (writeError) throw writeError

  console.log(`Nav updated: ${next.map((l) => l.label).join(' · ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
