import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Request signing between Prime Tracker and this API.
 *
 * The tracker signs `<timestamp>.<path and query>.<raw body>` with a shared secret
 * and sends the timestamp and signature as headers. Signing the timestamp means a
 * captured request cannot be replayed with a fresh one, and the tolerance means it
 * cannot be replayed later as it is. Signing the path and query means it cannot be
 * replayed *differently* inside that window either — the query carries `force=true`,
 * which overrides the merge's mass-removal guard, and an unsigned query let anyone
 * holding a captured push add it.
 *
 * Prime Tracker carries the mirror image of this file
 * (apps/api/src/modules/website-sync/website-signature.ts). The test vector in
 * test/tracker-sync.test.ts is shared by both test suites; change one side and
 * the other's test fails.
 */
export const TIMESTAMP_HEADER = 'x-prime-timestamp';
export const SIGNATURE_HEADER = 'x-prime-signature';
export const TOLERANCE_MS = 5 * 60 * 1000;

/** `target` is the request's path plus query string, exactly as sent: `/api/…?force=true`. */
export function sign(secret: string, timestamp: string, target: string, rawBody: string | Buffer): string {
  const mac = createHmac('sha256', secret);
  mac.update(`${timestamp}.${target}.`);
  mac.update(rawBody);
  return `sha256=${mac.digest('hex')}`;
}

export type VerifyFailure = 'missing' | 'stale' | 'mismatch';

export function verify(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  target: string,
  rawBody: string | Buffer,
  now = Date.now(),
): VerifyFailure | null {
  if (!timestamp || !signature) return 'missing';
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > TOLERANCE_MS) return 'stale';

  const expected = Buffer.from(sign(secret, timestamp, target, rawBody));
  const given = Buffer.from(signature);
  // timingSafeEqual throws on a length mismatch rather than returning false.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'mismatch';
  return null;
}
