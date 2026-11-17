// Audit fixes (docs/system-audit-2026-10-24.md): drafts, lead context, brochure
// download cap, refresh-token rotation.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutDrafts } from '../src/modules/content/content.service';
import { flatContextProblem } from '../src/common/validators/flat-context';
import { readCapped } from '../src/modules/leads/leads.service';
import { AuthService } from '../src/modules/auth/auth.service';

test('drafts are removed from public content, nothing else is', () => {
  const section = {
    heading: 'CAP & NNN',
    items: [
      { id: 'a', published: true, price: 1 },
      { id: 'b', published: false, price: 2 },
      { id: 'c', price: 3 }, // no published field: never a draft
    ],
    nested: { list: [{ published: false }, 'plain', 4] },
  };
  assert.deepEqual(withoutDrafts(section as any), {
    heading: 'CAP & NNN',
    items: [{ id: 'a', published: true, price: 1 }, { id: 'c', price: 3 }],
    nested: { list: ['plain', 4] },
  });
});

test('lead context: a flat form answer passes; nesting, size and odd keys do not', () => {
  assert.equal(flatContextProblem({ company: 'Acme', option: 'kitchen-1', units: 2, urgent: true }), null);
  assert.match(flatContextProblem({ a: { b: 1 } }) ?? '', /text, a number/);
  assert.match(flatContextProblem({ a: 'x'.repeat(1001) }) ?? '', /longer than/);
  assert.match(flatContextProblem({ 'bad key': 'x' }) ?? '', /invalid field name/);
  assert.match(flatContextProblem(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 'v']))) ?? '', /at most 20/);
  assert.match(flatContextProblem(['x']) ?? '', /must be an object/);
});

test('brochure download stops at the cap instead of reading the whole file', async () => {
  const small = new Response(new Uint8Array(10));
  assert.equal((await readCapped(small, 100))?.length, 10);

  const declaredTooBig = new Response(new Uint8Array(10), { headers: { 'content-length': '5000' } });
  assert.equal(await readCapped(declaredTooBig, 100), null);

  let pulled = 0;
  const endless = new ReadableStream({
    pull(controller) {
      pulled++;
      controller.enqueue(new Uint8Array(64));
    },
  });
  assert.equal(await readCapped(new Response(endless), 200), null);
  assert.ok(pulled < 10, `read ${pulled} chunks of an endless body`);
});

test('brochure URL: only an absolute https link counts as a brochure', async () => {
  const { brochureUrlFor } = await import('../src/modules/leads/leads.service');
  // Live on 15 Nov 2026: Centro Plaza and POW Lewisville carry the placeholder '#'.
  for (const bad of ['#', '', '   ', '/files/flyer.pdf', 'flyer.pdf', 'http://example.com/a.pdf', 'javascript:alert(1)', 'https://', 'not a url']) {
    assert.equal(brochureUrlFor({ overview: { flyer: bad } }), null, `overview.flyer ${JSON.stringify(bad)}`);
    assert.equal(brochureUrlFor({ resourceLinks: [{ label: 'Brochure', url: bad }] }), null, `named link ${JSON.stringify(bad)}`);
  }
  // A bad flyer does not hide a good link further down the precedence order.
  assert.equal(
    brochureUrlFor({ overview: { flyer: '#' }, resourceLinks: [{ label: 'Brochure', url: 'https://cdn.test/b.pdf' }] }),
    'https://cdn.test/b.pdf',
  );
  // Unchanged precedence for valid links: overview.flyer, then a link named brochure/flyer, then any .pdf.
  assert.equal(brochureUrlFor({ overview: { flyer: ' https://cdn.test/f.pdf ' } }), 'https://cdn.test/f.pdf');
  assert.equal(
    brochureUrlFor({ resourceLinks: [{ label: 'Site plan', url: 'https://cdn.test/plan.pdf' }, { label: 'Flyer', url: 'https://cdn.test/flyer' }] }),
    'https://cdn.test/flyer',
  );
  assert.equal(brochureUrlFor({ resourceLinks: [{ label: 'Site plan', url: 'https://cdn.test/plan.pdf?v=2' }] }), 'https://cdn.test/plan.pdf?v=2');
  assert.equal(brochureUrlFor(null), null);
});

