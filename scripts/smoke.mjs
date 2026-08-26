/**
 * End-to-end smoke test for the public site.
 *
 * Drives a real Chrome over every route × both themes × desktop and mobile, and
 * fails on the things that actually break a page in production rather than on
 * anything a snapshot would notice. No test framework and no npm dependency:
 * it speaks the DevTools protocol over the WebSocket that ships with Node, so
 * it runs anywhere the repo is checked out.
 *
 *   node scripts/smoke.mjs                      # against a running dev server
 *   node scripts/smoke.mjs --url http://…       # against a preview build or prod
 *   node scripts/smoke.mjs --routes /,/about    # narrow it while fixing one thing
 *
 * Exits non-zero if anything fails, so it can gate a deploy.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

// ── config ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const BASE = arg('url', 'http://localhost:5178').replace(/\/$/, '')
const PORT = Number(arg('port', 9777))
const HEADFUL = args.includes('--headful')

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

/**
 * Real slugs, not invented ones. A test that visits /properties/example proves
 * only that the not-found path works.
 */
const ROUTES = arg('routes', [
  '/',
  '/about',
  '/enterprise',
  '/properties',
  '/properties/pow-lewisville-phase-i',
  '/properties/pow-lewisville-phase-ii',
  '/news',
  '/news/welcome-to-the-prime-developers-journal',
  '/contact',
].join(',')).split(',').map((r) => r.trim()).filter(Boolean)

// Routes that must degrade rather than crash. These are the ones a real visitor
// reaches from a stale link or a typo, and the ones nobody clicks while testing.
const NOT_FOUND_ROUTES = ['/properties/no-such-property', '/news/no-such-post', '/totally-unknown']

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]
const THEMES = ['light', 'dark']

// Console noise that is not ours to fix, and not a defect.
const IGNORED = [
  /Reduced Motion enabled/i,
  /React DevTools/i,
  /Download the React DevTools/i,
  /\[vite\] connect/i,
  /favicon\.ico/i,
]

// ── tiny CDP client ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!found) {
    console.error('Could not find Chrome. Set CHROME_PATH to the executable.')
    process.exit(2)
  }
  return found
}

async function connect(chromePath) {
  const chrome = spawn(chromePath, [
    HEADFUL ? '--headless=false' : '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP || '/tmp'}/prime-smoke-${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' })

  let targets
  for (let i = 0; i < 80; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      if (targets.some((t) => t.type === 'page')) break
    } catch { /* not up yet */ }
    await sleep(250)
  }
  const page = targets?.find((t) => t.type === 'page')
  if (!page) {
    chrome.kill()
    throw new Error('Chrome did not expose a page target')
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  let id = 0
  const pending = new Map()
  const listeners = []
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
    } else if (msg.method) {
      listeners.forEach((fn) => fn(msg))
    }
  }
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })

  return { send, on: (fn) => listeners.push(fn), close: () => { ws.close(); chrome.kill() } }
}

// ── the checks ─────────────────────────────────────────────────────────────
/**
 * Everything that can only be judged inside the page. Returned as data so the
 * failure message can name the offending element rather than just the rule.
 */
const AUDIT = `(() => {
  const out = { overflow: null, images: [], headings: null, emptyLinks: [], tinyTargets: [] }

  const doc = document.documentElement
  if (doc.scrollWidth > doc.clientWidth + 1) {
    // Name the widest offender — "the page scrolls sideways" is not actionable.
    let worst = null
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.right > doc.clientWidth + 1 && (!worst || r.right > worst.right)) {
        worst = { right: Math.round(r.right), tag: el.tagName.toLowerCase(),
                  cls: (el.className && String(el.className).slice(0, 70)) || '' }
      }
    }
    out.overflow = { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, worst }
  }

  for (const img of document.images) {
    const broken = img.complete && img.naturalWidth === 0
    const noAlt = !img.hasAttribute('alt')
    if (broken || noAlt) {
      out.images.push({ src: (img.currentSrc || img.src || '').slice(-80), broken, noAlt })
    }
  }

  const h1s = document.querySelectorAll('h1')
  out.headings = { h1Count: h1s.length }

  for (const a of document.querySelectorAll('a[href]')) {
    const labelled = a.textContent.trim() || a.getAttribute('aria-label') || a.querySelector('img[alt]:not([alt=""])')
    if (!labelled) out.emptyLinks.push((a.getAttribute('href') || '').slice(0, 60))
  }

  return JSON.stringify(out)
})()`

const failures = []
const fail = (where, message, detail) => failures.push({ where, message, detail })

/**
 * One listener for the whole run, writing into whichever bucket is current.
 *
 * Attaching a fresh listener per page and removing it afterwards is the obvious
 * shape and it was wrong: the removals raced the in-flight events, so errors
 * from one page were still landing in the next page's tally and every count
 * after the first was inflated. A single sink with a swappable bucket cannot
 * drift.
 */
let bucket = null
const newBucket = (expectNotFound) => ({
  consoleErrors: [], pageErrors: [], failedRequests: [], urls: new Map(), expectNotFound,
})

