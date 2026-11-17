// Session hardening (1 Nov security audit L4): issuer and audience on every
// access token, a minimum secret length, and a 30-day ceiling on a sign-in.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/modules/auth/auth.service';
import { JWT_AUDIENCE, SESSION_MAX_MS, jwtIssuer, sessionDeadline, withDeadline } from '../src/modules/auth/token-claims';

const SECRET = 'x'.repeat(64);

async function setup() {
  const passwordHash = await bcrypt.hash('right-password', 4);
  const rows = new Map<string, any>();
  const prisma: any = {
    websiteAdminUser: { findUnique: async () => ({ id: 'u1', email: 'admin@prime.test', passwordHash }) },
    websiteAdminRefreshToken: {
      create: async ({ data }: any) => rows.set(data.tokenHash, { ...data, revokedAt: null }),
      deleteMany: async () => ({ count: 0 }),
      findUnique: async ({ where }: any) => {
        const row = rows.get(where.tokenHash);
        return row && { ...row, user: { id: 'u1', email: 'admin@prime.test' } };
      },
      updateMany: async ({ where, data }: any) => {
        const row = rows.get(where.tokenHash);
        if (!row || row.revokedAt) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
  const config: any = { get: (_: string, d: string) => d, getOrThrow: () => SECRET };
  return { service: new AuthService(prisma, new JwtService({}), config), rows };
}

test('access tokens name this API and the admin audience', async () => {
  const { service } = await setup();
  const { accessToken } = await service.login('admin@prime.test', 'right-password');
  const claims = await new JwtService({}).verifyAsync(accessToken, { secret: SECRET, issuer: jwtIssuer(), audience: JWT_AUDIENCE });
  assert.equal(claims.sub, 'u1');
  await assert.rejects(new JwtService({}).verifyAsync(accessToken, { secret: SECRET, audience: 'someone-else' }));
});

test('a refresh token carries a deadline 30 days out, and rotation keeps it', async () => {
  const { service } = await setup();
  const before = Date.now();
  const first = await service.login('admin@prime.test', 'right-password');
  const deadline = sessionDeadline(first.refreshToken, 0);
  assert.ok(deadline >= before + SESSION_MAX_MS && deadline <= Date.now() + SESSION_MAX_MS);
  const second = await service.refresh(first.refreshToken);
  assert.equal(sessionDeadline(second.refreshToken, 0), deadline, 'not extended by use');
});

test('past the deadline, refresh is refused even with a live row', async () => {
  const { service, rows } = await setup();
  const { createHash } = await import('node:crypto');
  const token = withDeadline('abc', Date.now() - 1);
  rows.set(createHash('sha256').update(token).digest('hex'), { userId: 'u1', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
  await assert.rejects(service.refresh(token), /sign in again/);
});

test('a token from before the deadline format gets a fresh 30 days on its next use', () => {
  assert.equal(sessionDeadline('legacyRandomToken', 1000), 1000 + SESSION_MAX_MS);
});

test('a JWT secret under 32 characters stops the API at boot', async () => {
  // Importing app.module runs ConfigModule.forRoot, which validates the real
  // process.env. CI has no apps/api/.env, so give it placeholders first.
  process.env.DATABASE_URL ??= 'postgres://test';
  process.env.JWT_ACCESS_SECRET ??= SECRET;
  const { validateEnv } = await import('../src/app.module');
  assert.throws(() => validateEnv({ DATABASE_URL: 'postgres://x', JWT_ACCESS_SECRET: 'short-secret' }), /at least 32/);
  assert.doesNotThrow(() => validateEnv({ DATABASE_URL: 'postgres://x', JWT_ACCESS_SECRET: SECRET }));
  assert.throws(() => validateEnv({ DATABASE_URL: 'postgres://x' }), /JWT_ACCESS_SECRET/);
});
