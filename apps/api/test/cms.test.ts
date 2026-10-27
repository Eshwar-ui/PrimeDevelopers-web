// CMS and lead fixes from docs/website-audit-2026-10-27.md: the property
// editor's payload (C1), the conflict check on property saves, and lead
// delivery, spam and paging, and which unit-label problems block a save.
//
//   pnpm --filter @prime-developers/api test
//
// Nothing here touches a database or sends mail — Prisma and SES are faked —
// which matters because apps/api/.env points at production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, Logger, NotFoundException, ValidationPipe } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';
import { UpdatePropertyDto } from '../src/modules/properties/dto/property.dto';
import { PropertiesService } from '../src/modules/properties/properties.service';
import { PropertiesAdminController } from '../src/modules/properties/properties.admin.controller';
import { Prisma } from '@prisma/client';
import { CreateLeadDto, ListLeadsQueryDto, UpdateLeadDto } from '../src/modules/leads/dto/lead.dto';
import { DEFAULT_LEADS_NOTIFY_TO, LeadsService, MIN_FILL_MS } from '../src/modules/leads/leads.service';

// The failure paths below log on purpose; the output is noise here.
Logger.overrideLogger(false);

// The same options as main.ts. Kept in step by hand: if main.ts loosens or
// tightens these, this copy has to follow, or the tests stop meaning anything.
const pipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

const validateBody = (metatype: any, value: unknown) => pipe().transform(value, { type: 'body', metatype, data: '' });
const validateQuery = (metatype: any, value: unknown) => pipe().transform(value, { type: 'query', metatype, data: '' });

/** The 400's messages, flattened, so a test can say which field it was about. */
const messages = (err: any) => JSON.stringify(err?.getResponse?.() ?? err);

// A property as GET /admin/properties returns it today — tracker columns and all.
const loaded = () => ({
  id: '4b0c43c4-31a1-4d7a-9a3b-7d2f0c1f5e10',
  slug: 'centro-plaza',
  name: 'Centro Plaza',
  address: '15101 Ronald Reagan Blvd, Leander, TX 78641',
  category: 'Retail',
  buildings: 54,
  sold: 47,
  available: 7,
  image: 'https://site.test/media/images/projects/centro.webp',
  gallery: ['https://site.test/media/images/projects/a.webp', ''],
  detail: { specs: [' 2.5 Acres ', '', ''], floorPlans: { buildings: [{ building: 'Building 2', unitList: [] }] } },
  sortOrder: 1,
  published: true,
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-10-26T10:00:00.123Z',
  trackerProjectId: 'cmtiyjnbg01bdh360e0mfslii',
  trackerSyncedAt: '2026-10-26T09:00:00.000Z',
  // Form-only state the editor keeps on the same object.
  _slugTouched: true,
});

// ── C1: the property editor's save ────────────────────────────────────────

test("the property editor's payload passes UpdatePropertyDto, and tracker fields are never sent", async () => {
  const { propertyPayload } = await import('../../web/src/admin/propertyPayload.js');
  const record = loaded();
  const payload = propertyPayload(record, { expectedUpdatedAt: record.updatedAt });

  for (const key of ['id', 'createdAt', 'updatedAt', 'trackerProjectId', 'trackerSyncedAt', '_slugTouched']) {
    assert.equal(key in payload, false, `${key} must not be sent`);
  }
  const dto: any = await validateBody(UpdatePropertyDto, payload);
  assert.deepEqual(dto.detail.specs, ['2.5 Acres']);
  assert.deepEqual(dto.gallery, ['https://site.test/media/images/projects/a.webp']);
  assert.equal(dto.expectedUpdatedAt, record.updatedAt);
});

test('the record as loaded is what used to be sent, and the API rejects it', async () => {
  // What PropertyEditPage did before: strip four keys, send the rest.
  const { id: _id, createdAt: _c, updatedAt: _u, _slugTouched, ...old } = loaded();
  await assert.rejects(validateBody(UpdatePropertyDto, old), (err) => /trackerProjectId should not exist/.test(messages(err)));
});

