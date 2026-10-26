// The AWS replacement for Supabase's image render endpoint.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  BusyResizing,
  Gate,
  ImageController,
  WIDTH_LADDER,
  canonicalQuality,
  canonicalWidth,
} from '../src/modules/media/image.controller';

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 115, b: 164, alpha: 1 } } })
    .png()
    .toBuffer();

function harness(object: Buffer | null, enabled = true) {
  const media: any = { enabled, reads: 0, get: async () => (media.reads++, object) };
  const controller = new ImageController(media);
  const sent: { status?: number; headers?: Record<string, string>; body?: Buffer; redirect?: [number, string] } = {};
  const res: any = {
    status(code: number) { sent.status = code; return res; },
    set(headers: Record<string, string>) { sent.headers = headers; return res; },
    end(body: Buffer) { sent.body = body; return res; },
    redirect(code: number, url: string) { sent.redirect = [code, url]; },
  };
  const req: any = { originalUrl: '/api/img/images/site/hero.png?width=1000' };
  return { controller, req, res, sent, media };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('scales proportionally to a ladder width and returns WebP', async () => {
  const { controller, req, res, sent } = harness(await png(2700, 1800));
  await controller.resize('images', 'site/hero.png', '1200', '75', req, res);
  const meta = await sharp(sent.body!).metadata();
  assert.equal(meta.format, 'webp');
  assert.deepEqual([meta.width, meta.height], [1200, 800]);
  assert.equal(sent.headers!['Content-Type'], 'image/webp');
  assert.match(sent.headers!['Cache-Control'], /immutable/);
});

test('never enlarges a small original — the 150px logos stay 150px', async () => {
  const { controller, req, res, sent } = harness(await png(150, 60));
  await controller.resize('images', 'logos/a.png', '600', '75', req, res);
  assert.equal((await sharp(sent.body!).metadata()).width, 150);
});

test('an off-ladder width or quality is redirected, never rendered', async () => {
  const { controller, req, res, sent } = harness(await png(10, 10));
  await controller.resize('images', 'site/hero.png', '1000', '80', req, res);
  assert.deepEqual(sent.redirect, [308, '/api/img/images/site/hero.png?width=1200&quality=75']);
  assert.equal(sent.body, undefined);
});

test('widths snap up the ladder and stop at its top; qualities snap to the nearest', () => {
  assert.equal(canonicalWidth('1'), 160);
  assert.equal(canonicalWidth('961'), 1200);
  assert.equal(canonicalWidth('99999'), 1920);
  assert.equal(canonicalWidth('abc'), 1920);
  assert.equal(canonicalQuality('100'), 90);
  assert.equal(canonicalQuality(undefined), 75);
  for (const w of WIDTH_LADDER) assert.equal(canonicalWidth(String(w)), w);
});

test('refuses other buckets, path traversal, missing objects and a disabled driver', async () => {
  const image = await png(10, 10);
  const h = harness(image);
  await assert.rejects(h.controller.resize('models', 'a.glb', '200', '75', h.req, h.res), /Not Found/);
  await assert.rejects(h.controller.resize('images', '../secret', '200', '75', h.req, h.res), /Bad image path/);
  const gone = harness(null);
  await assert.rejects(gone.controller.resize('images', 'gone.png', '200', '75', gone.req, gone.res), /Not Found/);
  const off = harness(image, false);
  await assert.rejects(off.controller.resize('images', 'a.png', '200', '75', off.req, off.res), /Not Found/);
});

test('a file that is not an image is a 422, not a server error', async () => {
  const h = harness(Buffer.from('not an image'));
  await assert.rejects(h.controller.resize('images', 'x.png', '200', '75', h.req, h.res), /Cannot resize/);
});

test('a cold page worth of resizes at once all succeed — none turned away', async () => {
  // The partner wall alone is 20 logos; the first gate's line of 8 broke the rest.
  const image = await png(300, 120);
  const results = await Promise.all(
    Array.from({ length: 30 }, async () => {
      const h = harness(image);
      await h.controller.resize('images', 'logos/a.png', '200', '75', h.req, h.res);
      return h.sent.status;
    }),
  );
  assert.deepEqual(new Set(results), new Set([200]));
});

test('the gate never runs more than its limit, even as slots pass between jobs', async () => {
  const gate = new Gate({ active: 2, waiting: 100, waitMs: 5_000 });
  let running = 0;
  let peak = 0;
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      gate.run(async () => {
        peak = Math.max(peak, ++running);
        await sleep(i % 3);
        running--;
      }),
    ),
  );
  assert.equal(peak, 2);
  assert.deepEqual(gate.load, { active: 0, waiting: 0 });
});

test('a full line, or a wait past the deadline, is refused as busy and frees its place', async () => {
  const gate = new Gate({ active: 1, waiting: 1, waitMs: 40 });
  let release!: () => void;
  const holder = gate.run(() => new Promise<void>((r) => (release = r)));
  const waiter = gate.run(async () => 'late');
  await assert.rejects(gate.run(async () => 'no room'), BusyResizing);
  await assert.rejects(waiter, BusyResizing); // timed out in line
  assert.deepEqual(gate.load, { active: 1, waiting: 0 });
  release();
  await holder;
  assert.deepEqual(gate.load, { active: 0, waiting: 0 });
  assert.equal(await gate.run(async () => 'next'), 'next');
});

test('when busy: 503 with Retry-After, not cached, and the original is never fetched', async () => {
  const h = harness(await png(10, 10));
  (h.controller as any).gate = new Gate({ active: 0, waiting: 0, waitMs: 1 });
  await assert.rejects(h.controller.resize('images', 'site/hero.png', '1200', '75', h.req, h.res), BusyResizing);
  assert.deepEqual(h.sent.headers, { 'Retry-After': '5', 'Cache-Control': 'no-store' });
  assert.equal(h.media.reads, 0);
});
