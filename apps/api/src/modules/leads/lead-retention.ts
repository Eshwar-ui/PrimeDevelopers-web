import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Spam-flagged leads are deleted this long after they arrive (security audit L6). */
export const SPAM_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes spam-flagged leads older than SPAM_RETENTION_DAYS, once shortly after
 * boot and then daily. Real leads are never touched. A filtered lead stays in
 * the admin under "Show filtered" for a month, which is long enough for staff to
 * rescue a person the checks caught by mistake (rescuing clears `spam`).
 *
 * A timer rather than a scheduler dependency: the API is one pm2 process, and a
 * restart only moves the next run. If it ever runs as several, each would run
 * the same idempotent delete, which is harmless.
 */
@Injectable()
export class LeadRetention implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('LeadRetention');
  private timers: NodeJS.Timeout[] = [];

  constructor(private prisma: PrismaService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    const run = () => void this.purgeSpam().catch((err) => this.logger.warn(`Spam purge failed: ${err instanceof Error ? err.message : err}`));
    this.timers.push(setTimeout(run, 60_000).unref(), setInterval(run, DAY_MS).unref());
  }

  onApplicationShutdown() {
    this.timers.forEach(clearTimeout);
  }

  /** Deletes the expired spam leads and returns how many. */
  async purgeSpam(now = Date.now()): Promise<number> {
    const { count } = await this.prisma.websiteLead.deleteMany({
      where: { spam: true, createdAt: { lt: new Date(now - SPAM_RETENTION_DAYS * DAY_MS) } },
    });
    if (count) this.logger.log(`Deleted ${count} spam-flagged lead(s) older than ${SPAM_RETENTION_DAYS} days.`);
    return count;
  }
}
