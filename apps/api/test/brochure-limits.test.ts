// Brochure abuse caps (audit task 3, tasks/audit-2026-11-15): the brochure form
// sends mail from the company's address to any address it is given. On top of
// the existing 10/min per IP and 3/day per address it gets a per-IP daily cap
// and a site-wide daily ceiling. Nothing else may change: other routes must not
// be counted by the daily window at all.
//
//   pnpm --filter @prime-developers/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'reflect-metadata';

const DAY_MS = 24 * 60 * 60 * 1000;

test('the brochure route, and only it, carries the per-IP daily cap of 20', async () => {
  const { LeadsController } = await import('../src/modules/leads/leads.controller');
  const { isDailyLimited, DAILY } = await import('../src/common/throttle');
  const limited = LeadsController.prototype.requestBrochure;
  const unlimited = LeadsController.prototype.create;

  assert.equal(Reflect.getMetadata(`THROTTLER:LIMIT${DAILY}`, limited), 20);
  assert.equal(Reflect.getMetadata(`THROTTLER:TTL${DAILY}`, limited), DAY_MS);
  assert.equal(isDailyLimited({ getHandler: () => limited } as any), true);
  assert.equal(isDailyLimited({ getHandler: () => unlimited } as any), false);
  // The existing per-minute limits are untouched.
  assert.equal(Reflect.getMetadata('THROTTLER:LIMITdefault', limited), 10);
  assert.equal(Reflect.getMetadata('THROTTLER:LIMITdefault', unlimited), 10);
});

test('through the real guard: the daily window blocks only a marked route', async () => {
  const { NestFactory, APP_GUARD } = await import('@nestjs/core');
  const { Controller, Get, Module } = await import('@nestjs/common');
  const { ThrottlerModule, ThrottlerGuard, getStorageToken } = await import('@nestjs/throttler');
  const { THROTTLERS, DailyLimit } = await import('../src/common/throttle');

  @Controller()
  class ProbeController {
    @DailyLimit(3)
    @Get('limited')
    limited() {
      return 'ok';
    }

    @Get('plain')
    plain() {
      return 'ok';
    }
  }
  @Module({
    imports: [ThrottlerModule.forRoot(THROTTLERS)],
    controllers: [ProbeController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  class ProbeModule {}

  const app = await NestFactory.create(ProbeModule, { logger: false, abortOnError: false });
  await app.listen(0);
  try {
    const base = await app.getUrl();
    const statuses = async (path: string, n: number) => {
      const out: number[] = [];
      for (let i = 0; i < n; i++) out.push((await fetch(`${base}/${path}`)).status);
      return out;
    };
    assert.deepEqual(await statuses('limited', 4), [200, 200, 200, 429]);
    assert.ok((await statuses('plain', 50)).every((s) => s === 200), 'an unmarked route is not held back');

    // No daily-window record is ever written for an unmarked route: the window
    // is 24 h, and one per visitor per route would grow without need.
    const storage: any = app.get(getStorageToken());
    const ttls = Object.values(storage.storage as Record<string, { expiresAt: number }>).map((r) => r.expiresAt - Date.now());
    assert.equal(ttls.filter((ms) => ms > 60 * 60 * 1000).length, 1, 'only the marked route has a day-long record');
  } finally {
    await app.close();
  }
});

function serviceWith({ sameAddress = 0, siteWide = 0, cap }: { sameAddress?: number; siteWide?: number; cap?: string }) {
  const sent: any[] = [];
  const created: any[] = [];
  const prisma: any = {
    property: {
      findUnique: async () => ({
        id: 'p1', name: 'Centro Plaza', slug: 'centro-plaza', address: null, published: true, detail: {},
      }),
    },
    websiteLead: {
      // Two counts: one for this address (has `email`), one site-wide (no `email`).
      count: async ({ where }: any) => (where.email ? sameAddress : siteWide),
      create: async ({ data }: any) => (created.push(data), { id: `lead-${created.length}` }),
    },
  };
  const mail: any = { send: async (message: any) => (sent.push(message), true) };
  const config: any = { get: (key: string) => (key === 'BROCHURE_DAILY_CAP' ? cap : undefined) };
  return { prisma, mail, config, sent, created };
}

const request = { name: 'Ana', email: 'ana@example.test', propertyId: 'p1' } as any;
const settle = () => new Promise((resolve) => setImmediate(resolve)); // staff mail runs in the background

test('over the site-wide ceiling: the lead is saved, the email withheld, staff told why', async () => {
  const { LeadsService } = await import('../src/modules/leads/leads.service');
  const { prisma, mail, config, sent, created } = serviceWith({ siteWide: 200 });
  const result = await new LeadsService(prisma, mail, config).requestBrochure(request);
  await settle();

  assert.equal(result.emailed, false);
  assert.equal(created.length, 1, 'the enquiry is still recorded');
  assert.equal(sent.find((m) => m.to === 'ana@example.test'), undefined, 'no email to the visitor');
  const staff = sent.find((m) => m.to !== 'ana@example.test');
  assert.ok(staff, 'staff are notified');
  assert.match(staff.text, /site-wide daily limit of 200/);
});

test('the ceiling is configurable, and under it the email goes out as before', async () => {
  const { LeadsService } = await import('../src/modules/leads/leads.service');

  const low = serviceWith({ siteWide: 5, cap: '5' });
  assert.equal((await new LeadsService(low.prisma, low.mail, low.config).requestBrochure(request)).emailed, false);

  const under = serviceWith({ siteWide: 199 });
  assert.equal((await new LeadsService(under.prisma, under.mail, under.config).requestBrochure(request)).emailed, true);

  // A nonsense value falls back to the default rather than switching the cap off.
  for (const cap of ['0', '-3', 'lots', '']) {
    const odd = serviceWith({ siteWide: 200, cap });
    assert.equal((await new LeadsService(odd.prisma, odd.mail, odd.config).requestBrochure(request)).emailed, false, `cap ${JSON.stringify(cap)}`);
  }
});

test('the per-address limit still applies first, with its own message', async () => {
  const { LeadsService } = await import('../src/modules/leads/leads.service');
  const { prisma, mail, config, sent } = serviceWith({ sameAddress: 3, siteWide: 500 });
  const result = await new LeadsService(prisma, mail, config).requestBrochure(request);
  await settle();
  assert.equal(result.emailed, false);
  assert.match(sent.find((m) => m.to !== 'ana@example.test').text, /already asked 3 times today/);
});
