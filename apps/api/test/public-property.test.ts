// The public property projection (security audit 1 Nov 2026, H1): what
// GET /properties and GET /properties/:slug may send a visitor, against the
// whole row the admin routes still return.
//
//   pnpm --filter @prime-developers/api test
//
// Prisma is faked. Nothing here touches a database — apps/api/.env points at
// production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { PropertiesService } from '../src/modules/properties/properties.service';
import { PropertiesController } from '../src/modules/properties/properties.controller';
import { PropertiesAdminController } from '../src/modules/properties/properties.admin.controller';
import {
  PUBLIC_COLUMNS,
  PUBLIC_UNIT_FIELDS,
  toPublicDetail,
  toPublicProperty,
  toPublicUnit,
} from '../src/modules/properties/public-property';

const siteModel = () => ({
  url: 'https://site.test/media/models/centro-site.glb',
  meshNames: ['empty_2', 'empty_3', 'empty_4'],
  unitBindings: { empty_2: { buildingLabel: 'Building 6', unitLabel: '601' } },
  buildingBindings: { empty_3: 'Building 6' },
  roadBindings: { empty_4: 'Ronald Reagan Blvd' },
  roads: [{ name: 'Ronald Reagan Blvd', trafficNote: '' }],
});

// A row as the database holds it once the tracker sync is on: every column,
// tracker ids at each level, a sold unit's buyer and a leased unit's rate.
const row = () => ({
  id: '4b0c43c4-31a1-4d7a-9a3b-7d2f0c1f5e10',
  slug: 'centro-plaza',
  name: 'Centro Plaza',
  address: '15101 Ronald Reagan Blvd, Leander, TX 78641',
  category: 'Retail',
  buildings: 3,
  sold: 2,
  available: 1,
  image: 'https://site.test/media/images/projects/centro.webp',
  gallery: ['https://site.test/media/images/projects/a.webp'],
  sortOrder: 1,
  published: true,
  createdAt: new Date('2026-07-01T09:00:00.000Z'),
  updatedAt: new Date('2026-10-26T10:00:00.123Z'),
  trackerProjectId: 'cmtiyjnbg01bdh360e0mfslii',
  trackerSyncedAt: new Date('2026-10-26T09:00:00.000Z'),
  detail: {
    tagline: 'Retail and office on Ronald Reagan Blvd',
    overview: { eyebrow: 'Leander', heading: 'Centro Plaza', body: '', flyer: '', stats: [] },
    trackerCounts: { units: 3, byStatus: { SOLD: 1, LEASED: 1, AVAILABLE: 1 } },
    siteModel: siteModel(),
    floorPlans: {
      heading: 'Floor plans',
      buildings: [
        {
          building: 'Building 6',
          number: '6',
          planImage: 'https://site.test/media/images/plans/b6.webp',
          units: 3,
          available: 1,
          model: { url: 'https://site.test/media/models/b6.glb', meshNames: ['unit-601', 'Node7'], bindings: { Node7: '602' } },
          trackerBuildingId: 'cmtbld000000000000000006',
          tracker: { id: 'cmtbld000000000000000006', name: 'B-6', totalSqft: 9000, stories: 1 },
          unitList: [
            {
              label: '601',
              status: 'sold',
              tenant: 'Jane Q. Buyer',
              tenantUrl: 'https://janeqbuyer.test',
              tenantCategory: 'Private',
              size: '1,500',
              floor: 'Ground',
              rate: '$450,000',
              frontage: '25 ft',
              description: 'Retail unit.',
              x: 12,
              y: 40,
              logo: '',
              images: ['https://site.test/media/images/units/601.webp'],
              facingRoad: '',
              trackerUnitIds: ['cmtunit00000000000000601'],
              tracker: {
                ids: ['cmtunit00000000000000601'],
                unitNumber: '601',
                status: 'SOLD',
                sqft: 1500,
                unitType: 'RETAIL',
                availableSince: null,
                occupant: null,
                syncedAt: '2026-10-26T09:00:00.000Z',
              },
            },
            {
              label: '602',
              status: 'leased',
              tenant: 'Lava Coffee',
              tenantUrl: 'https://lava.test',
              tenantCategory: 'Coffee',
              description: 'Espresso bar on the corner.',
              size: '1,200',
              rate: '$28 / SF / yr',
              logo: 'https://site.test/media/images/logos/lava.webp',
              trackerUnitIds: ['cmtunit00000000000000602'],
              tracker: { ids: ['cmtunit00000000000000602'], occupant: 'Lava Coffee LLC', availableSince: null },
            },
            {
              label: '603',
              status: 'available',
              tenant: '',
              size: '1,100',
              rate: '$30 / SF / yr',
              trackerUnitIds: ['cmtunit00000000000000603'],
              tracker: { ids: ['cmtunit00000000000000603'], occupant: null, availableSince: '2026-09-01' },
            },
          ],
        },
      ],
    },
    pricing: {
      units: { rows: [{ unit: '603', size: '1,100', lease: '$30' }] },
      capRate: { showTenantNames: false, rows: [{ unit: '602', tenant: 'Lava Coffee', businessType: 'Coffee', capRate: '7.10%' }] },
    },
  },
});

