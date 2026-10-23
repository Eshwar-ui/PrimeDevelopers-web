import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Uploaded media on AWS: the website bucket's `media/` prefix, served by the same
 * CloudFront distribution as the site itself (prime-tracker-main's website.tf).
 *
 * A key mirrors the Supabase layout it replaces — `media/<bucket>/<path>` for what
 * was `<bucket>/<path>` in Supabase Storage — so moving a stored URL from one to
 * the other is a prefix swap and nothing else.
 *
 * On only when STORAGE_DRIVER=s3. Credentials come from the SDK's provider chain:
 * on the EC2 host that is the instance role, so there is no key to store.
 */
@Injectable()
export class MediaStorage {
  private client: S3Client | null = null;

  constructor(private config: ConfigService) {}

  get enabled(): boolean {
    return this.config.get<string>('STORAGE_DRIVER') === 's3';
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

  /** Where a visitor fetches the object: MEDIA_PUBLIC_BASE is the site's own origin. */
  publicUrl(bucket: string, path: string): string {
    const base = this.config.getOrThrow<string>('MEDIA_PUBLIC_BASE').replace(/\/+$/, '');
    return `${base}/${this.key(bucket, path)}`;
  }

  async put(bucket: string, path: string, body: Buffer, contentType: string, cacheControl: string) {
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
    try {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(bucket, path) }));
      return out.Body ? Buffer.from(await out.Body.transformToByteArray()) : null;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }
}
