import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { Public } from '../../common/decorators/public.decorator';
import { MediaStorage } from './media-storage';

// One image at a time per resize, and no libvips cache: this runs on the same small
// host as Prime Tracker, and CloudFront keeps every result anyway.
sharp.concurrency(1);
sharp.cache(false);

/**
 * Every width the site asks for — the union of WIDTHS and SRCSET in
 * apps/web/src/lib/images.js, plus the gallery's 160/200 thumbnails. Anything else
 * is redirected to the next width up rather than rendered: an open width range
 * let one image be requested at thousands of sizes, each a full decode on a
 * cache miss, and each a separate CloudFront cache entry.
 */
export const WIDTH_LADDER = [160, 200, 240, 300, 360, 400, 450, 480, 600, 640, 700, 900, 960, 1200, 1280, 1600, 1920];
export const QUALITIES = [60, 75, 90];
const DEFAULT_WIDTH = 1920;
const DEFAULT_QUALITY = 75;

// A 48 MP original (8000×6000) is the largest photograph the client's cameras produce;
// anything past that is either a mistake or an attempt to exhaust memory.
const MAX_INPUT_PIXELS = 50_000_000;

// At most this many resizes at once. Each fetches its original from S3 and decodes
// it only once it holds a slot, so a request waiting in line holds no image in
// memory — which is what makes a long line safe. A cold page asks for 20–30 resizes
// at once (the partner wall alone is 20 logos); the first version kept a line of 8
// and its reads outside the gate, and turned the rest of the page away as broken
// images.
const MAX_ACTIVE = 2;
// Past this many waiting, or this long in line, a request is turned away with a 503
// and Retry-After rather than left queueing behind work it would time out on
// (CloudFront gives the origin 60 seconds).
const MAX_WAITING = 64;
const MAX_WAIT_MS = 20_000;
const RETRY_AFTER_SECONDS = 5;

export function canonicalWidth(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WIDTH;
  return WIDTH_LADDER.find((w) => w >= n) ?? WIDTH_LADDER[WIDTH_LADDER.length - 1];
}

export function canonicalQuality(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_QUALITY;
  return QUALITIES.reduce((best, q) => (Math.abs(q - n) < Math.abs(best - n) ? q : best));
}

/** The resizer is saturated. The response says when to try again. */
export class BusyResizing extends ServiceUnavailableException {
  constructor() {
    super('Busy resizing — retry shortly');
  }
}

/**
 * A counting semaphore with a bounded, deadline-limited line: the resize is the
 * scarce resource, not the request.
 *
 * A finished job hands its slot straight to the next in line instead of freeing it,
 * so a request arriving in between can never take it and push the count past the
 * limit — which the first version allowed.
 */
export class Gate {
  private active = 0;
  private readonly line: { admit: () => void; timer: NodeJS.Timeout }[] = [];

  constructor(private readonly limits = { active: MAX_ACTIVE, waiting: MAX_WAITING, waitMs: MAX_WAIT_MS }) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active < this.limits.active) this.active++;
    else await this.wait();
    try {
      return await work();
    } finally {
      const next = this.line.shift();
      if (next) {
        clearTimeout(next.timer);
        next.admit(); // the slot passes on; `active` is unchanged
      } else {
        this.active--;
      }
    }
  }

  get load() {
    return { active: this.active, waiting: this.line.length };
  }

  private wait(): Promise<void> {
    if (this.line.length >= this.limits.waiting) return Promise.reject(new BusyResizing());
    return new Promise((resolve, reject) => {
      const entry = {
        admit: resolve,
        timer: setTimeout(() => {
          const at = this.line.indexOf(entry);
          if (at !== -1) this.line.splice(at, 1);
          reject(new BusyResizing());
        }, this.limits.waitMs),
      };
      this.line.push(entry);
    });
  }
}

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
  private readonly gate = new Gate();

  constructor(private media: MediaStorage) {}

  // Only cache misses reach here — CloudFront answers repeats — so this is a ceiling
  // on how fast one visitor can make the server render, not on how fast a page loads.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Get(':bucket/*')
  @ApiOperation({ summary: 'A stored image, resized and re-encoded as WebP' })
  async resize(
    @Param('bucket') bucket: string,
    @Param('0') path: string,
    @Query('width') width: string | undefined,
    @Query('quality') quality: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.media.enabled || bucket !== 'images') throw new NotFoundException();
    if (!path || path.split('/').some((part) => part === '..' || part === '')) {
      throw new BadRequestException('Bad image path');
    }

    const w = canonicalWidth(width);
    const q = canonicalQuality(quality);
    if (String(w) !== width || String(q) !== quality) {
      // Permanent, so CloudFront and browsers keep the redirect too and the
      // non-canonical URL never costs a render.
      const base = (req.originalUrl ?? req.url).split('?')[0];
      res.redirect(308, `${base}?width=${w}&quality=${q}`);
      return;
    }

    const out = await this.gate
      .run(async () => {
        // Fetched inside the gate, so a request waiting in line holds no image.
        const original = await this.media.get(bucket, path);
        if (!original) return null;
        return sharp(original, { failOn: 'none', limitInputPixels: MAX_INPUT_PIXELS })
          .rotate() // honour EXIF orientation before the metadata is stripped
          .resize({ width: w, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: q })
          .toBuffer()
          .catch((err: Error) => {
            // Over the pixel limit, or not an image at all: the request, not the server.
            throw new UnprocessableEntityException(`Cannot resize this image: ${err.message}`);
          });
      })
      .catch((err: Error) => {
        if (err instanceof BusyResizing) {
          // no-store: a refusal says nothing about the image, and CloudFront would
          // otherwise replay this 503 to every visitor at that edge for its
          // error-caching TTL.
          res.set({ 'Retry-After': String(RETRY_AFTER_SECONDS), 'Cache-Control': 'no-store' });
        }
        throw err;
      });
    if (!out) throw new NotFoundException();

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
