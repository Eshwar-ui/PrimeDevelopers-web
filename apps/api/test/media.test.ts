// The AWS replacement for Supabase's image render endpoint.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
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
  const media: any = { enabled, get: async () => object };
  const controller = new ImageController(media);
  const sent: { status?: number; headers?: Record<string, string>; body?: Buffer; redirect?: [number, string] } = {};
  const res: any = {
    status(code: number) { sent.status = code; return res; },
    set(headers: Record<string, string>) { sent.headers = headers; return res; },
    end(body: Buffer) { sent.body = body; return res; },
    redirect(code: number, url: string) { sent.redirect = [code, url]; },
  };
  const req: any = { originalUrl: '/api/img/images/site/hero.png?width=1000' };
  return { controller, req, res, sent };
}

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
