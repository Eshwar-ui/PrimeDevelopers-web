import type { Request, Response } from 'express';
import { parseDuration } from './auth.service';

/**
 * The admin's refresh token as an HttpOnly cookie, for deployments where the site and
 * the API share an origin (AWS: CloudFront serves both, `/api` included).
 *
 * In localStorage the 7-day refresh token was one injected script away from being
 * stolen. As an HttpOnly cookie no script can read it; SameSite=Strict keeps other
 * sites from sending it; Path=/api/auth keeps it off every other request.
 *
 * Opt-in with REFRESH_COOKIE=true. Without it (Render, which is cross-origin to the
 * Firebase site) the API keeps returning the token in the body as before.
 */
export const REFRESH_COOKIE = 'pd_refresh';
const COOKIE_PATH = '/api/auth';

export function cookieModeEnabled(value: string | undefined): boolean {
  return value === 'true';
}

export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function setRefreshCookie(res: Response, token: string, expiry: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: parseDuration(expiry),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: true, sameSite: 'strict', path: COOKIE_PATH });
}
