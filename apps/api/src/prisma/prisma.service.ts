import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required. Set it in Render service environment variables.');
    }

    // PgBouncer in transaction mode (Supabase port 6543) doesn't support
    // prepared statements. Prisma requires pgbouncer=true to fall back to
    // simple query protocol. Auto-append if the URL targets port 6543 and
    // the flag isn't already present.
    const url = (() => {
      try {
        const u = new URL(databaseUrl);
        if (u.port === '6543' && !u.searchParams.has('pgbouncer')) {
          u.searchParams.set('pgbouncer', 'true');
          return u.toString();
        }
      } catch {
        // malformed URL — let Prisma surface the error
      }
      return databaseUrl;
    })();

    super({
      datasources: { db: { url } },
    });
  }

  async onModuleInit() {
    // Deliberately non-fatal. A throw here happens during Nest's init hooks,
    // before `app.listen`, so an unreachable database takes the whole process
    // down and Render restart-loops the deploy — including on failures no
    // redeploy can fix (a deleted or paused Supabase project, a rotated
    // password). That defeats the health design in render.yaml: liveness is
    // meant to answer even when the database does not, so /api/health/ready
    // can report *why*.
    //
    // Prisma connects lazily on first query, so dropping the eager connect
    // costs only a slower first request once the database is back.
    try {
      await this.$connect();
    } catch (err) {
      this.logger.error(
        `Database unreachable at startup — serving anyway; /api/health/ready has the detail. ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
