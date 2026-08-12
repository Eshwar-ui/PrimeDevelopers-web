// One-time update: reshapes the live nav to Home · About · Properties ·
// Expertise · News.
//
// Two changes, both against the row already in production — the nav is
// CMS-driven, so seed.js only covers a fresh database:
//
//   1. Drops Contact. The header's Enquire button already points at /contact,
//      so the bar carried the same destination twice.
//   2. Adds Expertise → /enterprise, which the route has always served but
//      nothing in the header pointed to. An existing /enterprise entry is
//      relabelled rather than duplicated, since an earlier pass seeded it as
//      "Enterprise".
//
// Placed after Properties, per the design: offering before journal.
//
// Idempotent — safe to re-run. A nav already in the target shape is left
// exactly as it is, including a hand-reordered one.
//
// Goes over PostgREST rather than Prisma on purpose: the API's DATABASE_URL
// points at Supabase's direct 5432 host, which isn't reachable from every
// machine, while the REST endpoint is plain HTTPS and always is.
//
// Run with: node --env-file=apps/api/.env scripts/update-nav-expertise.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
// apps/api/.env calls it SUPABASE_SERVICE_ROLE_KEY; seed.js and .env.seed call
// the same credential SUPABASE_SECRET_KEY. Accept either so this runs against
// whichever env file is to hand.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(url, key)

const EXPERTISE = { label: 'Expertise', to: '/enterprise' }

async function main() {
  const { data: row, error: readError } = await supabase
    .from('content')
    .select('data')
    .eq('section', 'navbar')
    .single()
  if (readError) throw readError

  const links = row.data?.links ?? []

  const withoutContact = links.filter((link) => link.to !== '/contact')

  // Relabel in place when /enterprise is already there — reordering a nav
  // someone may have arranged by hand is not this script's business.
  const existing = withoutContact.findIndex((link) => link.to === '/enterprise')
  let next
  if (existing >= 0) {
    next = withoutContact.map((link, i) => (i === existing ? { ...link, ...EXPERTISE } : link))
  } else {
    const after = withoutContact.findIndex((link) => link.to === '/properties')
    const at = after >= 0 ? after + 1 : withoutContact.length
    next = [...withoutContact.slice(0, at), EXPERTISE, ...withoutContact.slice(at)]
  }

  const unchanged =
    next.length === links.length && next.every((link, i) => link.to === links[i].to && link.label === links[i].label)
  if (unchanged) {
    console.log('Nav already in the target shape — nothing to do.')
    return
  }

  const { error: writeError } = await supabase
    .from('content')
    .update({ data: { ...row.data, links: next } })
    .eq('section', 'navbar')
  if (writeError) throw writeError

  console.log(`Nav updated: Home · ${next.map((l) => l.label).join(' · ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
