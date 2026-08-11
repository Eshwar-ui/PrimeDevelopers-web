import { Header } from '@nestjs/common';

/**
 * Marks a public read endpoint as cacheable by shared caches.
 *
 * These responses carried no `Cache-Control` at all, which means every visitor
 * to the marketing site round-tripped through Render to Supabase in Mumbai for
 * content that changes a few times a month.
 *
 * The directives, and why each one:
 *
 * - `public` — no per-user variation on these routes. The admin endpoints are
 *   a separate controller behind the JWT guard, and are deliberately not given
 *   this decorator, so a draft can never be cached or served to a visitor.
 * - `max-age=0` — the browser revalidates on every navigation. Combined with
 *   the ETag Nest already sends, an unchanged payload comes back as a 304 with
 *   no body rather than re-sending the ~24KB property list.
 * - `s-maxage=60` — shared caches answer directly for a minute. This is the
 *   ceiling on how long an editor's published change can take to appear, and
 *   is the one number here worth revisiting if that ever feels too slow.
 * - `stale-while-revalidate=300` — for five minutes past that, a stale copy is
 *   served immediately while the refresh happens behind it, so the cost of a
 *   cold cache never lands on a visitor.
 */
export const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

export const Cacheable = () => Header('Cache-Control', CACHE_CONTROL);