test('the editor sends exactly the fields the DTO declares', async () => {
  const { PROPERTY_FIELDS } = await import('../../web/src/admin/propertyPayload.js');
  const declared = new Set(
    getMetadataStorage()
      .getTargetValidationMetadatas(UpdatePropertyDto, '', true, false)
      .map((m) => m.propertyName),
  );
  // A DTO field missing from the editor's list would be silently unsaveable;
  // one in the list but not the DTO would 400 every save.
  assert.deepEqual([...declared].sort(), [...PROPERTY_FIELDS, 'expectedUpdatedAt'].sort());
});

// ── Conflict check on property saves ──────────────────────────────────────

function propertiesWith(storedUpdatedAt: string | null) {
  const calls = { queries: [] as string[], updates: [] as any[] };
  const tx: any = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      calls.queries.push(strings.join('?'));
      return storedUpdatedAt ? [{ updated_at: new Date(storedUpdatedAt) }] : [];
    },
    property: {
      update: async (args: any) => {
        calls.updates.push(args);
        return { id: args.where.id, ...args.data };
      },
    },
  };
  const prisma: any = {
    $transaction: async (work: (t: any) => unknown) => work(tx),
    property: {
      findUnique: async () => ({ id: 'p' }),
      update: async (args: any) => {
        calls.updates.push(args);
        return args.data;
      },
    },
  };
  return { service: new PropertiesService(prisma), calls };
}

const ID = '4b0c43c4-31a1-4d7a-9a3b-7d2f0c1f5e10';

test('a save from the version on file lands, under a row lock, and moves updatedAt forward', async () => {
  const stored = '2026-10-26T10:00:00.123Z';
  const { service, calls } = propertiesWith(stored);
  const saved: any = await service.update(ID, { name: 'Centro Plaza' }, stored);
  assert.match(calls.queries[0], /FOR UPDATE/);
  assert.equal(calls.updates.length, 1);
  assert.ok(saved.updatedAt.getTime() > new Date(stored).getTime());
});

test('a save from an older version is refused with 409 and the version on file', async () => {
  const { service, calls } = propertiesWith('2026-10-26T11:30:00.000Z');
  await assert.rejects(service.update(ID, { name: 'Stale' }, '2026-10-26T10:00:00.123Z'), (err: any) => {
    assert.ok(err instanceof ConflictException);
    assert.equal(err.getStatus(), 409);
    assert.equal((err.getResponse() as any).updatedAt, '2026-10-26T11:30:00.000Z');
    return true;
  });
  assert.equal(calls.updates.length, 0);
});

test('a conditional save of a deleted property is a 404, and an unconditional one skips the lock', async () => {
  await assert.rejects(propertiesWith(null).service.update(ID, {}, '2026-10-26T10:00:00.000Z'), NotFoundException);
  const { service, calls } = propertiesWith('2026-10-26T10:00:00.000Z');
  await service.update(ID, { name: 'x' });
  assert.equal(calls.queries.length, 0);
  assert.equal(calls.updates.length, 1);
});

test('the controller passes expectedUpdatedAt to the check, never to the row', async () => {
  let args: any[] = [];
  const controller = new PropertiesAdminController({ update: async (...a: any[]) => (args = a) } as any);
  const dto: any = await validateBody(UpdatePropertyDto, { name: 'Centro', expectedUpdatedAt: '2026-10-26T10:00:00.123Z' });
  await controller.update(ID, dto);
  assert.deepEqual(args[1], { name: 'Centro' });
  assert.equal(args[2], '2026-10-26T10:00:00.123Z');
  await assert.rejects(validateBody(UpdatePropertyDto, { expectedUpdatedAt: 'yesterday' }), /Bad Request/);
});

// ── Leads: staff notification, spam, paging ───────────────────────────────

type MailFake = { to: string; subject: string; text: string; replyTo?: string };

