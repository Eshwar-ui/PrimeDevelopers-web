import { Controller, Get, HttpStatus, HttpCode, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../decorators/public.decorator';

/**
 * Health check endpoint for Render, uptime monitors, and CI smoke tests.
 *
 * - GET /api/health        — liveness (always 200 if the process is up)
 * - GET /api/health/ready  — readiness (200 when the DB is reachable, 503 when not)
 *
 * No auth required. Returns minimal info on purpose — don't leak deployment internals.
 *
 * @Public() is load-bearing: the JWT guard is global, so without it Render's
 * health check gets a 401, the service never reports healthy, and the deploy
 * restart-loops. This controller predates the guard and silently became
 * authenticated when the guard was made global.
 */
@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe — does the process respond at all?' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * 503 when anything it depends on is down, so a load balancer or uptime check can
   * act on the status code alone — it used to answer 200 "degraded", which every
   * health checker reads as healthy.
   *
   * The failure reason goes to the log, not the response: this route is public, and
   * a database error message names hosts, users and sometimes the query.
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — can the API serve traffic?' })
  async readiness() {
    const checks: Record<string, { ok: boolean; latencyMs?: number }> = {};

    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true, latencyMs: Date.now() - dbStart };
    } catch (err) {
      this.logger.error(`Readiness: database check failed: ${(err as Error).message}`);
      checks.database = { ok: false, latencyMs: Date.now() - dbStart };
    }

    const body = {
      status: Object.values(checks).every((c) => c.ok) ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