const unitsOf = (property: any) => property.detail.floorPlans.buildings[0].unitList;
const json = (value: unknown) => JSON.stringify(value);

test('only the columns the public site reads go out — no tracker ids, timestamps, sort order or draft flag', () => {
  const out = toPublicProperty({ ...row(), someFutureColumn: 'secret' });
  assert.deepEqual(Object.keys(out).sort(), [...PUBLIC_COLUMNS].sort());
  for (const gone of ['trackerProjectId', 'trackerSyncedAt', 'sortOrder', 'published', 'createdAt', 'updatedAt', 'someFutureColumn']) {
    assert.equal(gone in out, false, gone);
  }
});

test('no tracker field survives at any level, nor any tracker id anywhere in the response', () => {
  const source = row();
  const out = toPublicProperty(source);
  const building = out.detail.floorPlans.buildings[0];
  assert.equal('trackerCounts' in out.detail, false);
  assert.equal('trackerBuildingId' in building, false);
  assert.equal('tracker' in building, false);
  for (const unit of building.unitList) {
    assert.equal('trackerUnitIds' in unit, false);
    assert.equal('tracker' in unit, false);
  }
  const body = json(out);
  assert.doesNotMatch(body, /cmt[a-z0-9]{20,}/, 'a Prime Tracker cuid is in the public body');
  assert.doesNotMatch(body, /Lava Coffee LLC|availableSince/);
});

test('a unit row carries only the allowlisted fields', () => {
  const out = toPublicUnit({ label: '700', status: 'available', notes: 'internal', askingRent: '$31', _originalLabel: '700' });
  assert.deepEqual(out, { label: '700', status: 'available' });
});

test("a sold unit's owner — name, website and category — is withheld; its description, photos, size and pin stay", () => {
  const [sold] = unitsOf(toPublicProperty(row()));
  assert.equal('tenant' in sold, false);
  assert.equal('tenantUrl' in sold, false);
  assert.equal('tenantCategory' in sold, false);
  assert.equal('rate' in sold, false);
  // The editor's copy is published as written: keeping a buyer out of it is
  // the CMS's job, not this filter's.
  assert.equal(sold.description, 'Retail unit.');
  assert.deepEqual(sold.images, ['https://site.test/media/images/units/601.webp']);
  assert.equal(sold.size, '1,500');
  assert.equal(sold.x, 12);
  assert.equal(sold.y, 40);
  assert.doesNotMatch(json(toPublicProperty(row())), /Jane Q\. Buyer|janeqbuyer|\$450,000/);
});

