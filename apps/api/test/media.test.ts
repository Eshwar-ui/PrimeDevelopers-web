// The AWS replacement for Supabase's image render endpoint.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ImageController } from '../src/modules/media/image.controller';

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 115, b: 164, alpha: 1 } } })
    .png()
    .toBuffer();

function harness(object: Buffer | null, enabled = true) {
  const media: any = { enabled, get: async () => object };
  const controller = new ImageController(media);
  const sent: { status?: number; headers?: Record<string, string>; body?: Buffer } = {};
  const res: any = {
    status(code: number) { sent.status = code; return res; },
    set(headers: Record<string, string>) { sent.headers = headers; return res; },
    end(body: Buffer) { sent.body = body; return res; },
  };
  return { controller, res, sent };
}

test('scales proportionally to the requested width and returns WebP', async () => {
  const { controller, res, sent } = harness(await png(2700, 1800));
  await controller.resize('images', 'site/hero.png', '1200', '75', res);
  const meta = await sharp(sent.body!).metadata();
  assert.equal(meta.format, 'webp');
  assert.deepEqual([meta.width, meta.height], [1200, 800]);
  assert.equal(sent.headers!['Content-Type'], 'image/webp');
  assert.match(sent.headers!['Cache-Control'], /immutable/);
});

test('never enlarges a small original — the 150px logos stay 150px', async () => {
  const { controller, res, sent } = harness(await png(150, 60));
  await controller.resize('images', 'logos/a.png', '600', undefined, res);
  assert.equal((await sharp(sent.body!).metadata()).width, 150);
});

test('refuses other buckets, path traversal, missing objects and a disabled driver', async () => {
  const image = await png(10, 10);
  await assert.rejects(harness(image).controller.resize('models', 'a.glb', '100', undefined, harness(image).res), /Not Found/);
  await assert.rejects(harness(image).controller.resize('images', '../secret', '100', undefined, harness(image).res), /Bad image path/);
  await assert.rejects(harness(null).controller.resize('images', 'gone.png', '100', undefined, harness(null).res), /Not Found/);
  await assert.rejects(harness(image, false).controller.resize('images', 'a.png', '100', undefined, harness(image, false).res), /Not Found/);
});
