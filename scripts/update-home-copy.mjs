// Point the homepage's copy at the keyword clusters it is meant to rank for.
//
// WHY A SCRIPT
// The homepage's <head> is code (lib/seo.js, so the prerenderer and the
// sitemap can read it under plain node), but the words on the page are CMS
// content and the live `hero`, `units_home` and `gallery` rows were seeded
// long ago. Editing the DEFAULTS in ContentContext changes a fresh database
// and nothing else — the stored row shadows them — so a copy change that has
// to reach production goes through the API, as an admin, like any other edit.
//
// WHAT IT CHANGES
// Three paragraphs, one per section. None of them is a new claim: each names
// the property types the portfolio actually contains and the towns they are
// actually in, which is what the keyword list says the site is searched for
// and what the listings already say it sells.
//
//   hero.paragraph         the homepage's one topical line, under the H1
//   units_home.paragraph   names the unit types the finder filters
//   gallery.paragraph      names the categories the portfolio strip shows
//
// The H1 itself is deliberately NOT touched. "We build the landmarks of
// Texas" is the client's approved line, and the homepage's own target terms
// on the keyword list are the branded ones — which an H1 does not need to
// spell out. The category terms belong in the paragraph below it and on the
// cluster pages, where they can be said in full.
//
// Dry run unless --commit, and it prints the stored value beside the new one
// for every field, so what it would replace is reviewable before it is gone
// and recoverable from the run output afterwards.
//
// Idempotent: a field already carrying the target value is left alone and
// reported as unchanged.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-home-copy.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-home-copy.mjs --commit

const COMMIT = process.argv.includes('--commit')
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`

const email = process.env.PRIME_ADMIN_EMAIL
const password = process.env.PRIME_ADMIN_PASSWORD
if (!email || !password) {
  throw new Error('Set PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')
}

/**
 * One clause per keyword cluster, each tied to the town it is really in:
 * office warehouse condos (POW Lewisville), flex space (POW Leander), retail
 * (Centro Plaza, Leander — not Cedar Park, whatever the old copy said) and
 * one-acre commercial lots (Rio Ranch, Liberty Hill). The
 * closing line about one team is kept verbatim from the copy already live —
 * it is the sentence that says what the firm does differently, and it was not
 * the part that needed fixing.
 */
const EDITS = [
  {
    section: 'hero',
    key: 'paragraph',
    value:
      'Office warehouse condos in Lewisville. Flex space and retail in Leander. One-acre commercial lots in Liberty Hill. One team, start to finish — acquisition, design, and handover.',
  },
  {
    section: 'units_home',
    key: 'paragraph',
    value:
      'Filter by size — every office warehouse, flex and retail unit across the portfolio, including the ones already let.',
  },
  {
    section: 'gallery',
    key: 'paragraph',
    value:
      'Office warehouse condos, flex space, retail plazas and commercial lots across Central Texas and DFW — developed, owned and operated by one team.',
  },
]

async function call(path, { token, ...init } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? undefined : res.json()
}

const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})

// The admin read: drafts included, never cached — the same read the admin
// panel does before it saves, so this cannot clobber a field it never saw.
const content = await call('/admin/content', { token })

// Grouped by section, because a section is written back whole: two edits to
// the same row have to go up in one PUT or the second overwrites the first.
const bySection = new Map()
for (const edit of EDITS) {
  const stored = content?.[edit.section] ?? {}
  const current = stored[edit.key]

  console.log(`\n${edit.section}.${edit.key}`)
  if (current === edit.value) {
    console.log('  unchanged — already carries this value')
    continue
  }
  console.log(`  was: ${JSON.stringify(current)}`)
  console.log(`  now: ${JSON.stringify(edit.value)}`)

  const next = bySection.get(edit.section) ?? { ...stored }
  next[edit.key] = edit.value
  bySection.set(edit.section, next)
}

if (!bySection.size) {
  console.log('\nNothing to do — every field already carries its target value.')
  process.exit(0)
}

if (!COMMIT) {
  console.log(`\nDry run — ${bySection.size} section(s) would be written. Re-run with --commit.`)
  process.exit(0)
}

for (const [section, data] of bySection) {
  await call(`/content/${section}`, {
    token,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  console.log(`wrote ${section}`)
}
console.log(`\nDone — ${bySection.size} section(s) updated.`)