test("a leased unit's tenant is public and its rate is not; an available unit keeps its rate", () => {
  const [, leased, available] = unitsOf(toPublicProperty(row()));
  assert.equal(leased.tenant, 'Lava Coffee');
  assert.equal(leased.tenantUrl, 'https://lava.test');
  assert.equal(leased.tenantCategory, 'Coffee');
  assert.equal(leased.description, 'Espresso bar on the corner.');
  assert.equal(leased.logo, 'https://site.test/media/images/logos/lava.webp');
  assert.equal('rate' in leased, false);
  assert.equal(available.rate, '$30 / SF / yr');
  assert.equal(toPublicUnit({ label: '9', status: 'coming-soon', rate: '$25' }).rate, '$25');
  // No status reads as available on the site, and is treated as such.
  assert.equal(toPublicUnit({ label: '9', rate: '$25', tenant: 'Pop-up' }).rate, '$25');
});

test('the CMS opt-ins publish them, and only a literal true counts', () => {
  const sold = {
    label: '601',
    status: 'sold',
    tenant: 'Dental Partners',
    tenantUrl: 'https://dp.test',
    rate: '$450,000',
  };
  const optedIn = toPublicUnit({ ...sold, publishTenant: true, publishRate: true });
  assert.equal(optedIn.tenant, 'Dental Partners');
  assert.equal(optedIn.tenantUrl, 'https://dp.test');
  assert.equal(optedIn.rate, '$450,000');
  // Each flag publishes only its own fields.
  assert.equal('rate' in toPublicUnit({ ...sold, publishTenant: true }), false);
  assert.equal('tenant' in toPublicUnit({ ...sold, publishRate: true }), false);
  // The flags themselves are the CMS's, not the visitor's.
  assert.equal('publishTenant' in optedIn, false);
  assert.equal('publishRate' in optedIn, false);

  for (const loose of ['true', 1, 'yes', {}]) {
    const out = toPublicUnit({ ...sold, publishTenant: loose, publishRate: loose });
    assert.equal('tenant' in out, false, `publishTenant: ${json(loose)}`);
    assert.equal('rate' in out, false, `publishRate: ${json(loose)}`);
  }
  assert.equal(toPublicUnit({ label: '602', status: 'leased', rate: '$28', publishRate: true }).rate, '$28');
});

test('a status the projection does not know withholds both, so a new status cannot publish a buyer', () => {
  const out = toPublicUnit({ label: '1', status: 'under-contract', tenant: 'A. Person', rate: '$1' });
  assert.deepEqual(out, { label: '1', status: 'under-contract' });
});

test('the site model and per-building models go out untouched — the 3D viewer needs every binding', () => {
  const source = row();
  const out = toPublicProperty(source);
  assert.deepEqual(out.detail.siteModel, siteModel());
  assert.deepEqual(out.detail.floorPlans.buildings[0].model, source.detail.floorPlans.buildings[0].model);
  assert.equal(out.detail.floorPlans.buildings[0].planImage, source.detail.floorPlans.buildings[0].planImage);
  assert.equal(out.detail.tagline, source.detail.tagline);
  assert.deepEqual(out.detail.overview, source.detail.overview);
});

test("the 3D site model resolves every shape from the public copy as it does from the row", async () => {
  const { reconcileSite } = await import('../../web/src/lib/siteModel.js');
  const { reconcile } = await import('../../web/src/lib/units.js');
  const fixture = JSON.parse(readFileSync(join(__dirname, '../../web/test/fixtures/centro-plaza-site.json'), 'utf8'));

  const shapes = (detail: any) =>
    reconcileSite(detail.siteModel.meshNames, detail.floorPlans.buildings, detail.siteModel).resolved.map((e: any) => [
      e.meshName,
      e.kind,
      e.building?.building ?? null,
      e.unit?.label ?? null,
      e.unit?.status ?? null,
      e.road?.name ?? null,
    ]);
  const before = shapes(fixture.detail);
  assert.ok(before.length > 100, 'the fixture resolves its shapes');
  assert.deepEqual(shapes(toPublicDetail(fixture.detail)), before);

  // And a per-building model, bound by name and by an explicit binding.
  const building = row().detail.floorPlans.buildings[0];
  const [publicBuilding] = toPublicDetail(row().detail).floorPlans.buildings;
  const matched = (b: any) =>
    reconcile(b.model.meshNames, b.unitList.map((u: any, index: number) => ({ ...u, index })), b.model.bindings).matched.map(
      (m: any) => [m.meshName, m.unit.label],
    );
  assert.deepEqual(matched(publicBuilding), matched(building));
  assert.deepEqual(matched(publicBuilding), [['unit-601', '601'], ['Node7', '602']]);
});

