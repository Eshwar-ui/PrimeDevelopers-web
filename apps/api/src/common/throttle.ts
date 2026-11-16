import { applyDecorators, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Throttle, ThrottlerOptions } from '@nestjs/throttler';

/** The day-long window's name, as @Throttle and the guard's metadata know it. */
export const DAILY = 'daily';
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_LIMITED = 'prime:daily-limited';

/**
 * Caps a route per client IP per day, on top of the per-minute default.
 *
 * The throttler runs every named window on every route, keeping one record per
 * visitor per route for the window's length. A 24-hour window on every route
 * would hold a record for every visitor for a day, on a host that already
 * restarts the API at 300 MB. So the daily window skips every route that does
 * not carry this decorator: an unmarked route does no extra work at all.
 */
export const DailyLimit = (limit: number) =>
  applyDecorators(SetMetadata(DAILY_LIMITED, true), Throttle({ [DAILY]: { limit, ttl: DAY_MS } }));

export const isDailyLimited = (context: ExecutionContext): boolean =>
  Reflect.getMetadata(DAILY_LIMITED, context.getHandler()) === true;

/**
 * Every throttler window, for ThrottlerModule.forRoot.
 *
 * `default` is the ceiling for every route. Login and the public lead endpoints
 * tighten it with their own @Throttle — they are the unauthenticated writes and
 * the only obvious abuse targets. `daily` applies only where @DailyLimit says.
 */
export const THROTTLERS: ThrottlerOptions[] = [
  { ttl: 60_000, limit: 100 },
  // The limit here is never used: every route that is not skipped sets its own.
  { name: DAILY, ttl: DAY_MS, limit: 1, skipIf: (context) => !isDailyLimited(context) },
];
