import { Injectable } from '@nestjs/common';

/** Five failures inside fifteen minutes lock that email for fifteen minutes. */
export const LOCKOUT = { failures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 } as const;

/**
 * Upper bound on emails tracked at once. A caller spraying made-up addresses
 * adds one entry each; past this the oldest are dropped, so memory stays flat
 * (the host restarts the API at 300 MB). Ten thousand is far beyond what the
 * per-IP throttle on /auth/login lets anyone reach inside one window.
 */
const MAX_KEYS = 10_000;

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

/**
 * Failed admin logins per email, in memory.
 *
 * The per-IP throttle (5 a minute) stops one machine; it does nothing against
 * guesses spread over many. This counts per email instead (audit 1 Nov M6).
 *
 * In memory because the API is one pm2 process in fork mode
 * (scripts/aws/02-deploy-api.sh). **If it is ever run as several processes,
 * this must move to the database** — each process would otherwise allow its
 * own five tries. A restart clears it, which only ever unlocks.
 *
 * Keys are counted whether or not the email belongs to an admin, so a lock
 * says nothing about which addresses exist.
 */
@Injectable()
export class LoginAttempts {
  private readonly entries = new Map<string, Entry>();

  /** Replaced in tests. Not a constructor argument: Nest would try to inject it. */
  now: () => number = () => Date.now();

  get size(): number {
    return this.entries.size;
  }

  isLocked(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.lockedUntil > this.now()) return true;
    if (entry.lockedUntil) this.entries.delete(key); // lock served: start afresh
    return false;
  }

  /** Records a failure. True when this failure is the one that locks the key. */
  fail(key: string): boolean {
    const now = this.now();
    let entry = this.entries.get(key);
    if (!entry || now - entry.windowStart >= LOCKOUT.windowMs || (entry.lockedUntil && entry.lockedUntil <= now)) {
      entry = { failures: 0, windowStart: now, lockedUntil: 0 };
    }
    entry.failures++;
    // Re-inserted so Map order runs oldest activity first, for eviction.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.evict();

    if (entry.failures >= LOCKOUT.failures && !entry.lockedUntil) {
      entry.lockedUntil = now + LOCKOUT.lockMs;
      return true;
    }
    return false;
  }

  succeed(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Over the bound, drop expired entries, then the oldest, down to 90% — so the
   * sweep runs once per thousand new keys, not on every one.
   */
  private evict(): void {
    if (this.entries.size <= MAX_KEYS) return;
    const target = Math.floor(MAX_KEYS * 0.9);
    const now = this.now();
    for (const [key, entry] of this.entries) {
      const idle = entry.lockedUntil ? entry.lockedUntil <= now : now - entry.windowStart >= LOCKOUT.windowMs;
      if (idle) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size <= target) break;
      this.entries.delete(key);
    }
  }
}