test('a brochure request for a property whose flyer is "#" still emails the visitor', async () => {
  const { LeadsService } = await import('../src/modules/leads/leads.service');
  const sent: any[] = [];
  const prisma: any = {
    property: {
      findUnique: async () => ({
        id: 'p1', name: 'Centro Plaza', slug: 'centro-plaza', address: null, published: true,
        detail: { overview: { flyer: '#' }, resourceLinks: [{ label: 'Brochure', url: '#' }] },
      }),
    },
    websiteLead: { count: async () => 0, create: async () => ({ id: 'lead-1' }) },
  };
  const mail: any = { send: async (message: any) => (sent.push(message), true) };
  const config: any = { get: () => undefined };
  const service = new LeadsService(prisma, mail, config);

  const result = await service.requestBrochure({ name: 'Ana', email: 'ana@example.test', propertyId: 'p1' } as any);

  assert.deepEqual(result, { id: 'lead-1', emailed: true, hasBrochure: false });
  const toVisitor = sent.find((m) => m.to === 'ana@example.test');
  assert.ok(toVisitor, 'the visitor gets the thank-you email');
  assert.equal(toVisitor.attachments, undefined);
  assert.match(toVisitor.text, /send the brochure across shortly/);
});

test('a brochure link pointing at the EC2 metadata service is not fetched, and the visitor is still emailed', async () => {
  const { LeadsService } = await import('../src/modules/leads/leads.service');
  const sent: any[] = [];
  const prisma: any = {
    property: {
      findUnique: async () => ({
        id: 'p1', name: 'Centro Plaza', slug: 'centro-plaza', address: null, published: true,
        detail: { overview: { flyer: 'https://169.254.169.254/latest/meta-data/iam/security-credentials/' } },
      }),
    },
    websiteLead: { count: async () => 0, create: async () => ({ id: 'lead-2' }) },
  };
  const mail: any = { send: async (message: any) => (sent.push(message), true) };
  const service = new LeadsService(prisma, mail, { get: () => undefined } as any);

  const result = await service.requestBrochure({ name: 'Ana', email: 'ana@example.test', propertyId: 'p1' } as any);

  assert.deepEqual(result, { id: 'lead-2', emailed: true, hasBrochure: true });
  const toVisitor = sent.find((m) => m.to === 'ana@example.test');
  assert.equal(toVisitor.attachments, undefined, 'nothing from the metadata service is attached');
});

