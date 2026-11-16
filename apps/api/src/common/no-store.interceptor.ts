import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

/**
 * Admin responses (every lead's contact details, drafts) and the auth routes
 * (tokens) must never be kept in a browser or proxy cache (1 Nov security audit,
 * L3). Only one admin route said so; this makes it the default for every route
 * that is not @Public, plus /auth/*, which is public but returns tokens.
 *
 * Set before the handler runs, so a route's own @Header still wins.
 */
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
      const req = context.switchToHttp().getRequest();
      const res = context.switchToHttp().getResponse();
      const isAuth = /\/auth(\/|$)/.test(String(req?.path ?? req?.url ?? ''));
      if ((!isPublic || isAuth) && typeof res?.setHeader === 'function' && !res.headersSent) {
        res.setHeader('Cache-Control', 'private, no-store');
      }
    }
    return next.handle();
  }
}
