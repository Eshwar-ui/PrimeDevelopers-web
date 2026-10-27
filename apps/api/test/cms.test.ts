// CMS and lead fixes from docs/website-audit-2026-10-27.md: the property
// editor's payload (C1), the conflict check on property saves, and lead
// delivery, spam and paging.
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
import { CreateLeadDto, ListLeadsQueryDto } from '../src/modules/leads/dto/lead.dto';
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

function leadsWith(options: { failFor?: string[]; config?: Record<string, string>; property?: any; recent?: number } = {}) {
  const calls = { created: [] as any[], mail: [] as MailFake[], findMany: [] as any[] };
  const prisma: any = {
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
          createdAt: new Date(),
          ...data,
          unitAttributions: unitAttributions ? [unitAttributions.create] : [],
        };
      },
      count: async () => options.recent ?? 0,
      findMany: async (args: any) => {
        calls.findMany.push(args);
        return [];
      },
    },
    property: { findUnique: async () => options.property ?? null },
  };
  const mail: any = {
    send: async (m: MailFake) => {
      calls.mail.push(m);
      if (options.failFor?.includes(m.to)) throw new Error('Email address is not verified.');
      return true;
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
  assert.equal(calls.mail.length, 1);
  const [sent] = calls.mail;
  assert.equal(sent.to, DEFAULT_LEADS_NOTIFY_TO);
  assert.equal(sent.replyTo, 'ada@example.com');
  assert.match(sent.subject, /Ada Lovelace — Unit 204 · Building 2 · Centro Plaza/);
  assert.match(sent.text, /Is 204 still free\?/);
  assert.match(sent.text, /https:\/\/site\.test\/admin\/leads#lead-lead-1/);
  // Spam signals are request metadata, never lead columns.
  assert.equal('fillMs' in calls.created[0].data, false);
  assert.equal('website' in calls.created[0].data, false);
});

test('a failed notification is logged and the lead is still saved and returned', async () => {
  const { service, calls } = leadsWith({ failFor: [DEFAULT_LEADS_NOTIFY_TO] });
  const lead: any = await service.create(enquiry());
  assert.equal(lead.id, 'lead-1');
  assert.equal(calls.created.length, 1);
});

test('LEADS_NOTIFY_TO picks the inbox, and a comma list reaches each one', async () => {
  const { service, calls } = leadsWith({ config: { LEADS_NOTIFY_TO: 'a@prime.test, b@prime.test', FRONTEND_URL: 'http://localhost:5173' } });
  await service.create(enquiry());
  assert.deepEqual(calls.mail.map((m) => m.to), ['a@prime.test', 'b@prime.test']);
  // No dead localhost link in anyone's inbox.
  assert.doesNotMatch(calls.mail[0].text, /localhost/);
});

test("the staff email says when the visitor's brochure email did not go", async () => {
  const failed = leadsWith({ property: centro, failFor: ['ada@example.com'] });
  const result = await failed.service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID, fillMs: 9000 } as any);
  assert.equal(result.emailed, false);
  const staff = failed.calls.mail.find((m) => m.to === DEFAULT_LEADS_NOTIFY_TO)!;
  assert.match(staff.subject, /Brochure request: Centro Plaza — Ada/);
  assert.match(staff.text, /NOT emailed, because the send failed \(Email address is not verified\.\)/);

  const limited = leadsWith({ property: centro, recent: 3 });
  await limited.service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID } as any);
  assert.equal(limited.calls.mail.length, 1, 'only the staff email; the visitor is over the daily limit');
  assert.match(limited.calls.mail[0].text, /NOT emailed, because .*daily limit/);

  const noFlyer = leadsWith({ property: centro });
  const ok = await noFlyer.service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID } as any);
  assert.equal(ok.emailed, true);
  assert.match(noFlyer.calls.mail[1].text, /none on file for this property/);
});

test('a filled honeypot or a too-fast form is answered as success, and nothing is written or sent', async () => {
  for (const tell of [{ website: 'https://spam.example' }, { fillMs: MIN_FILL_MS - 1 }]) {
    const { service, calls } = leadsWith({ property: centro });
    const lead: any = await service.create(enquiry(tell));
    assert.ok(lead.id && lead.id !== 'lead-1');
    assert.equal(calls.created.length, 0);
    assert.equal(calls.mail.length, 0);

    const brochure = await service.requestBrochure({ name: 'Ada', email: 'ada@example.com', propertyId: ID, ...tell } as any);
    assert.equal(brochure.emailed, false);
    assert.equal(calls.mail.length, 0);
  }
  // A form from before this check sends neither field, and still goes through.
  const { service, calls } = leadsWith();
  await service.create(enquiry({ fillMs: undefined }));
  assert.equal(calls.created.length, 1);
});

test('the lead DTO accepts the two spam fields, and still nothing else', async () => {
  const body = { name: 'Ada', email: 'ada@example.com', message: 'hi', website: '', fillMs: 4000 };
  const dto: any = await validateBody(CreateLeadDto, body);
  assert.equal(dto.fillMs, 4000);
  await assert.rejects(validateBody(CreateLeadDto, { ...body, admin: true }), (err) => /admin should not exist/.test(messages(err)));
  await assert.rejects(validateBody(CreateLeadDto, { ...body, fillMs: -1 }), /Bad Request/);
});

test('the admin lead list is paged, newest first, by cursor', async () => {
  const { service, calls } = leadsWith();
  await service.findAll();
  await service.findAll({ limit: 20, before: 'f5b8c8d2-4a8f-4a52-9b3e-1f1a2b3c4d5e' });
  assert.equal(calls.findMany[0].take, 100);
  assert.equal(calls.findMany[0].cursor, undefined);
  assert.deepEqual(calls.findMany[0].orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(
    { take: calls.findMany[1].take, cursor: calls.findMany[1].cursor, skip: calls.findMany[1].skip },
    { take: 20, cursor: { id: 'f5b8c8d2-4a8f-4a52-9b3e-1f1a2b3c4d5e' }, skip: 1 },
  );

  const query: any = await validateQuery(ListLeadsQueryDto, { limit: '20' });
  assert.equal(query.limit, 20);
  await assert.rejects(validateQuery(ListLeadsQueryDto, { limit: '501' }), /Bad Request/);
  await assert.rejects(validateQuery(ListLeadsQueryDto, { before: 'not-a-uuid' }), /Bad Request/);
});
