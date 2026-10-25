import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { parseCspReports } from './csp-report';

/**
 * Where visitors' browsers send Content-Security-Policy violations.
 *
 * On AWS the site's policy is report-only for now (website.tf in prime-tracker-main):
 * it blocks nothing, and each violation becomes one `[CSP]` line in the API log,
 * which ships to CloudWatch. When those lines show only expected noise, the header
 * becomes the enforcing one.
 *
 * Unauthenticated by nature — the browser sends no credentials — so it is throttled,
 * its body is capped at 16 KB (main.ts), and nothing from it is stored.
 */
@ApiExcludeController()
@Controller('csp-report')
export class CspController {
  private readonly logger = new Logger('CSP');

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  report(@Body() body: unknown) {
    for (const violation of parseCspReports(body)) this.logger.warn(JSON.stringify(violation));
  }
}