function authWith(row: any, updateCount = 1) {
  const calls: { updateMany: any[] } = { updateMany: [] };
  const prisma: any = {
    websiteAdminRefreshToken: {
      findUnique: async () => row,
      updateMany: async (args: any) => {
        calls.updateMany.push(args);
        return { count: updateCount };
      },
      create: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
  };
  const jwt: any = { signAsync: async () => 'access' };
  const config: any = { get: (_: string, d: string) => d, getOrThrow: () => 'secret' };
  return { service: new AuthService(prisma, jwt, config), calls };
}

const live = { userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user: { id: 'u1', email: 'a@b.c' } };

test('refresh rotates a live token exactly once', async () => {
  const { service, calls } = authWith(live);
  const pair = await service.refresh('token');
  assert.equal(pair.accessToken, 'access');
  assert.deepEqual(calls.updateMany[0].where.revokedAt, null);
});

test('refresh loses cleanly to a concurrent refresh of the same token', async () => {
  const { service } = authWith(live, 0);
  await assert.rejects(service.refresh('token'), /Invalid or expired/);
});

test('presenting a rotated-away token ends every session of that admin', async () => {
  const { service, calls } = authWith({ ...live, revokedAt: new Date() });
  await assert.rejects(service.refresh('token'), /Invalid or expired/);
  assert.deepEqual(calls.updateMany[0].where, { userId: 'u1', revokedAt: null });
});

test('uploads are checked by their bytes, not the name the browser gave them', async () => {
  const { assertContentMatches } = await import('../src/modules/uploads/uploads.service');
  const sharp = (await import('sharp')).default;
  const realPng = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
  await assertContentMatches('image', realPng, 'image/png');
  await assert.rejects(assertContentMatches('image', Buffer.from('<html><script>x</script></html>'), 'image/png'), /not a PNG/);
  await assert.rejects(assertContentMatches('image', realPng, 'image/jpeg'), /not a JPEG/);
  await assertContentMatches('model', Buffer.from('glTF\x02\x00\x00\x00'), 'model/gltf-binary');
  await assert.rejects(assertContentMatches('model', Buffer.from('PK\x03\x04'), 'model/gltf-binary'), /not a glTF/);
  await assertContentMatches('document', Buffer.from('%PDF-1.7\n'), 'application/pdf');
  await assert.rejects(assertContentMatches('document', Buffer.from('<html>'), 'application/pdf'), /not a PDF/);
});

test('refresh cookie: read from the header, set HttpOnly/Secure/Strict on /api/auth', async () => {
  const { readRefreshCookie, setRefreshCookie, cookieModeEnabled } = await import('../src/modules/auth/refresh-cookie');
  assert.equal(readRefreshCookie({ headers: { cookie: 'a=1; pd_refresh=abc%3D; b=2' } } as any), 'abc=');
  assert.equal(readRefreshCookie({ headers: {} } as any), undefined);
  assert.equal(cookieModeEnabled('true'), true);
  assert.equal(cookieModeEnabled(undefined), false);
  let set: any;
  setRefreshCookie({ cookie: (...args: any[]) => (set = args) } as any, 'tok', '7d');
  assert.equal(set[0], 'pd_refresh');
  assert.deepEqual(
    { httpOnly: set[2].httpOnly, secure: set[2].secure, sameSite: set[2].sameSite, path: set[2].path, maxAge: set[2].maxAge },
    { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000 },
  );
});

test('in cookie mode the refresh token never appears in a response body', async () => {
  const { AuthController } = await import('../src/modules/auth/auth.controller');
  const auth: any = { login: async () => ({ accessToken: 'A', refreshToken: 'R' }) };
  const cookies: any[] = [];
  const res: any = { cookie: (...a: any[]) => cookies.push(a) };
  const on = new AuthController(auth, { get: (k: string, d?: string) => (k === 'REFRESH_COOKIE' ? 'true' : d) } as any);
  assert.deepEqual(await on.login({ email: 'a@b.c', password: 'x'.repeat(8) } as any, res), { accessToken: 'A' });
  assert.equal(cookies[0][1], 'R');
  const off = new AuthController(auth, { get: (_k: string, d?: string) => d } as any);
  assert.deepEqual(await off.login({ email: 'a@b.c', password: 'x'.repeat(8) } as any, res), { accessToken: 'A', refreshToken: 'R' });
});

test('CSP reports: both browser formats reduce to clipped, query-free lines', async () => {
  const { parseCspReports } = await import('../src/modules/csp/csp-report');
  const legacy = JSON.stringify({
    'csp-report': {
      'document-uri': 'https://site.test/properties/centro?ref=mail',
      'violated-directive': 'script-src-elem',
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'https://evil.test/x.js?token=1',
      'line-number': 12,
      'script-sample': 'x'.repeat(500),
    },
  });
  const [one] = parseCspReports(legacy);
  assert.equal(one.directive, 'script-src-elem');
  assert.equal(one.blocked, 'https://evil.test/x.js');
  assert.equal(one.document, 'https://site.test/properties/centro');
  assert.equal(one.line, 12);
  assert.equal(one.sample?.length, 200);

  const modern = Array.from({ length: 50 }, () => ({
    type: 'csp-violation',
    body: { effectiveDirective: 'img-src', blockedURL: 'data', documentURL: 'https://site.test/' },
  }));
  modern.unshift({ type: 'deprecation', body: {} } as any);
  const many = parseCspReports(JSON.stringify(modern));
  assert.equal(many.length, 10);
  assert.deepEqual(many[0], { directive: 'img-src', blocked: 'data', document: 'https://site.test/', source: undefined, line: undefined, sample: undefined });

  assert.deepEqual(parseCspReports('not json'), []);
  assert.deepEqual(parseCspReports(JSON.stringify({ unrelated: true })), []);
});

test('the CSP text parser leaves ordinary JSON bodies parsed', async () => {
  const { NestFactory } = await import('@nestjs/core');
  const { Body, Controller, Module, Post } = await import('@nestjs/common');
  const { CspController } = await import('../src/modules/csp/csp.controller');

  @Controller('echo')
  class EchoController {
    @Post()
    echo(@Body() body: unknown) {
      return { body };
    }
  }
  @Module({ controllers: [EchoController, CspController] })
  class TestModule {}

  const app = await NestFactory.create<any>(TestModule, { rawBody: true, logger: false });
  app.useBodyParser('text', { type: ['application/csp-report', 'application/reports+json'], limit: '16kb' });
  await app.listen(0);
  try {
    const base = await app.getUrl();
    const echo = await fetch(`${base}/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
    assert.deepEqual(await echo.json(), { body: { a: 1 } });
    const report = await fetch(`${base}/csp-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: JSON.stringify({ 'csp-report': { 'violated-directive': 'img-src' } }),
    });
    assert.equal(report.status, 204);
    const tooBig = await fetch(`${base}/csp-report`, { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: 'x'.repeat(20_000) });
    assert.equal(tooBig.status, 413);
  } finally {
    await app.close();
  }
});

