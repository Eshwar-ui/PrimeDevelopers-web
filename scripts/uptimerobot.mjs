/**
 * Create and sync the UptimeRobot monitors described in docs/monitoring.md.
 *
 * The doc is the spec; this is the same thing in a form that can be re-run.
 * Clicking three monitors into a dashboard takes five minutes, but nothing then
 * records that the readiness monitor *must* be a keyword check — and a monitor
 * quietly edited to a plain HTTP(s) check stays green through a total database
 * outage. Running this again reports that drift and puts it back.
 *
 *   node scripts/uptimerobot.mjs                  # dry run — prints the plan, writes nothing
 *   node scripts/uptimerobot.mjs --apply          # create and fix
 *   node scripts/uptimerobot.mjs --apply --alert-contacts 123456,789012
 *   node scripts/uptimerobot.mjs --no-alert-contacts --apply
 *
 * Needs the account's **main** API key (UptimeRobot → Settings → API settings).
 * A read-only or monitor-specific key can list but not create.
 *
 *   export UPTIMEROBOT_API_KEY=u1234567-...
 *
 * Idempotent: monitors are matched by friendly name, so re-running never
 * duplicates one. Exits non-zero if anything failed, or if a dry run found
 * drift — which makes it usable as a check, not only as a setup step.
 */
import process from 'node:process'

// ── config ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const has = (name) => args.includes(`--${name}`)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const APPLY = has('apply')
const API_KEY = arg('api-key', process.env.UPTIMEROBOT_API_KEY)

const API = 'https://api.uptimerobot.com/v2'

// UptimeRobot's numeric enums. Named here because `type: 2, keyword_type: 2`
// at a call site is unreadable and the two 2s mean unrelated things.
const TYPE_KEYWORD = 2
const KEYWORD_ABSENT = 2 // alert when the keyword is NOT found
const STATUS_PAUSED = 0
const STATUS_RESUME = 1
const CONTACT_ACTIVE = 2

/**
 * The three monitors from docs/monitoring.md, with its reasoning attached —
 * change them there and here together.
 */
const MONITORS = [
  {
    // Catches the process being down, a failed deploy, a crash loop, and
    // Render suspending a free service (which does not recover on its own).
    friendly_name: 'Prime API — liveness',
    url: 'https://prime-developers-api.onrender.com/api/health',
    keyword_value: '"status":"ok"',
  },
  {
    // Keyword, not HTTP(s), and this is the one that matters: /ready returns
    // **200 with `"status":"degraded"`** when the database is unreachable, so a
    // status-code check sits green through a Supabase outage. Matching on
    // `"status":"ok"` also fails on an empty body, an edge error page and a
    // timeout; matching on `degraded` would catch only the failure the endpoint
    // is well enough to describe.
    friendly_name: 'Prime API — database',
    url: 'https://prime-developers-api.onrender.com/api/health/ready',
    keyword_value: '"status":"ok"',
  },
  {
    // The SPA shell only. It cannot catch empty sections caused by a dead API —
    // the two above are what cover that — but having the site on the same page
    // distinguishes "Firebase is fine, the API is dead" at a glance.
    // The keyword is in the served index.html <title>, not injected by JS: a
    // keyword that appears only after hydration fails every check.
    friendly_name: 'Prime Developers — site',
    url: 'https://theprimedeveloper.web.app/',
    keyword_value: 'Prime Developers',
  },
].map((m) => ({
  ...m,
  type: TYPE_KEYWORD,
  keyword_type: KEYWORD_ABSENT,
  interval: 300, // 5 min — the free plan's floor, and enough to keep a free Render service awake
  // Not the 5s default. On 10 Sep 2026 Render's edge held connections open for
  // 420s before a 503; a timeout well under the interval is what turns a hang
  // into an alert instead of a monitor that sits waiting.
  timeout: 30,
}))