test('every field a new unit is created with is one the projection has decided on', async () => {
  const { makeUnit } = await import('../../web/src/lib/units.js');
  for (const key of Object.keys(makeUnit('101'))) {
    assert.ok((PUBLIC_UNIT_FIELDS as readonly string[]).includes(key), `makeUnit() has "${key}", which the public projection drops`);
  }
});

test("cap-rate pricing rows lose the tenant's name until showTenantNames is on", () => {
  const out = toPublicProperty(row());
  assert.deepEqual(out.detail.pricing.capRate.rows, [{ unit: '602', businessType: 'Coffee', capRate: '7.10%' }]);
  assert.deepEqual(out.detail.pricing.units, row().detail.pricing.units);

  const shown = row();
  shown.detail.pricing.capRate.showTenantNames = true;
  assert.equal(toPublicProperty(shown).detail.pricing.capRate.rows[0].tenant, 'Lava Coffee');
});

test('odd shapes are tolerated: no detail, no floor plans, a non-array unit list, a null row', () => {
  assert.deepEqual(toPublicProperty({ id: 'p', slug: 's', name: 'N', detail: null }).detail, {});
  assert.deepEqual(toPublicDetail({ floorPlans: { heading: 'h' } }), { floorPlans: { heading: 'h' } });
  assert.deepEqual(toPublicDetail({ floorPlans: { buildings: [{ building: 'B', unitList: { a: 1 } }] } }).floorPlans.buildings, [
    { building: 'B', unitList: [] },
  ]);
  // Positions are kept: units are addressed by their index in the list.
  assert.deepEqual(toPublicDetail({ floorPlans: { buildings: [{ building: 'B', unitList: [null, { label: '2' }] }] } }).floorPlans.buildings[0].unitList, [
    {},
    { label: '2' },
  ]);
});

// The controllers over one fake database, so the routes are tested as wired.
function controllers(stored: any[]) {
  const prisma: any = {
    property: {
      findMany: async ({ where }: any) => stored.filter((p) => !where?.published || p.published),
      findUnique: async ({ where }: any) => stored.find((p) => p.slug === where.slug) ?? null,
    },
  };
  const service = new PropertiesService(prisma);
  return { publicRoutes: new PropertiesController(service), adminRoutes: new PropertiesAdminController(service) };
}

test('GET /properties and GET /properties/:slug answer with the projection', async () => {
  const { publicRoutes } = controllers([row(), { ...row(), slug: 'draft', published: false }]);

  const list = await publicRoutes.findAll();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], toPublicProperty(row()));

  const one = await publicRoutes.findOne('centro-plaza');
  assert.deepEqual(one, toPublicProperty(row()));
  assert.equal('trackerProjectId' in one, false);
  assert.equal('tenant' in unitsOf(one)[0], false);

  // A draft is still indistinguishable from a property that does not exist.
  await assert.rejects(publicRoutes.findOne('draft'), NotFoundException);
});

test('the admin routes still return the whole row, so an editor saves nothing away', async () => {
  const { adminRoutes } = controllers([row(), { ...row(), slug: 'draft', published: false }]);

  const list = await adminRoutes.findAll();
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], row());

  const one: any = await adminRoutes.findOne('centro-plaza');
  assert.equal(one.trackerProjectId, 'cmtiyjnbg01bdh360e0mfslii');
  assert.ok(one.detail.trackerCounts);
  assert.equal(unitsOf(one)[0].tenant, 'Jane Q. Buyer');
  assert.equal(unitsOf(one)[1].rate, '$28 / SF / yr');
  assert.deepEqual(unitsOf(one)[0].trackerUnitIds, ['cmtunit00000000000000601']);
  assert.equal(one.detail.floorPlans.buildings[0].trackerBuildingId, 'cmtbld000000000000000006');
});
