import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

/**
 * Where uploaded media lives.
 *
 * - `STORAGE_DRIVER=s3` (production): the website bucket's `media/` prefix, served
 *   by the same CloudFront distribution as the site (prime-tracker-main's
 *   website.tf). Credentials come from the SDK's provider chain: on the EC2 host
 *   that is the instance role, so there is no key to store.
 * - anything else (development, tests): a folder on disk, `MEDIA_LOCAL_DIR`
 *   (default `apps/api/.media`), which main.ts serves at `/media`. Uploads and
 *   the `/api/img` resizer then work locally with no cloud account.
 *
 * Both use the same key, `media/<bucket>/<path>`, so a stored URL moves between
 * them by swapping the origin and nothing else.
 */
@Injectable()
export class MediaStorage {
  private client: S3Client | null = null;

  constructor(private config: ConfigService) {}

  get driver(): 's3' | 'local' {
    return this.config.get<string>('STORAGE_DRIVER') === 's3' ? 's3' : 'local';
  }

  /** Always true now: there is no configuration in which uploads are off. */
  get enabled(): boolean {
    return true;
  }

  /** The folder the local driver writes to; main.ts serves it at /media. */
  get localDir(): string {
    return resolve(this.config.get<string>('MEDIA_LOCAL_DIR') ?? '.media');
  }

  private get s3(): S3Client {
    this.client ??= new S3Client({ region: this.config.get<string>('AWS_REGION') ?? 'us-east-1' });
    return this.client;
  }

  private get bucket(): string {
    return this.config.getOrThrow<string>('S3_BUCKET');
  }

  key(bucket: string, path: string): string {
    return `media/${bucket}/${path}`;
  }

  /**
   * Where a visitor fetches the object. In production MEDIA_PUBLIC_BASE is the
   * site's own origin; locally it defaults to this API, which serves /media.
   */
  publicUrl(bucket: string, path: string): string {
    const fallback = `http://localhost:${this.config.get<string>('PORT') ?? this.config.get<string>('API_PORT') ?? 3001}`;
    const base = (this.config.get<string>('MEDIA_PUBLIC_BASE') ?? (this.driver === 's3' ? undefined : fallback))?.replace(/\/+$/, '');
    if (!base) throw new Error('MEDIA_PUBLIC_BASE is required with STORAGE_DRIVER=s3');
    return `${base}/${this.key(bucket, path)}`;
  }

  /** A file under localDir for `media/<bucket>/<path>`, refusing anything that would leave it. */
  private localFile(bucket: string, path: string): string {
    const root = this.localDir;
    const file = resolve(root, `${bucket}/${path}`);
    if (!file.startsWith(root + sep)) throw new Error(`Refusing media path outside ${root}: ${bucket}/${path}`);
    return file;
  }

  async put(bucket: string, path: string, body: Buffer, contentType: string, cacheControl: string) {
    if (this.driver === 'local') {
      const file = this.localFile(bucket, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body, { flag: 'wx' }); // never overwrite, as S3 uploads never do
      return this.publicUrl(bucket, path);
    }
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(bucket, path),
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
    return this.publicUrl(bucket, path);
  }

  /** The object's bytes, or null when there is no such object. */
  async get(bucket: string, path: string): Promise<Buffer | null> {
    if (this.driver === 'local') {
      try {
        return await readFile(this.localFile(bucket, path));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    }
    try {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(bucket, path) }));
      return out.Body ? Buffer.from(await out.Body.transformToByteArray()) : null;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }
}