// ── Spam retention (1 Nov security audit L6) ───────────────────────────────
test('the spam purge deletes only spam-flagged leads older than 30 days', async () => {
  const { LeadRetention, SPAM_RETENTION_DAYS } = await import('../src/modules/leads/lead-retention');
  let where: any;
  const prisma: any = { websiteLead: { deleteMany: async (args: any) => ((where = args.where), { count: 2 }) } };
  const now = Date.parse('2026-11-16T00:00:00Z');
  assert.equal(await new LeadRetention(prisma).purgeSpam(now), 2);
  assert.equal(SPAM_RETENTION_DAYS, 30);
  assert.deepEqual(where, { spam: true, createdAt: { lt: new Date('2026-10-17T00:00:00Z') } });
});

// ── no-store on admin and auth responses (1 Nov security audit L3) ─────────
test('admin and auth responses get no-store; public ones are left alone', async () => {
  const { NoStoreInterceptor } = await import('../src/common/no-store.interceptor');
  const run = (isPublic: boolean, path: string) => {
    const headers: Record<string, string> = {};
    const reflector: any = { getAllAndOverride: () => isPublic };
    const res = { headersSent: false, setHeader: (k: string, v: string) => (headers[k] = v) };
    const ctx: any = {
      getType: () => 'http',
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ path }), getResponse: () => res }),
    };
    new NoStoreInterceptor(reflector).intercept(ctx, { handle: () => null as any });
    return headers['Cache-Control'];
  };
  assert.equal(run(false, '/api/admin/leads'), 'private, no-store');
  assert.equal(run(true, '/api/auth/login'), 'private, no-store');
  assert.equal(run(true, '/api/properties'), undefined);
});

test('admin, auth and upload paths say no-store before any guard runs, refusals included', async () => {
  const { noStoreForPrivatePaths } = await import('../src/common/no-store.interceptor');
  const run = (path: string) => {
    const headers: Record<string, string> = {};
    let called = false;
    noStoreForPrivatePaths({ path }, { setHeader: (k, v) => (headers[k] = v) }, () => (called = true));
    assert.equal(called, true);
    return headers['Cache-Control'];
  };
  for (const p of ['/api/admin/leads', '/api/admin', '/api/auth/login', '/api/uploads/image']) assert.equal(run(p), 'private, no-store', p);
  for (const p of ['/api/properties', '/api/administrator', '/api/img/images/a.jpg', '/']) assert.equal(run(p), undefined, p);
});
