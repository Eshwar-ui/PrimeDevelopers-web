// Admin login lockout (audit task 4, tasks/audit-2026-11-15): one password
// guards every lead and the whole site, and the only brake on guessing was
// 5 tries a minute per IP — unlimited across IPs. Five failures in 15 minutes
// now lock that email for 15 minutes, without telling anyone which emails exist.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import { LoginAttempts, LOCKOUT } from '../src/modules/auth/login-attempts';
import { AuthService } from '../src/modules/auth/auth.service';

const MINUTE = 60_000;

function clockedAttempts(start = 1_000_000) {
  const attempts = new LoginAttempts();
  const clock = { t: start };
  attempts.now = () => clock.t;
  return { attempts, clock };
}

test('five failures inside the window lock the key; four do not', () => {
  const { attempts } = clockedAttempts();
  for (let i = 0; i < 4; i++) assert.equal(attempts.fail('a@b.c'), false);
  assert.equal(attempts.isLocked('a@b.c'), false);
  assert.equal(attempts.fail('a@b.c'), true, 'the fifth failure reports that it locked');
  assert.equal(attempts.isLocked('a@b.c'), true);
  assert.equal(attempts.isLocked('other@b.c'), false, 'keys are independent');
  assert.deepEqual(LOCKOUT, { failures: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE });
});

test('the lock lifts after 15 minutes, with a fresh count', () => {
  const { attempts, clock } = clockedAttempts();
  for (let i = 0; i < 5; i++) attempts.fail('a@b.c');
  clock.t += 15 * MINUTE - 1;
  assert.equal(attempts.isLocked('a@b.c'), true);
  clock.t += 1;
  assert.equal(attempts.isLocked('a@b.c'), false);
  assert.equal(attempts.fail('a@b.c'), false, 'one failure after the lock is one, not six');
});

test('failures spread wider than the window never add up to a lock', () => {
  const { attempts, clock } = clockedAttempts();
  for (let i = 0; i < 20; i++) {
    attempts.fail('a@b.c');
    clock.t += 4 * MINUTE; // 4 failures per 16 minutes at most
  }
  assert.equal(attempts.isLocked('a@b.c'), false);
});

test('a success clears the count', () => {
  const { attempts } = clockedAttempts();
  for (let i = 0; i < 4; i++) attempts.fail('a@b.c');
  attempts.succeed('a@b.c');
  for (let i = 0; i < 4; i++) attempts.fail('a@b.c');
  assert.equal(attempts.isLocked('a@b.c'), false);
});

test('spraying random emails cannot grow the table without bound', () => {
  const { attempts } = clockedAttempts();
  attempts.fail('admin@prime.test');
  for (let i = 0; i < 25_000; i++) attempts.fail(`spray${i}@x.test`);
  assert.ok(attempts.size <= 10_000, `tracked ${attempts.size} keys`);
});

test('Nest gives AuthService the one shared LoginAttempts, not a private default', async () => {
  const { NestFactory } = await import('@nestjs/core');
  const { Module } = await import('@nestjs/common');
  const { JwtService } = await import('@nestjs/jwt');
  const { ConfigService } = await import('@nestjs/config');
  const { PrismaService } = await import('../src/prisma/prisma.service');

  @Module({
    providers: [
      AuthService,
      LoginAttempts,
      { provide: PrismaService, useValue: {} },
      { provide: JwtService, useValue: {} },
      { provide: ConfigService, useValue: {} },
    ],
  })
  class WiringModule {}

  const app = await NestFactory.createApplicationContext(WiringModule, { logger: false, abortOnError: false });
  try {
    assert.equal((app.get(AuthService) as any).attempts, app.get(LoginAttempts));
  } finally {
    await app.close();
  }
});

// ── Through AuthService.login ───────────────────────────────────────────────

async function serviceWithAdmin() {
  // Cost 4 keeps the test fast; production hashes are cost 12.
  const passwordHash = await bcrypt.hash('right-password', 4);
  const prisma: any = {
    websiteAdminUser: {
      findUnique: async ({ where }: any) =>
        where.email === 'admin@prime.test' ? { id: 'u1', email: 'admin@prime.test', passwordHash } : null,
    },
    websiteAdminRefreshToken: { create: async () => ({}), deleteMany: async () => ({ count: 0 }) },
  };
  const jwt: any = { signAsync: async () => 'access' };
  const config: any = { get: (_: string, d: string) => d, getOrThrow: () => 'secret' };
  const { attempts, clock } = clockedAttempts();
  return { service: new AuthService(prisma, jwt, config, attempts), clock };
}

const refusal = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err: any) {
    return { status: err.getStatus?.(), message: err.message };
  }
  return null;
};

test('after five wrong passwords even the right one is refused, with the usual answer', async () => {
  const { service } = await serviceWithAdmin();
  const wrong = await refusal(service.login('admin@prime.test', 'nope'));
  assert.deepEqual(wrong, { status: 401, message: 'Invalid email or password' });
  for (let i = 0; i < 4; i++) await refusal(service.login('admin@prime.test', 'nope'));

  assert.deepEqual(await refusal(service.login('admin@prime.test', 'right-password')), wrong, 'locked: same status and message');
  // The address is normalised the same way the lookup normalises it.
  assert.deepEqual(await refusal(service.login('  ADMIN@prime.test ', 'right-password')), wrong);
});

test('the lock lifts after 15 minutes and the right password works again', async () => {
  const { service, clock } = await serviceWithAdmin();
  for (let i = 0; i < 5; i++) await refusal(service.login('admin@prime.test', 'nope'));
  clock.t += 15 * MINUTE;
  const pair = await service.login('admin@prime.test', 'right-password');
  assert.equal(pair.accessToken, 'access');
});

test('an unknown email is answered exactly like a known one, locked or not', async () => {
  const { service } = await serviceWithAdmin();
  const known = await refusal(service.login('admin@prime.test', 'nope'));
  for (let i = 0; i < 6; i++) {
    assert.deepEqual(await refusal(service.login('ghost@prime.test', 'nope')), known, `attempt ${i + 1}`);
  }
});

test('a successful login resets the count, so the admin is not locked by old typos', async () => {
  const { service } = await serviceWithAdmin();
  for (let i = 0; i < 4; i++) await refusal(service.login('admin@prime.test', 'nope'));
  await service.login('admin@prime.test', 'right-password');
  for (let i = 0; i < 4; i++) await refusal(service.login('admin@prime.test', 'nope'));
  assert.equal((await service.login('admin@prime.test', 'right-password')).accessToken, 'access');
});
