// Set one key on one `content` section.
//
// The admin panel is the normal way to edit copy; this exists for the times a
// change is made from here — and it prints the old value before writing, so
// what it replaced is recoverable from the run output rather than gone.
//
// Reads a single top-level key. Nested paths are deliberately unsupported:
// the sections that need them are edited through the admin, which knows their
// shape, and a generic deep-setter here would be a way to quietly corrupt one.
//
//   node --env-file=.env.seed scripts/set-content-value.mjs <section> <key> <value>
//   node --env-file=.env.seed scripts/set-content-value.mjs <section> <key> <value> --commit
import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')
const [section, key, ...rest] = process.argv.slice(2).filter((a) => a !== '--commit')
const value = rest.join(' ')

if (!section || !key || value === '') {
  throw new Error('Usage: set-content-value.mjs <section> <key> <value> [--commit]')
}

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data: row, error: readErr } = await supabase
  .from('content')
  .select('section, data')
  .eq('section', section)
  .single()
if (readErr) throw readErr

console.log(`${section}.${key}`)
console.log(`  was: ${JSON.stringify(row.data?.[key])}`)
console.log(`  now: ${JSON.stringify(value)}`)

if (!COMMIT) {
  console.log('\nDry run — nothing written. Re-run with --commit.')
  process.exit(0)
}

const { error: writeErr } = await supabase
  .from('content')
  .update({ data: { ...row.data, [key]: value } })
  .eq('section', section)
if (writeErr) throw new Error(`write failed: ${JSON.stringify(writeErr)}`)

console.log('\nWritten.')
