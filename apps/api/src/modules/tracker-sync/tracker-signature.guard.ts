import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from './tracker-signature';

/**
 * Admits only requests signed by Prime Tracker. Used instead of the JWT guard
 * on the integration route: the tracker is a server, not an admin, and a
 * long-lived admin token sitting in its environment would be able to do
 * everything an admin can, where this secret can do exactly one thing.
 *
 * Verifies the raw bytes (main.ts enables `rawBody`), not the parsed body —
 * re-serialising JSON does not reproduce the bytes that were signed.
 */
@Injectable()
export class TrackerSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TrackerSignatureGuard.name);

  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('TRACKER_SYNC_SECRET');
    // Unconfigured is a deployment fact, not a bad request: say so, rather than
    // answering every push with a 401 the tracker would read as a wrong secret.
    if (!secret) throw new ServiceUnavailableException('Tracker sync is not configured');

    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const failure = verify(
      secret,
      req.header(TIMESTAMP_HEADER),
      req.header(SIGNATURE_HEADER),
      // Path and query as this server received them — after CloudFront's origin
      // path and nginx's /website-api/ prefix have both been taken off again, so it
      // is the same /api/… the tracker signed.
      req.originalUrl,
      req.rawBody ?? Buffer.alloc(0),
    );
    if (failure) {
      this.logger.warn(`Rejected tracker push from ${req.ip}: ${failure}`);
      throw new UnauthorizedException(`Tracker signature ${failure}`);
    }
    return true;
  }
}
