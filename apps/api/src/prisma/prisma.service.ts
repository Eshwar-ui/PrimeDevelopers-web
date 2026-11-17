import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required. Locally: copy apps/api/.env.example to apps/api/.env and run pnpm db:up.');
    }

    super({
      datasources: { db: { url: databaseUrl } },
    });
  }

  async onModuleInit() {
    // Deliberately non-fatal. A throw here happens during Nest's init hooks,
    // before `app.listen`, so an unreachable database takes the whole process
    // down and pm2 restart-loops it — including on failures no redeploy can
    // fix (a deleted or stopped database, a rotated password). That defeats the
    // health design: liveness (/api/health) is
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