// ── api ────────────────────────────────────────────────────────────────────
async function call(endpoint, params = {}) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({ api_key: API_KEY, format: 'json', ...params }),
  })

  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${endpoint}: HTTP ${res.status}, non-JSON response — ${text.slice(0, 200)}`)
  }
  if (json.stat !== 'ok') {
    const err = json.error ?? {}
    throw new Error(`${endpoint}: ${err.message ?? err.type ?? JSON.stringify(json)}`)
  }
  return json
}

/** getMonitors pages at 50; an account shared with other projects will exceed that. */
async function fetchMonitors() {
  const found = []
  for (let offset = 0; ; offset += 50) {
    const page = await call('getMonitors', { limit: 50, offset, logs: 0, alert_contacts: 1 })
    found.push(...(page.monitors ?? []))
    const total = page.pagination?.total ?? found.length
    if (!page.monitors?.length || found.length >= total) return found
  }
}

// ── diffing ────────────────────────────────────────────────────────────────
/**
 * Only the fields this script owns. An interval or a friendly name someone
 * deliberately changed in the dashboard is drift; a field we never set is not
 * ours to reset.
 */
function drift(existing, want, contacts) {
  const diffs = []
  const check = (label, got, expected) => {
    if (String(got) !== String(expected)) diffs.push(`${label}: ${got} → ${expected}`)
  }

  check('url', existing.url, want.url)
  check('type', existing.type, want.type)
  check('keyword', existing.keyword_value, want.keyword_value)
  check('keyword_type', existing.keyword_type, want.keyword_type)
  check('interval', existing.interval, want.interval)
  if (existing.timeout !== undefined) check('timeout', existing.timeout, want.timeout)
  if (Number(existing.status) === STATUS_PAUSED) diffs.push('status: paused → running')

  if (contacts !== null) {
    const attached = new Set((existing.alert_contacts ?? []).map((c) => String(c.id)))
    const missing = contacts.filter((id) => !attached.has(String(id)))
    // Extra contacts are left alone: someone may have added a personal channel.
    if (missing.length) diffs.push(`alert contacts: attach ${missing.join(', ')}`)
  }

  return diffs
}

/** newMonitor/editMonitor want `id_threshold_recurrence`, joined by `-`. */
const encodeContacts = (ids) => ids.map((id) => `${id}_0_0`).join('-')

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error(
      'No API key. Set UPTIMEROBOT_API_KEY (or pass --api-key).\n' +
        'UptimeRobot → Settings → API settings → Main API key. A read-only key\n' +
        'can list monitors but cannot create them.',
    )
    process.exit(2)
  }

  const account = await call('getAccountDetails')
  const { email, monitor_limit: limit, up_monitors, down_monitors, paused_monitors } = account.account
  const inUse = (up_monitors ?? 0) + (down_monitors ?? 0) + (paused_monitors ?? 0)
  console.log(`Account: ${email} — ${inUse}/${limit} monitors used\n`)

  // Which contacts to attach. Default is every confirmed contact on the
  // account, which is what docs/monitoring.md prescribes: the same contacts on
  // all three, so no monitor is the one nobody hears about.
  let contactIds = null
  if (!has('no-alert-contacts')) {
    const override = arg('alert-contacts', null)
    if (override) {
      contactIds = override.split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      const all = (await call('getAlertContacts')).alert_contacts ?? []
      const active = all.filter((c) => Number(c.status) === CONTACT_ACTIVE)
      contactIds = active.map((c) => String(c.id))

      const unconfirmed = all.length - active.length
      if (unconfirmed) console.log(`Skipping ${unconfirmed} unconfirmed alert contact(s).`)
      if (!contactIds.length) {
        console.log('⚠ No confirmed alert contacts — monitors will be created but nothing will')
        console.log('  notify you. Add one in UptimeRobot → My Settings, then re-run.\n')
      } else {
        console.log(`Alert contacts: ${active.map((c) => c.friendly_name || c.value).join(', ')}\n`)
      }
    }
  }

  const existing = await fetchMonitors()
  const byName = new Map(existing.map((m) => [m.friendly_name, m]))

  let created = 0
  let fixed = 0
  let drifted = 0
  let failed = 0

  for (const want of MONITORS) {
    const current = byName.get(want.friendly_name)

    // Guard against a monitor that exists under a different name: UptimeRobot
    // rejects a duplicate URL with an error that doesn't say which monitor owns
    // it, which is an unpleasant thing to debug from a stack trace.
    if (!current) {
      const clash = existing.find((m) => m.url === want.url && Number(m.type) === TYPE_KEYWORD)
      if (clash) {
        console.log(`! ${want.friendly_name}`)
        console.log(`    ${want.url}`)
        console.log(`    already monitored as "${clash.friendly_name}" (#${clash.id}).`)
        console.log('    Rename it to match, or delete it, then re-run. Skipping.\n')
        failed++
        continue
      }

      console.log(`+ ${want.friendly_name}`)
      console.log(`    ${want.url}`)
      console.log(`    keyword ${JSON.stringify(want.keyword_value)}, alert when absent, every ${want.interval / 60}m`)
      if (!APPLY) {
        created++
        console.log()
        continue
      }
      try {
        const params = { ...want }
        if (contactIds?.length) params.alert_contacts = encodeContacts(contactIds)
        const res = await call('newMonitor', params)
        console.log(`    created #${res.monitor.id}\n`)
        created++
      } catch (err) {
        console.log(`    FAILED — ${err.message}\n`)
        failed++
      }
      continue
    }

    const diffs = drift(current, want, contactIds)
    if (!diffs.length) {
      console.log(`✓ ${want.friendly_name} (#${current.id}) — as specified\n`)
      continue
    }

    console.log(`~ ${want.friendly_name} (#${current.id}) — drift`)
    for (const d of diffs) console.log(`    ${d}`)

    // A monitor's type is fixed at creation: editMonitor has no `type`
    // parameter. This is the one drift that cannot be repaired in place, and it
    // is the one that matters most — an HTTP(s) monitor on /ready is green
    // through a database outage. Say so plainly rather than sending a field the
    // API ignores and reporting success.
    if (String(current.type) !== String(want.type)) {
      console.log(`    ↑ type cannot be changed after creation. Delete monitor #${current.id}`)
      console.log('      in the dashboard and re-run to recreate it as a keyword monitor.\n')
      failed++
      continue
    }

    if (!APPLY) {
      drifted++
      console.log()
      continue
    }
    try {
      // `type` is deliberately not sent — editMonitor rejects unknown fields.
      const { type, ...editable } = want
      const params = { id: current.id, ...editable }
      if (Number(current.status) === STATUS_PAUSED) params.status = STATUS_RESUME
      if (contactIds?.length) params.alert_contacts = encodeContacts(contactIds)
      await call('editMonitor', params)
      console.log('    fixed\n')
      fixed++
    } catch (err) {
      console.log(`    FAILED — ${err.message}\n`)
      failed++
    }
  }

  if (APPLY) {
    console.log(`Done: ${created} created, ${fixed} fixed, ${failed} failed.`)
    if (created || fixed) {
      console.log(
        '\nOne thing this API cannot set: "Send a notification when the monitor goes\n' +
          'back up". Turn it on per monitor in the dashboard — an alert that never\n' +
          'resolves teaches everyone to ignore alerts.',
      )
    }
    process.exit(failed ? 1 : 0)
  }

  const pending = created + drifted
  console.log(
    pending
      ? `Dry run: ${created} to create, ${drifted} to fix. Re-run with --apply.`
      : 'Dry run: everything matches docs/monitoring.md.',
  )
  process.exit(failed || pending ? 1 : 0)
}

main().catch((err) => {
  console.error(`\n${err.message}`)
  process.exit(1)
})
