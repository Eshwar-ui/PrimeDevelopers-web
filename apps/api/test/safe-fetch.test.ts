// The brochure fetch (audit task 2, tasks/audit-2026-11-15): a CMS-supplied URL
// is fetched server-side and its body mailed to an address the requester picks,
// so it must not reach private addresses, follow redirects into them, or attach
// anything but a real PDF.
//
// The transport is injected: a plain local HTTP server stands in for the
// brochure host, and a fake DNS maps test hostnames onto it. The URLs stay
// https:, because that check is part of what is under test.
//
//   pnpm --filter @prime-developers/api test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { fetchPublicPdf, isBlockedAddress } from '../src/modules/leads/safe-fetch';

const PDF = Buffer.from('%PDF-1.7\n% brochure\n');

let hits: string[] = [];
const server = http.createServer((req, res) => {
  hits.push(`${req.headers.host} ${req.url}`);
  const route: Record<string, () => void> = {
    '/brochure.pdf': () => res.writeHead(200, { 'content-type': 'application/pdf' }).end(PDF),
    '/flyer%20v2.pdf': () => res.writeHead(200, { 'content-type': 'application/pdf; charset=binary' }).end(PDF),
    '/no-extension': () => res.writeHead(200, { 'content-type': 'application/pdf' }).end(PDF),
    '/page': () => res.writeHead(200, { 'content-type': 'text/html' }).end('<html>LoopNet listing</html>'),
    '/fake.pdf': () => res.writeHead(200, { 'content-type': 'application/pdf' }).end('<html>not a pdf</html>'),
    '/huge.pdf': () => res.writeHead(200, { 'content-type': 'application/pdf' }).end(Buffer.concat([PDF, Buffer.alloc(5000)])),
    '/missing.pdf': () => res.writeHead(404).end(),
    '/to-relative': () => res.writeHead(302, { location: '/brochure.pdf' }).end(),
    '/to-private': () => res.writeHead(302, { location: `https://evil.test:${port()}/brochure.pdf` }).end(),
    '/to-http': () => res.writeHead(301, { location: `http://brochure.test:${port()}/brochure.pdf` }).end(),
    '/loop': () => res.writeHead(307, { location: '/loop' }).end(),
    '/hang': () => {}, // never answers
  };
  (route[req.url ?? ''] ?? (() => res.writeHead(404).end()))();
});
// A hook, not top-level await: that would make Node load this file as an ES
// module, which cannot resolve the extensionless TypeScript imports.
before(() => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve)));
after(() => {
  server.closeAllConnections();
  server.close();
});
const port = () => (server.address() as AddressInfo).port;

/** brochure.test is the local server; evil.test is a private address. */
const DNS: Record<string, string> = { 'brochure.test': '127.0.0.1', 'evil.test': '10.0.0.5' };
const fakeLookup = (hostname: string, options: any, callback: any) => {
  const address = DNS[hostname];
  if (!address) return callback(Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }));
  return options?.all ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4);
};
/** The real block list, except for the local test server itself. */
const allowTestServer = (ip: string) => ip !== '127.0.0.1' && isBlockedAddress(ip);

const fetchLocal = (path: string, opts: Record<string, unknown> = {}) => {
  hits = [];
  return fetchPublicPdf(`https://brochure.test:${port()}${path}`, {
    maxBytes: 1024,
    timeoutMs: 2000,
    request: http.request,
    lookup: fakeLookup,
    isBlocked: allowTestServer,
    ...opts,
  });
};

test('the block list covers private, loopback, link-local, CGNAT, ULA and mapped addresses', () => {
  const blocked = [
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '127.8.8.8', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '192.0.0.8', '198.18.0.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '2001:db8::1',
    '::ffff:127.0.0.1', '::ffff:169.254.169.254', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe',
  ];
  for (const ip of blocked) assert.equal(isBlockedAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.128.0.1', '2606:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
  assert.equal(isBlockedAddress('not an ip'), true, 'anything unparseable is refused');
});

test('a real PDF from a public host is returned with its filename', async () => {
  const result = await fetchLocal('/brochure.pdf');
  assert.deepEqual(result, { ok: true, body: PDF, filename: 'brochure.pdf' });
  assert.equal((await fetchLocal('/flyer%20v2.pdf') as any).filename, 'flyer v2.pdf');
  assert.equal((await fetchLocal('/no-extension') as any).filename, 'no-extension.pdf');
});

test('a host that resolves to a private address is refused before any request is sent', async () => {
  const result = await fetchLocal('/brochure.pdf', { isBlocked: isBlockedAddress });
  assert.equal(result.ok, false);
  assert.match((result as any).reason, /private|blocked/i);
  assert.deepEqual(hits, [], 'nothing reached the server');
});

test('an IP literal in a blocked range is refused without connecting', async () => {
  for (const url of ['https://169.254.169.254/latest/meta-data/', 'https://127.0.0.1/a.pdf', 'https://[::1]/a.pdf', 'https://10.0.0.1/a.pdf']) {
    const result = await fetchPublicPdf(url, { maxBytes: 1024, timeoutMs: 2000 });
    assert.equal(result.ok, false, url);
    assert.match((result as any).reason, /private|blocked/i, url);
  }
});

test('only https URLs are fetched', async () => {
  for (const url of ['http://example.com/a.pdf', 'ftp://example.com/a.pdf', 'file:///etc/passwd', '#', 'not a url']) {
    const result = await fetchPublicPdf(url, { maxBytes: 1024, timeoutMs: 2000 });
    assert.equal(result.ok, false, url);
  }
});

test('redirects are followed only to public https targets, at most three times', async () => {
  assert.equal((await fetchLocal('/to-relative')).ok, true, 'a relative redirect on the same host is fine');

  const toPrivate = await fetchLocal('/to-private');
  assert.equal(toPrivate.ok, false);
  assert.match((toPrivate as any).reason, /private|blocked/i);
  assert.equal(hits.length, 1, 'the private target was never requested');

  const toHttp = await fetchLocal('/to-http');
  assert.equal(toHttp.ok, false);
  assert.match((toHttp as any).reason, /https/i);

  const loop = await fetchLocal('/loop');
  assert.equal(loop.ok, false);
  assert.match((loop as any).reason, /redirect/i);
  assert.equal(hits.length, 4, 'the first request and three redirects, then it stops');
});

test('only a real PDF is attached', async () => {
  const page = await fetchLocal('/page');
  assert.equal(page.ok, false, 'a web page is not a brochure');
  assert.match((page as any).reason, /text\/html/);

  const fake = await fetchLocal('/fake.pdf');
  assert.equal(fake.ok, false, 'a PDF content type over non-PDF bytes is refused');
  assert.match((fake as any).reason, /not a PDF/i);

  const missing = await fetchLocal('/missing.pdf');
  assert.equal(missing.ok, false);
  assert.match((missing as any).reason, /404/);
});

test('the size cap and the timeout still hold', async () => {
  const huge = await fetchLocal('/huge.pdf');
  assert.equal(huge.ok, false);
  assert.match((huge as any).reason, /larger than/i);

  const started = Date.now();
  const hang = await fetchLocal('/hang', { timeoutMs: 200 });
  assert.equal(hang.ok, false);
  assert.match((hang as any).reason, /timed out/i);
  assert.ok(Date.now() - started < 2000, 'gave up at the deadline');
});

test('a DNS failure is a refusal, not a throw', async () => {
  const result = await fetchPublicPdf('https://nowhere.test/a.pdf', { maxBytes: 1024, timeoutMs: 2000, lookup: fakeLookup });
  assert.equal(result.ok, false);
});
