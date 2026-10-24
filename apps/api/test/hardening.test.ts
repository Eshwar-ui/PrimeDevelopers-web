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
