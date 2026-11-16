// MediaStorage's local driver (development, no cloud): uploads land in a folder,
// come back by key, never overwrite, and cannot escape the folder.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaStorage } from '../src/modules/media/media-storage';

function storage(env: Record<string, string | undefined>) {
  return new MediaStorage({ get: (k: string) => env[k], getOrThrow: (k: string) => env[k] } as any);
}

test('without STORAGE_DRIVER=s3, uploads go to a local folder and read back', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'media-'));
  try {
    const media = storage({ MEDIA_LOCAL_DIR: dir, API_PORT: '3001' });
    assert.equal(media.driver, 'local');
    assert.equal(media.enabled, true);
    const url = await media.put('images', 'units/601.jpg', Buffer.from('jpeg'), 'image/jpeg', 'public, max-age=1');
    assert.equal(url, 'http://localhost:3001/media/images/units/601.jpg');
    assert.equal((await media.get('images', 'units/601.jpg'))?.toString(), 'jpeg');
    assert.equal(await media.get('images', 'units/missing.jpg'), null);
    await assert.rejects(media.put('images', 'units/601.jpg', Buffer.from('x'), 'image/jpeg', ''), /EEXIST/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a path cannot leave the local folder', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'media-'));
  try {
    const media = storage({ MEDIA_LOCAL_DIR: dir });
    await assert.rejects(media.put('images', '../../escape.txt', Buffer.from('x'), 'text/plain', ''), /outside/);
    await assert.rejects(media.get('images', '../../../etc/passwd'), /outside/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('STORAGE_DRIVER=s3 still requires MEDIA_PUBLIC_BASE and uses the site origin', () => {
  assert.equal(storage({ STORAGE_DRIVER: 's3', MEDIA_PUBLIC_BASE: 'https://site.test/' }).publicUrl('images', 'a.jpg'), 'https://site.test/media/images/a.jpg');
  assert.throws(() => storage({ STORAGE_DRIVER: 's3' }).publicUrl('images', 'a.jpg'), /MEDIA_PUBLIC_BASE/);
});