/** Lets the work a request leaves running after its response finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

function leadsWith(
  options: {
    failFor?: string[];
    hangFor?: string[];
    config?: Record<string, string>;
    property?: any;
    recent?: number;
    page?: { id: string }[];
  } = {},
) {
  const calls = { created: [] as any[], mail: [] as MailFake[], queries: [] as any[], findMany: [] as any[], counts: [] as any[] };
  const prisma: any = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.queries.push(Prisma.sql(strings, ...(values as any[])));
      return options.page ?? [];
    },
    websiteLead: {
      create: async (args: any) => {
        calls.created.push(args);
        const { unitAttributions, ...data } = args.data;
        return {
          id: 'lead-1',
          phone: null,
          message: null,
          status: 'new',
          source: 'contact',
          context: null,
          spam: false,
          spamReason: null,
          createdAt: new Date(),
          ...data,
          unitAttributions: unitAttributions ? [unitAttributions.create] : [],
        };
      },
      count: async (args: any) => {
        calls.counts.push(args);
        return options.recent ?? 0;
      },
      findMany: async (args: any) => {
        calls.findMany.push(args);
        // Deliberately out of order: the page's order comes from the SQL.
        return [...args.where.id.in].reverse().map((id: string) => ({ id }));
      },
      groupBy: async () => [
        { status: 'new', _count: { _all: 2 } },
        { status: 'read', _count: { _all: 5 } },
      ],
    },
    property: { findUnique: async () => options.property ?? null },
  };
  const mail: any = {
    send: (m: MailFake) => {
      calls.mail.push(m);
      if (options.hangFor?.includes(m.to)) return new Promise(() => {});
      if (options.failFor?.includes(m.to)) return Promise.reject(new Error('Email address is not verified.'));
      return Promise.resolve(true);
    },
  };
  const config: any = { get: (key: string) => ({ FRONTEND_URL: 'https://site.test/', ...options.config })[key] };
  return { service: new LeadsService(prisma, mail, config), calls };
}

const enquiry = (extra: Record<string, unknown> = {}): CreateLeadDto =>
  ({ name: 'Ada Lovelace', email: 'ada@example.com', message: 'Is 204 still free?', source: 'contact', fillMs: 9000, ...extra }) as any;

const centro = {
  id: ID,
  name: 'Centro Plaza',
  slug: 'centro-plaza',
  address: '15101 Ronald Reagan Blvd',
  detail: {},
  published: true,
};

test('every new lead emails the sales inbox, with a reply-to and a link to it', async () => {
  const { service, calls } = leadsWith({ property: centro });
  const lead: any = await service.create(enquiry({ propertyId: ID, unitLabel: '204', buildingLabel: 'Building 2' }));
  assert.equal(lead.id, 'lead-1');
  await settle();
  assert.equal(calls.mail.length, 1);
  const [sent] = calls.mail;
  assert.equal(sent.to, DEFAULT_LEADS_NOTIFY_TO);
  assert.equal(sent.replyTo, 'ada@example.com');
  assert.match(sent.subject, /Ada Lovelace — Unit 204 · Building 2 · Centro Plaza/);
  assert.match(sent.text, /Is 204 still free\?/);
  assert.match(sent.text, /https:\/\/site\.test\/admin\/leads#lead-lead-1/);
  // Spam signals are request metadata, never lead columns, and the public
  // answer never carries the spam flag.
  assert.equal('fillMs' in calls.created[0].data, false);
  assert.equal('honeypot' in calls.created[0].data, false);
  assert.equal('spam' in lead, false);
});

test('the lead is answered before the staff email is even sent, so a hanging mailer delays nothing', async () => {
  const { service, calls } = leadsWith({ property: centro, hangFor: [DEFAULT_LEADS_NOTIFY_TO] });
  const timeout = new Promise((resolve) => setTimeout(() => resolve('timed out'), 200));
  const lead: any = await Promise.race([service.create(enquiry()), timeout]);
  assert.equal(lead.id, 'lead-1');
  const brochure: any = await Promise.race([
    service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID, fillMs: 9000 } as any),
    timeout,
  ]);
  assert.equal(brochure.emailed, true);
  await settle();
  assert.equal(calls.mail.filter((m) => m.to === DEFAULT_LEADS_NOTIFY_TO).length, 2, 'both notifications were started');
});

test('a failed notification is logged and the lead is still saved and returned', async () => {
  const { service, calls } = leadsWith({ failFor: [DEFAULT_LEADS_NOTIFY_TO] });
  const lead: any = await service.create(enquiry());
  await settle();
  assert.equal(lead.id, 'lead-1');
  assert.equal(calls.created.length, 1);
});

test('LEADS_NOTIFY_TO picks the inbox, and a comma list is sent to at once, one stalled inbox holding up no other', async () => {
  const { service, calls } = leadsWith({
    config: { LEADS_NOTIFY_TO: 'a@prime.test, b@prime.test', FRONTEND_URL: 'http://localhost:5173' },
    hangFor: ['a@prime.test'],
  });
  await service.create(enquiry());
  await settle();
  assert.deepEqual(calls.mail.map((m) => m.to), ['a@prime.test', 'b@prime.test']);
  // No dead localhost link in anyone's inbox.
  assert.doesNotMatch(calls.mail[0].text, /localhost/);
});

test("the staff email says when the visitor's brochure email did not go", async () => {
  const failed = leadsWith({ property: centro, failFor: ['ada@example.com'] });
  const result = await failed.service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID, fillMs: 9000 } as any);
  await settle();
  assert.equal(result.emailed, false);
  const staff = failed.calls.mail.find((m) => m.to === DEFAULT_LEADS_NOTIFY_TO)!;
  assert.match(staff.subject, /Brochure request: Centro Plaza — Ada/);
  assert.match(staff.text, /NOT emailed, because the send failed \(Email address is not verified\.\)/);

  const limited = leadsWith({ property: centro, recent: 3 });
  await limited.service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID } as any);
  await settle();
  assert.equal(limited.calls.mail.length, 1, 'only the staff email; the visitor is over the daily limit');
  assert.match(limited.calls.mail[0].text, /NOT emailed, because .*daily limit/);
  assert.equal(limited.calls.counts[0].where.spam, false, 'filtered requests do not use up the allowance');

  const noFlyer = leadsWith({ property: centro });
  const ok = await noFlyer.service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID } as any);
  await settle();
  assert.equal(ok.emailed, true);
  assert.match(noFlyer.calls.mail[1].text, /none on file for this property/);
});

test('a filled honeypot or a too-fast form is kept as filtered, answered as a real one, and emails nobody', async () => {
  for (const [tell, reason] of [
    [{ honeypot: 'https://spam.example' }, /honeypot/],
    [{ fillMs: MIN_FILL_MS - 1 }, /sent \d+ms after/],
  ] as const) {
    const { service, calls } = leadsWith({ property: centro });
    const lead: any = await service.create(enquiry(tell));
    assert.equal(lead.id, 'lead-1');
    assert.equal(calls.created[0].data.spam, true);
    assert.match(calls.created[0].data.spamReason, reason);
    assert.equal('spam' in lead || 'spamReason' in lead, false, 'the answer looks like any other');

    const brochure = await service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID, ...tell } as any);
    assert.equal(brochure.emailed, false);
    assert.equal(calls.created[1].data.spam, true);
    await settle();
    assert.equal(calls.mail.length, 0, 'no brochure, no staff email');
  }
  // Autofill and a quick Send is still a person; a form from before this check
  // sends neither field. Both go through.
  for (const extra of [{ fillMs: MIN_FILL_MS }, { fillMs: undefined }]) {
    const { service, calls } = leadsWith();
    await service.create(enquiry(extra));
    assert.equal(calls.created[0].data.spam, undefined);
  }
  assert.equal(MIN_FILL_MS, 1000);
});

test('the lead DTO accepts the two spam fields, any fill time however long, and still nothing else', async () => {
  const body = { name: 'Ada', email: 'ada@example.com', message: 'hi', honeypot: '', fillMs: 4000 };
  const dto: any = await validateBody(CreateLeadDto, body);
  assert.equal(dto.fillMs, 4000);
  // A tab left open for a month.
  assert.equal(((await validateBody(CreateLeadDto, { ...body, fillMs: 30 * 24 * 3600 * 1000 })) as any).fillMs, 2592000000);
  await assert.rejects(validateBody(CreateLeadDto, { ...body, admin: true }), (err) => /admin should not exist/.test(messages(err)));
  await assert.rejects(validateBody(CreateLeadDto, { ...body, website: 'x' }), (err) => /website should not exist/.test(messages(err)));
  await assert.rejects(validateBody(CreateLeadDto, { ...body, fillMs: -1 }), /Bad Request/);
});

test('the admin list pages by (createdAt, id), so a deleted cursor lead still marks the place', async () => {
  const { service, calls } = leadsWith({ page: [{ id: 'b' }, { id: 'a' }] });
  const first: any[] = await service.findAll();
  assert.deepEqual(first.map((l) => l.id), ['b', 'a'], 'in the order the SQL chose');
  assert.match(calls.queries[0].sql, /WHERE spam = \?\s+ORDER BY date_trunc\('milliseconds', created_at\) DESC, id DESC/);
  assert.deepEqual(calls.queries[0].values, [false, 100]);

  await service.findAll({ limit: 20, before: '2026-10-27T10:00:00.123Z', beforeId: 'f5b8c8d2-4a8f-4a52-9b3e-1f1a2b3c4d5e', filtered: 'true' });
  const second = calls.queries[1];
  // Compared as a pair, not looked up by id: nothing needs the cursor row to exist.
  assert.match(second.sql, /AND \(date_trunc\('milliseconds', created_at\), id\) < \(\?::timestamptz, \?::uuid\)/);
  assert.deepEqual(second.values, [true, new Date('2026-10-27T10:00:00.123Z'), 'f5b8c8d2-4a8f-4a52-9b3e-1f1a2b3c4d5e', 20]);

  const query: any = await validateQuery(ListLeadsQueryDto, { limit: '20', filtered: 'false' });
  assert.equal(query.limit, 20);
  await assert.rejects(validateQuery(ListLeadsQueryDto, { limit: '501' }), /Bad Request/);
  await assert.rejects(validateQuery(ListLeadsQueryDto, { beforeId: 'not-a-uuid' }), /Bad Request/);
  await assert.rejects(validateQuery(ListLeadsQueryDto, { filtered: 'yes' }), /Bad Request/);
});

test('the badge counts come from the database, and a filtered lead can be moved to the inbox', async () => {
  const { service } = leadsWith();
  assert.deepEqual(await service.summary(), { byStatus: { new: 2, read: 5 }, total: 7, filtered: 0 });

  let updated: any;
  const prisma: any = {
    websiteLead: { findUnique: async () => ({ id: 'x' }), update: async (args: any) => (updated = args) },
  };
  const leads = new LeadsService(prisma, {} as any, { get: () => undefined } as any);
  await leads.update('x', { spam: false });
  assert.deepEqual(updated.data, { spam: false });
  await assert.rejects(leads.update('x', {}), /Nothing to change/);
  const dto: any = await validateBody(UpdateLeadDto, { spam: false });
  assert.equal(dto.spam, false);
});

// ── Unit labels: what blocks a property save ──────────────────────────────

test('a label clash only blocks the save when the editor can fix it', async () => {
  const { unitLabelProblems } = await import('../../web/src/admin/unitChecks.js');
  const tracker = (label: string, id: string) => ({ label, trackerUnitIds: [id] });
  const website = (label: string) => ({ label });
  const building = (unitList: any[]) => [{ building: 'Building 1', unitList }];

  // Two tracker-owned "101"s: the tracker allows it, and both labels and
  // Delete are locked here — so a warning, never a wedge.
  const trackerOnly = unitLabelProblems(building([tracker('101', 't1'), tracker('101', 't2')]));
  assert.equal(trackerOnly.errors.length, 0);
  assert.match(trackerOnly.warnings[0].text, /Prime Tracker/);

  // Any editable row in the clash can be renamed, so it blocks.
  assert.equal(unitLabelProblems(building([tracker('101', 't1'), website('101')])).errors.length, 1);
  assert.equal(unitLabelProblems(building([website('101'), website('101')])).errors.length, 1);
  assert.equal(unitLabelProblems(building([website('')])).errors.length, 1);

  // A tracker row with no number is the tracker's to fix.
  const emptyTracker = unitLabelProblems(building([tracker('', 't3')]));
  assert.equal(emptyTracker.errors.length, 0);
  assert.match(emptyTracker.warnings[0].text, /Prime Tracker/);

  // Anything new since the form loaded blocks, whoever owns the rows.
  const clash = building([tracker('101', 't1'), tracker('101', 't2')]);
  assert.equal(unitLabelProblems(clash, building([tracker('101', 't1'), tracker('102', 't2')])).errors.length, 1);
  assert.equal(unitLabelProblems(clash, clash).errors.length, 0);
});
