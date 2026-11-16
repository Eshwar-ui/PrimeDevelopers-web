#!/usr/bin/env node
// Keep CloudFront's prerendered-route store in step with a build.
//
//   node scripts/route-store.mjs prune --dist apps/web/dist [--profile prime-client] [--dry-run]
//   node scripts/route-store.mjs add   --dist apps/web/dist [--profile prime-client] [--dry-run]
//
// website_spa (prime-tracker-main/infra/terraform/website.tf) serves
// `<path>/index.html` only for paths that are keys in the store, and the
// root index.html for everything else. So a key must never name a file that
// is not in the bucket — S3 would answer 403 — while a missing key only costs
// that page its own share preview. deploy-web-aws.sh therefore runs:
//
//   1. prune  before any upload: drop keys this build no longer prerenders
//             (their files are still there until the --delete sync).
//   2. add    after the HTML upload: add the keys for files now in the bucket.
//
// The list comes from dist/.prerendered-routes.json, which prerender.mjs writes.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const STORE_NAME = 'prime-tracker-website-routes'
const BATCH = 50 // UpdateKeys accepts at most 50 puts and deletes per call

const [phase] = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DRY = process.argv.includes('--dry-run')
const PROFILE = arg('profile', process.env.AWS_PROFILE || 'prime-client')
const DIST = resolve(arg('dist', 'apps/web/dist'))

if (phase !== 'prune' && phase !== 'add') {
  console.error('usage: node scripts/route-store.mjs <prune|add> --dist <dir> [--profile p] [--dry-run]')
  process.exit(2)
}

const wanted = JSON.parse(readFileSync(join(DIST, '.prerendered-routes.json'), 'utf8'))
if (!Array.isArray(wanted) || wanted.some((p) => typeof p !== 'string' || !p.startsWith('/') || p === '/')) {
  throw new Error('.prerendered-routes.json must be an array of paths like "/about"')
}

const aws = (...args) =>
  JSON.parse(execFileSync('aws', [...args, '--profile', PROFILE, '--output', 'json'], { encoding: 'utf8' }) || 'null')

const arn = aws('cloudfront', 'list-key-value-stores').KeyValueStoreList?.Items?.find((s) => s.Name === STORE_NAME)?.ARN
if (!arn) {
  throw new Error(`No CloudFront KeyValueStore named ${STORE_NAME} — apply the tracker repo's website.tf first.`)
}

const existing = new Set((aws('cloudfront-keyvaluestore', 'list-keys', '--kvs-arn', arn).Items ?? []).map((i) => i.Key))
const changes =
  phase === 'prune'
    ? { deletes: [...existing].filter((k) => !wanted.includes(k)), puts: [] }
    : { deletes: [], puts: wanted.filter((k) => !existing.has(k)) }

const verb = phase === 'prune' ? 'remove' : 'add'
const list = phase === 'prune' ? changes.deletes : changes.puts
console.log(`route store: ${existing.size} keys; ${verb} ${list.length}${list.length ? `: ${list.join(' ')}` : ''}`)
if (DRY || list.length === 0) process.exit(0)

let etag = aws('cloudfront-keyvaluestore', 'describe-key-value-store', '--kvs-arn', arn).ETag
for (let i = 0; i < list.length; i += BATCH) {
  const slice = list.slice(i, i + BATCH)
  const body =
    phase === 'prune'
      ? ['--deletes', JSON.stringify(slice.map((Key) => ({ Key })))]
      : ['--puts', JSON.stringify(slice.map((Key) => ({ Key, Value: '1' })))]
  etag = aws('cloudfront-keyvaluestore', 'update-keys', '--kvs-arn', arn, '--if-match', etag, ...body).ETag
}
