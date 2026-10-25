#!/usr/bin/env node
// Prints the CSP source for each inline <script> in a built index.html, one per line:
//
//   node scripts/csp-hashes.mjs apps/web/dist/index.html
//   'sha256-…'
//
// The site's Content-Security-Policy allows exactly these inline scripts and no
// others (prime-tracker-main/infra/terraform/website.tf, website_inline_script_hashes).
// Any edit to an inline script in apps/web/index.html — or to an env value Vite
// substitutes into one — changes its hash, and the list there has to follow.
// scripts/deploy-web-aws.sh runs this and warns when the live header is behind.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/csp-hashes.mjs <index.html>')
  process.exit(2)
}

const html = readFileSync(file, 'utf8')
// Inline only: a <script src=…> is covered by 'self', not by a hash.
for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=/i.test(attrs)) continue
  console.log(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`)
}