function attachSink(cdp) {
  cdp.on((msg) => {
    if (!bucket) return

    if (msg.method === 'Network.requestWillBeSent') {
      bucket.urls.set(msg.params.requestId, msg.params.request.url)
      return
    }

    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
      if (text && !IGNORED.some((re) => re.test(text))) bucket.consoleErrors.push(text.slice(0, 200))
    }

    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      bucket.pageErrors.push((d.exception?.description || d.text || 'exception').slice(0, 200))
    }

    if (msg.method === 'Network.loadingFailed') {
      const url = bucket.urls.get(msg.params.requestId) || '(unknown url)'
      // ERR_ABORTED is what a request in flight becomes when the next navigation
      // starts, and this harness navigates constantly. It says nothing about the
      // page — a genuinely missing asset surfaces as a 404 response instead.
      const cancelled = /ERR_ABORTED/.test(msg.params.errorText)
      if (!cancelled) bucket.failedRequests.push(`${msg.params.errorText} ${url.slice(-90)}`)
    }

    if (msg.method === 'Network.responseReceived') {
      const { status, url: u } = msg.params.response
      // The API's own 404 for an unknown slug is *how* not-found is reached, so
      // it is expected on exactly those routes.
      if (status >= 400 && !(bucket.expectNotFound && status === 404)) {
        bucket.failedRequests.push(`HTTP ${status} ${u.slice(-90)}`)
      }
    }
  })
}

async function visit(cdp, { url, theme, viewport, expectNotFound = false }) {
  const where = `${url.replace(BASE, '') || '/'}  ${theme}/${viewport.name}`
  bucket = newBucket(expectNotFound)
  const { consoleErrors, pageErrors, failedRequests } = bucket

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
  })
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: theme },
      // Reveals rest at their final state, so a section that never un-hides is a
      // real failure rather than a timing artefact of the screenshot.
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ],
  })

  await cdp.send('Page.navigate', { url })
  await sleep(4500)

  const { result } = await cdp.send('Runtime.evaluate', { expression: AUDIT, returnByValue: false })
  let audit = {}
  try { audit = JSON.parse(result.value) } catch { fail(where, 'page did not evaluate — likely a render crash'); return }

  if (pageErrors.length) fail(where, 'uncaught exception', pageErrors[0])
  if (consoleErrors.length) fail(where, `${consoleErrors.length} console error(s)`, consoleErrors[0])
  if (failedRequests.length) fail(where, `${failedRequests.length} failed request(s)`, failedRequests[0])

  if (audit.overflow) {
    fail(where, `horizontal overflow (${audit.overflow.scrollWidth} > ${audit.overflow.clientWidth})`,
      audit.overflow.worst ? `${audit.overflow.worst.tag}.${audit.overflow.worst.cls}` : '')
  }
  const broken = audit.images.filter((i) => i.broken)
  if (broken.length) fail(where, `${broken.length} broken image(s)`, broken[0].src)
  const noAlt = audit.images.filter((i) => i.noAlt)
  if (noAlt.length) fail(where, `${noAlt.length} image(s) with no alt attribute`, noAlt[0].src)

  if (audit.headings.h1Count === 0) fail(where, 'no <h1> on the page')
  if (audit.headings.h1Count > 1) fail(where, `${audit.headings.h1Count} <h1> elements — should be one`)
  if (audit.emptyLinks.length) fail(where, `${audit.emptyLinks.length} link(s) with no accessible name`, audit.emptyLinks[0])

  bucket = null
}

async function main() {
  console.log(`\nSmoke test → ${BASE}\n${'─'.repeat(60)}`)
  const cdp = await connect(findChrome())
  attachSink(cdp)

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Network.enable')

  let checks = 0
  for (const route of ROUTES) {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        process.stdout.write(`  ${route} · ${theme} · ${viewport.name}`.padEnd(56))
        const before = failures.length
        await visit(cdp, { url: `${BASE}${route}`, theme, viewport })
        checks++
        console.log(failures.length === before ? 'ok' : 'FAIL')
      }
    }
  }

  console.log(`\n  not-found handling`)
  for (const route of NOT_FOUND_ROUTES) {
    process.stdout.write(`  ${route}`.padEnd(56))
    const before = failures.length
    await visit(cdp, {
      url: `${BASE}${route}`, theme: 'light', viewport: VIEWPORTS[0], expectNotFound: true,
    })
    checks++
    console.log(failures.length === before ? 'ok' : 'FAIL')
  }

  cdp.close()

  console.log(`\n${'─'.repeat(60)}`)
  if (!failures.length) {
    console.log(`✓ ${checks} checks passed\n`)
    process.exit(0)
  }
  console.log(`✗ ${failures.length} failure(s) across ${checks} checks\n`)
  for (const f of failures) {
    console.log(`  ${f.where}\n    ${f.message}${f.detail ? `\n    ${f.detail}` : ''}\n`)
  }
  process.exit(1)
}

main().catch((err) => { console.error(err); process.exit(2) })
