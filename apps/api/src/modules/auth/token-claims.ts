/**
 * What ties an admin token to this API and this environment (1 Nov security
 * audit, L4). Admin user ids are identical on every environment the data was
 * copied to, so without these an access token from one environment's API would
 * be accepted by another's that happened to share a secret.
 */
export const JWT_AUDIENCE = 'prime-developers-admin';
export const jwtIssuer = () => process.env.JWT_ISSUER || `prime-developers-api:${process.env.NODE_ENV || 'development'}`;

/** A JWT secret shorter than this is refused at boot. */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * However often it is refreshed, a sign-in lasts at most this long. Rotation
 * alone never ended a session that was used at least once a week.
 */
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Refresh tokens carry their session's deadline: `<random>.<deadline in base 36>`.
 * Only the token's hash is stored and looked up, so the deadline cannot be edited
 * without the token no longer matching any row, and no schema change is needed.
 * A token from before this format (no dot) starts a fresh deadline on its next use.
 */
export function sessionDeadline(refreshToken: string, now: number): number {
  const dot = refreshToken.lastIndexOf('.');
  if (dot < 0) return now + SESSION_MAX_MS;
  const deadline = parseInt(refreshToken.slice(dot + 1), 36);
  return Number.isFinite(deadline) ? deadline : now;
}

export const withDeadline = (random: string, deadline: number) => `${random}.${deadline.toString(36)}`;
