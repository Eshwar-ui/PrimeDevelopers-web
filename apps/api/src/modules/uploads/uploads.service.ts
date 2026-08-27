import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const IMAGES_BUCKET = 'images';
const MODELS_BUCKET = 'models';
const DOCUMENTS_BUCKET = 'documents';

/**
 * SVG is deliberately absent. It can carry script, and these files are served
 * from a public bucket that the admin panel embeds — an uploaded SVG would be
 * an XSS vector wearing an image's clothes.
 */
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
// Matches the ceiling the models bucket itself enforces (migration 3). Checked
// here too so an oversized file fails with a useful message instead of a
// storage-layer error.
const MODEL_MAX_BYTES = 8 * 1024 * 1024;
// Matches the documents bucket (migration 11). Sized so a print-resolution A4
// flyer still fits inside an email: SES caps a message at 40 MB and base64
// inflates by a third, so anything that fits here can always be attached.
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export type UploadKind = 'image' | 'model' | 'document';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private client: SupabaseClient | null = null;

  /**
   * Built lazily rather than in the constructor so the API still boots without
   * storage credentials. Everything else — content, properties, news, leads,
   * auth — works without them; only uploads should fail, and only when tried.
   */
  private get supabase(): SupabaseClient {
    if (!this.client) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new InternalServerErrorException(
          'Uploads are not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
        );
      }
      // The service-role key bypasses RLS, which is the point — the API has
      // already checked that the caller is an authenticated admin, and the
      // storage policies still expect a Supabase Auth session that no longer
      // exists now that auth lives here.
      this.client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client;
  }

  async upload(kind: UploadKind, file: Express.Multer.File, folder: string): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file received. Send it as multipart field "file".');

    const safeFolder = sanitiseFolder(folder);
    const prepare = {
      image: () => this.plainImage(file, safeFolder),
      model: () => this.plainModel(file, safeFolder),
      document: () => this.plainDocument(file, safeFolder),
    }[kind];
    const { bucket, path, contentType, cacheControl } = prepare();

    const { error } = await this.supabase.storage.from(bucket).upload(path, file.buffer, {
      contentType,
      cacheControl,
      upsert: false,
    });

    if (error) {
      this.logger.error(`Upload to ${bucket}/${path} failed: ${error.message}`);
      throw new InternalServerErrorException('Upload failed. Please try again.');
    }

    return { url: this.supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
  }

  private plainImage(file: Express.Multer.File, folder: string) {
    const ext = IMAGE_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: ${Object.keys(IMAGE_TYPES).join(', ')}.`,
      );
    }
    if (file.size > IMAGE_MAX_BYTES) {
      throw new BadRequestException(`Image is too large (max ${IMAGE_MAX_BYTES / 1024 / 1024} MB).`);
    }
    return {
      bucket: IMAGES_BUCKET,
      path: `${folder}/${randomUUID()}.${ext}`,
      contentType: file.mimetype,
      cacheControl: '3600',
    };
  }

  private plainModel(file: Express.Multer.File, folder: string) {
    // Browsers frequently send .glb as application/octet-stream, so the
    // extension is the more reliable signal of the two.
    const looksGlb =
      file.mimetype === 'model/gltf-binary' ||
      file.mimetype === 'application/octet-stream' ||
      file.originalname?.toLowerCase().endsWith('.glb');
    if (!looksGlb) {
      throw new BadRequestException('Only glTF-binary (.glb) models are accepted.');
    }
    if (file.size > MODEL_MAX_BYTES) {
      throw new BadRequestException(`Model is too large (max ${MODEL_MAX_BYTES / 1024 / 1024} MB).`);
    }
    return {
      bucket: MODELS_BUCKET,
      path: `${folder}/${randomUUID()}.glb`,
      contentType: 'model/gltf-binary',
      // Geometry never changes in place — a revised building is a new upload —
      // so the heavy asset can be cached hard. Unit data, which does change, is
      // never cached.
      cacheControl: '31536000',
    };
  }

  private plainDocument(file: Express.Multer.File, folder: string) {
    // Both signals checked, unlike models: a browser reliably labels a PDF,
    // and the bucket rejects anything else anyway, so a mislabelled file
    // should fail here with a readable message rather than at the storage
    // layer with an opaque one.
    const looksPdf =
      file.mimetype === 'application/pdf' && file.originalname?.toLowerCase().endsWith('.pdf');
    if (!looksPdf) {
      throw new BadRequestException('Only PDF documents are accepted.');
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException(
        `Document is too large (max ${DOCUMENT_MAX_BYTES / 1024 / 1024} MB).`,
      );
    }
    return {
      bucket: DOCUMENTS_BUCKET,
      path: `${folder}/${randomUUID()}.pdf`,
      contentType: 'application/pdf',
      // A revised flyer is a new upload at a new URL, never an edit in place,
      // so the file at any given URL is immutable and can be cached hard.
      cacheControl: '31536000',
    };
  }
}

/**
 * Folders are caller-supplied (`properties/<slug>/model`), so they must not be
 * able to climb out of the bucket or smuggle in a leading slash.
 */
export function sanitiseFolder(folder: string): string {
  const cleaned = (folder ?? '')
    .split('/')
    .map((s) => s.trim().replace(/[^a-zA-Z0-9._-]/g, '-'))
    .filter((s) => s.length > 0 && s !== '.' && s !== '..')
    .join('/');
  if (!cleaned) throw new BadRequestException('A folder is required.');
  return cleaned;
}
