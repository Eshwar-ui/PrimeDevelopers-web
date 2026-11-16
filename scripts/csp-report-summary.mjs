#!/usr/bin/env node
// Group the site's CSP violation reports, so the policy can be enforced
// (audit task 7, docs/csp-rollout.md). Read-only.
//
//   aws sso login --profile prime-client
//   node scripts/csp-report-summary.mjs [--days 7] [--profile prime-client]
//
// Each report is one `[CSP] {"directive":…,"blocked":…,"page":…,"source":…}` line
// in the website API's log group (apps/api/src/modules/csp). Prints one row per
// directive and blocked origin, with a count, an example page and a first guess
// at what it is:
//   extension  a browser extension injected it; nothing to do
//   inline     an inline script or style; check its hash against the build
//   site       our own origin; a real bug to fix in this repo
//   external   a third-party host; add it to website_csp if the site needs it
import { execFileSync } from 'node:child_process'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DAYS = Number(arg('days', '7'))
const PROFILE = arg('profile', process.env.AWS_PROFILE || 'prime-client')
const GROUP = '/prime-tracker/app/website-api'

const messages = []
let token
do {
  const out = JSON.parse(
    execFileSync(
      'aws',
      [
        'logs', 'filter-log-events', '--log-group-name', GROUP,
        '--filter-pattern', '"[CSP]"',
        '--start-time', String(Date.now() - DAYS * 86_400_000),
        '--profile', PROFILE, '--output', 'json', '--no-paginate',
        ...(token ? ['--next-token', token] : []),
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ),
  )
  for (const e of out.events ?? []) messages.push(e.message)
  token = out.nextToken
} while (token)

const origin = (url) => {
  if (!url) return '(none)'
  try {
    return new URL(url).origin
  } catch {
    return url // 'inline', 'eval', 'data', 'blob' …
  }
}
const kind = (blocked, source) => {
  if (/^(chrome|moz|safari(-web)?|ms-browser)-extension/.test(`${blocked} ${source ?? ''}`.trim())) return 'extension'
  if (/extension:\/\//.test(source ?? '')) return 'extension'
  if (blocked === 'inline' || blocked === 'eval') return 'inline'
  if (/cloudfront\.net|theprimedeveloper\.com/.test(blocked)) return 'site'
  return 'external'
}

const groups = new Map()
let unparsed = 0
for (const line of messages) {
  // pm2 keeps Nest's colours: strip the ANSI codes, then take the JSON object.
  const plain = line.replace(/\x1b\[[0-9;]*m/g, '')
  const json = plain.slice(plain.indexOf('{'), plain.lastIndexOf('}') + 1)
  let v
  try {
    v = JSON.parse(json)
  } catch {
    unparsed++
    continue
  }
  const blocked = origin(v.blocked)
  const key = `${v.directive}\t${blocked}`
  const g = groups.get(key) ?? { directive: v.directive, blocked, count: 0, page: v.page ?? v.document, kind: kind(blocked, v.source) }
  g.count++
  groups.set(key, g)
}

const rows = [...groups.values()].sort((a, b) => b.count - a.count)
console.log(`${messages.length} reports in the last ${DAYS} days, ${rows.length} distinct${unparsed ? `, ${unparsed} unparsed` : ''}\n`)
console.log('| Count | Kind | Directive | Blocked | Example page | Decision |')
console.log('|---:|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.count} | ${r.kind} | ${r.directive} | ${r.blocked} | ${r.page ?? ''} | |`)
