import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import sharp from 'sharp';
import { Public } from '../../common/decorators/public.decorator';
import { MediaStorage } from './media-storage';

// One image at a time, and no libvips cache: this runs on the same 914 MiB host as
// Prime Tracker, and CloudFront keeps every result anyway, so the server only ever
// sees each size of each image once per edge.
sharp.concurrency(1);
sharp.cache(false);

const MIN_WIDTH = 16;
const MAX_WIDTH = 2560;
const DEFAULT_WIDTH = 1920;
const DEFAULT_QUALITY = 75;

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/**
 * Resized images, replacing Supabase's render endpoint
 * (`/storage/v1/render/image/public/...`) that apps/web/src/lib/images.js was built on.
 *
 * Same contract the site already speaks: `width` and `quality` in the query,
 * proportional scaling that never enlarges (Supabase's `resize=contain`), WebP out.
 * WebP unconditionally rather than negotiated from Accept: every browser the site
 * supports decodes it, and one output per URL is what lets CloudFront cache it on
 * the query string alone.
 *
 * Served at /api/img/<bucket>/<path>; the site's CloudFront distribution caches it
 * for a year, which is safe because upload paths are random and never reused.
 */
@ApiTags('Media')
@Controller('img')
export class ImageController {
  constructor(private media: MediaStorage) {}

  // A page asks for dozens of these at once. CloudFront answers repeats, and the
  // per-IP limit here would only see CloudFront's own addresses anyway.
  @Public()
  @SkipThrottle()
  @Get(':bucket/*')
  @ApiOperation({ summary: 'A stored image, resized and re-encoded as WebP' })
  async resize(
    @Param('bucket') bucket: string,
    @Param('0') path: string,
    @Query('width') width: string | undefined,
    @Query('quality') quality: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.media.enabled || bucket !== 'images') throw new NotFoundException();
    if (!path || path.split('/').some((part) => part === '..' || part === '')) {
      throw new BadRequestException('Bad image path');
    }

    const original = await this.media.get(bucket, path);
    if (!original) throw new NotFoundException();

    const out = await sharp(original, { failOn: 'none' })
      .rotate() // honour EXIF orientation before the metadata is stripped
      .resize({
        width: clamp(width, MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: clamp(quality, 30, 95, DEFAULT_QUALITY) })
      .toBuffer();

    res
      .status(200)
      .set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(out.length),
      })
      .end(out);
  }
}
