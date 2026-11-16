// What a sharp or multer upgrade must not change (audit task 5,
// tasks/audit-2026-11-15): every allowed upload type is still recognised by its
// bytes, phone photos still come out upright, and a multipart upload still
// parses through Nest's FileInterceptor with its 10 MB limit.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { assertContentMatches } from '../src/modules/uploads/uploads.service';
import { ImageController } from '../src/modules/media/image.controller';

const base = () => sharp({ create: { width: 64, height: 32, channels: 3, background: '#0073a4' } });

test('every allowed image type is recognised by its bytes, AVIF included', async () => {
  const encoded = {
    'image/jpeg': await base().jpeg().toBuffer(),
    'image/png': await base().png().toBuffer(),
    'image/webp': await base().webp().toBuffer(),
    'image/avif': await base().avif().toBuffer(),
  };
  for (const [type, bytes] of Object.entries(encoded)) {
    await assertContentMatches('image', bytes, type);
  }
  // libvips reads AVIF through its HEIF loader; uploads.service relies on that.
  assert.equal((await sharp(encoded['image/avif']).metadata()).format, 'heif');
  await assert.rejects(assertContentMatches('image', encoded['image/avif'], 'image/png'), /not a PNG/);
  await assert.rejects(assertContentMatches('image', encoded['image/webp'], 'image/jpeg'), /not a JPEG/);
});

test('a portrait phone photo (EXIF orientation 6) is resized upright', async () => {
  // Stored 400 wide by 200 tall, tagged "rotate 90° to view": it is a portrait.
  const sideways = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#fca42e' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const controller = new ImageController({ enabled: true, get: async () => sideways } as any);
  let body: Buffer | undefined;
  const res: any = { status: () => res, set: () => res, end: (b: Buffer) => ((body = b), res), redirect: () => {} };

  await controller.resize('images', 'units/601.jpg', '160', '75', { originalUrl: '/api/img/images/units/601.jpg' } as any, res);

  const meta = await sharp(body!).metadata();
  assert.equal(meta.format, 'webp');
  assert.deepEqual([meta.width, meta.height], [160, 320], 'portrait, not sideways');
  assert.equal(meta.orientation, undefined, 'the tag is applied, not carried over');
});

test('a multipart upload parses through FileInterceptor, and over 10 MB is refused', async () => {
  const { NestFactory } = await import('@nestjs/core');
  const { Module } = await import('@nestjs/common');
  const { UploadsController } = await import('../src/modules/uploads/uploads.controller');
  const { UploadsService } = await import('../src/modules/uploads/uploads.service');

  const received: any[] = [];
  const stub = {
    upload: async (kind: string, file: any, folder: string) => {
      received.push({ kind, folder, name: file.originalname, type: file.mimetype, size: file.size, magic: file.buffer.subarray(0, 4).toString('latin1') });
      return { url: 'https://site.test/media/x' };
    },
  };
  @Module({ controllers: [UploadsController], providers: [{ provide: UploadsService, useValue: stub }] })
  class UploadProbe {}

  const app = await NestFactory.create(UploadProbe, { logger: false, abortOnError: false });
  await app.listen(0);
  try {
    const url = `${await app.getUrl()}/uploads/model`;
    const post = (bytes: Buffer) => {
      const form = new FormData();
      form.append('folder', 'properties/centro-plaza/site-model/model');
      form.append('file', new Blob([bytes], { type: 'model/gltf-binary' }), 'site.glb');
      return fetch(url, { method: 'POST', body: form });
    };

    const ok = await post(Buffer.concat([Buffer.from('glTF'), Buffer.alloc(1000)]));
    assert.equal(ok.status, 201);
    assert.deepEqual(received, [
      { kind: 'model', folder: 'properties/centro-plaza/site-model/model', name: 'site.glb', type: 'model/gltf-binary', size: 1004, magic: 'glTF' },
    ]);

    const tooBig = await post(Buffer.alloc(10 * 1024 * 1024 + 1));
    assert.equal(tooBig.status, 413);
    assert.equal(received.length, 1, 'the oversized file never reached the service');
  } finally {
    await app.close();
  }
});
