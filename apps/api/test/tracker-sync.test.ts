// Prime Tracker → website sync: the merge and the request signature.
//
//   pnpm --filter @prime-developers/api test
//
// Pure functions only — nothing here touches a database, which matters because
// apps/api/.env points at production. The service tests run against an
// in-memory stand-in for Prisma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SiteModel,
  SnapshotBuilding,
  SnapshotUnit,
  TrackerSnapshot,
  Totals,
  mergeSnapshot,
  normaliseLabel,
  toRows,
} from '../src/modules/tracker-sync/tracker-merge';
import { sign, verify } from '../src/modules/tracker-sync/tracker-signature';
import { TrackerSnapshotDto } from '../src/modules/tracker-sync/dto/snapshot.dto';
import { TrackerSyncService } from '../src/modules/tracker-sync/tracker-sync.service';

const unit = (id: string, unitNumber: string, status: SnapshotUnit['status'], extra: Partial<SnapshotUnit> = {}): SnapshotUnit => ({
  id,
  unitNumber,
  status,
  sqft: null,
  dealRef: null,
  occupant: null,
  ...extra,
});

const snapshot = (buildings: SnapshotBuilding[], version: 1 | 2 = 1): TrackerSnapshot => ({
  version,
  generatedAt: '2026-10-23T10:00:00.000Z',
  project: { id: 'proj-centro', name: 'Centro Plaza', websiteSlug: 'centro-plaza' },
  buildings,
});

const ZERO: Totals = { buildings: 0, sold: 0, available: 0 };

/** What Postgres jsonb does to a stored object: keys shortest first, then bytewise. */
function jsonbRoundTrip<T>(value: T): T {
  const order = (v: any): any => {
    if (Array.isArray(v)) return v.map(order);
    if (!v || typeof v !== 'object') return v;
    const keys = Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(keys.map((k) => [k, order(v[k])]));
  };
  return order(JSON.parse(JSON.stringify(value)));
}

const labels = (floorPlans: any, b = 0) => floorPlans.buildings[b].unitList.map((u: any) => u.label);
const row = (floorPlans: any, b: number, label: string) => floorPlans.buildings[b].unitList.find((u: any) => u.label === label);

test('units let together as one deal become one row; mixed-status deals do not', () => {
  const rows = toRows([
    unit('a', '204', 'LEASED', { dealRef: 'LEASE:JB', sqft: 1510, occupant: 'JB Sree Ventures' }),
    unit('b', '203', 'LEASED', { dealRef: 'LEASE:JB', sqft: 1510 }),
    unit('c', '205', 'SOLD', { dealRef: 'SALE:X' }),
    unit('d', '206', 'AVAILABLE', { dealRef: 'SALE:X' }),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.label, r.status, r.ids, r.sqft, r.occupant]),
    [
      ['203+204', 'leased', ['b', 'a'], 3020, 'JB Sree Ventures'],
      ['205', 'sold', ['c'], null, null],
      ['206', 'available', ['d'], null, null],
    ],
  );
});

test('a single record named with plus signs is one row and one unit', () => {
  const { report } = mergeSnapshot(
    { buildings: [{ building: 'Building 2', unitList: [] }] },
    ZERO,
    snapshot([{ id: 'b2', name: 'Building 2', units: [unit('s', '201+202+203+204', 'SOLD')] }]),
  );
  assert.equal(report.buildings[0].units, 1);
  assert.deepEqual(report.buildings[0].added, ['201+202+203+204']);
});

test('first sync matches by label, keeps website fields and stamps tracker ids', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 9',
        planImage: 'plan.png',
        unitList: [
          { label: '908', status: 'available', tenant: '', size: '', rate: '$24/SF', images: ['a.jpg', 'b.jpg'], x: 10, y: 20 },
        ],
      },
    ],
  };
  const { floorPlans: next, totals, report } = mergeSnapshot(
    floorPlans,
    { buildings: 1, sold: 0, available: 1 },
    snapshot([{ id: 'b9', name: 'Building 9', units: [unit('u908', '908', 'SOLD', { sqft: 1421 })] }]),
  );
  const row = next.buildings[0].unitList[0];
  assert.equal(next.buildings[0].trackerBuildingId, 'b9');
  assert.equal(next.buildings[0].planImage, 'plan.png');
  assert.deepEqual(row.trackerUnitIds, ['u908']);
  assert.equal(row.status, 'sold');
  assert.equal(row.size, '1,421');
  assert.deepEqual(row.images, ['a.jpg', 'b.jpg']);
  assert.equal(row.rate, '$24/SF');
  assert.deepEqual([row.x, row.y], [10, 20]);
  assert.deepEqual(totals, { buildings: 1, sold: 1, available: 0 });
  assert.deepEqual(report.buildings[0].statusChanged, [{ label: '908', from: 'available', to: 'sold' }]);
  assert.equal(report.changed, true);
});

test('later syncs follow tracker ids through a renumbering', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 7',
        trackerBuildingId: 'b7',
        unitList: [{ label: '701', status: 'available', trackerUnitIds: ['u1'], images: ['shop.jpg'] }],
      },
    ],
  };
  const { floorPlans: next, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([{ id: 'b7', name: 'Bldg 07', units: [unit('u1', '701A', 'AVAILABLE')] }]),
  );
  assert.equal(next.buildings[0].unitList[0].label, '701A');
  assert.deepEqual(next.buildings[0].unitList[0].images, ['shop.jpg']);
  assert.deepEqual(report.buildings[0].relabelled, [{ from: '701', to: '701A' }]);
  assert.equal(report.buildings[0].matchedBy, 'id');
});

test('tenant: from the lease when leased, cleared when available, left alone when sold', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 1',
        unitList: [
          { label: '101', status: 'leased', tenant: 'Old Cafe' },
          { label: '102', status: 'leased', tenant: 'Gone Ltd' },
          { label: '103', status: 'sold', tenant: 'Owner Dental' },
        ],
      },
    ],
  };
  const { floorPlans: next } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      {
        id: 'b1',
        name: 'Building 1',
        units: [
          unit('u101', '101', 'LEASED', { occupant: 'New Cafe' }),
          unit('u102', '102', 'AVAILABLE'),
          unit('u103', '103', 'SOLD'),
        ],
      },
    ]),
  );
  assert.deepEqual(
    next.buildings[0].unitList.map((u: any) => u.tenant),
    ['New Cafe', '', 'Owner Dental'],
  );
});

test('buildings the tracker lacks are untouched and still counted; unknown tracker buildings are reported and counted', () => {
  const floorPlans = {
    buildings: [
      { building: 'Building 1', unitList: [{ label: '101', status: 'available' }] },
      { building: 'Building 3', units: 6, available: 2, unitList: [{ label: '301+302+303', status: 'sold' }] },
    ],
  };
  const { floorPlans: next, totals, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      { id: 'b1', name: 'Building 1', units: [unit('u101', '101', 'AVAILABLE')] },
      { id: 'b5', name: 'Building 5', units: [unit('u501', '501', 'AVAILABLE')] },
    ]),
  );
  assert.deepEqual(next.buildings[1], floorPlans.buildings[1]);
  assert.deepEqual(report.untouched, ['Building 3']);
  assert.deepEqual(report.unmatchedTrackerBuildings, [{ id: 'b5', name: 'Building 5', units: 1, available: 1, rows: ['501'] }]);
  // Building 5's unit is the project's even though the site has no plan for it.
  assert.deepEqual(totals, { buildings: 8, sold: 4, available: 4 });
  assert.match(report.refused ?? '', /tracker buildings with no website building: Building 5 \(1 units\)/);
});

test('an ambiguous building name matches nothing', () => {
  const { report } = mergeSnapshot(
    { buildings: [{ building: 'Building 1', unitList: [] }] },
    ZERO,
    snapshot([
      { id: 'x', name: 'Building 1', units: [] },
      { id: 'y', name: 'Bldg 01', units: [] },
    ]),
  );
  assert.deepEqual(report.untouched, ['Building 1']);
});

test('a snapshot that would empty the site is refused unless forced', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 6',
        unitList: Array.from({ length: 20 }, (_, i) => ({ label: String(601 + i), status: 'available' })),
      },
    ],
  };
  const tracker = snapshot([{ id: 'b6', name: 'Building 6', units: [unit('u605', '605', 'LEASED')] }]);

  const refused = mergeSnapshot(floorPlans, ZERO, tracker);
  assert.equal(refused.report.removedRows, 19);
  assert.match(refused.report.refused ?? '', /would remove 19 of 20/);

  const forced = mergeSnapshot(floorPlans, ZERO, tracker, { force: true });
  assert.equal(forced.report.refused, null);
  assert.equal(forced.floorPlans.buildings[0].unitList.length, 1);
});

test('a snapshot that changes nothing reports no change, even after jsonb reorders what was stored', () => {
  const tracker = snapshot([{ id: 'b1', name: 'Building 1', units: [unit('u101', '101', 'SOLD', { sqft: 900 })] }]);
  const first = mergeSnapshot({ buildings: [{ building: 'Building 1', unitList: [] }] }, ZERO, tracker);
  const stored = jsonbRoundTrip({ floorPlans: first.floorPlans, trackerCounts: first.trackerCounts });
  const second = mergeSnapshot(stored.floorPlans, first.totals, { ...tracker, generatedAt: '2026-10-23T11:00:00.000Z' }, {
    trackerCounts: stored.trackerCounts,
  });
  assert.equal(second.report.changed, false);
  // `syncedAt` is when the tracker's values last changed, not when they were last pushed.
  assert.equal(second.floorPlans.buildings[0].unitList[0].tracker.syncedAt, '2026-10-23T10:00:00.000Z');
});

// ── 1. Partial pushes ──────────────────────────────────────────────────────

const leander = () =>
  snapshot([
    { id: 'l1', name: 'Building 1', units: Array.from({ length: 41 }, (_, i) => unit(`a${i}`, String(101 + i), i < 17 ? 'AVAILABLE' : 'LEASED')) },
    { id: 'l2', name: 'Building 2', units: Array.from({ length: 40 }, (_, i) => unit(`b${i}`, String(201 + i), i < 16 ? 'AVAILABLE' : 'SOLD')) },
  ]);

test('Leander: a property with no floor-plan buildings is never zeroed', () => {
  const stored: Totals = { buildings: 81, sold: 48, available: 33 };

  const refused = mergeSnapshot(undefined, stored, leander());
  assert.match(refused.report.refused ?? '', /no floor-plan buildings on the website, so Building 1 \(41 units\), Building 2 \(40 units\)/);
  assert.deepEqual(
    refused.report.unmatchedTrackerBuildings.map((t) => [t.name, t.units, t.available]),
    [['Building 1', 41, 17], ['Building 2', 40, 16]],
  );
  // What a forced push would write: the tracker's units, not 0/0/0.
  assert.deepEqual(refused.totals, { buildings: 81, sold: 48, available: 33 });

  const forced = mergeSnapshot(undefined, stored, leander(), { force: true });
  assert.equal(forced.report.refused, null);
  assert.deepEqual(forced.report.refusals.length, 1);
  assert.deepEqual(forced.totals, { buildings: 81, sold: 48, available: 33 });
  // Nothing is invented for a property that has no plans.
  assert.equal(forced.floorPlans, undefined);
});

test('a tracker building with no units and no website building is reported but holds nothing up', () => {
  const { report } = mergeSnapshot(
    { buildings: [{ building: 'Building 1', unitList: [] }] },
    ZERO,
    snapshot([
      { id: 'b1', name: 'Building 1', units: [unit('u101', '101', 'AVAILABLE')] },
      { id: 'b5', name: 'Building 5', units: [] },
    ]),
  );
  assert.equal(report.refused, null);
  assert.deepEqual(report.unmatchedTrackerBuildings.map((t) => t.name), ['Building 5']);
});

/** An in-memory stand-in for the slice of Prisma the service uses. */
function fakePrisma(property: Record<string, any>) {
  const writes = { updates: [] as any[], syncs: [] as any[] };
  const tx = {
    $queryRaw: async () => [],
    property: {
      findUnique: async ({ where }: any) =>
        where.trackerProjectId
          ? property.trackerProjectId === where.trackerProjectId ? { id: property.id } : null
          : where.slug === property.slug ? { id: property.id, trackerProjectId: property.trackerProjectId } : null,
      findUniqueOrThrow: async () => property,
      update: async ({ data }: any) => {
        writes.updates.push(data);
        return property;
      },
    },
    websiteTrackerSync: {
      create: async ({ data }: any) => {
        writes.syncs.push(data);
      },
    },
  };
  const prisma: any = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  return { prisma, writes };
}

const leanderProperty = () => ({
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'centro-plaza',
  trackerProjectId: null,
  buildings: 81,
  sold: 48,
  available: 33,
  detail: { overview: 'kept' },
});

test('service: a dry run answers with the report, an unforced partial push is a 409, a forced one counts the units', async () => {
  {
    const { prisma, writes } = fakePrisma(leanderProperty());
    const result = await new TrackerSyncService(prisma).apply(leander(), { dryRun: true });
    assert.equal(result.applied, false);
    assert.match(result.report.refused ?? '', /no floor-plan buildings/);
    assert.deepEqual([writes.updates.length, writes.syncs.length], [0, 0]);
  }
  {
    const { prisma, writes } = fakePrisma(leanderProperty());
    await assert.rejects(new TrackerSyncService(prisma).apply(leander()), (err: any) => {
      assert.equal(err.getStatus(), 409);
      assert.deepEqual(err.getResponse().report.unmatchedTrackerBuildings.map((t: any) => t.name), ['Building 1', 'Building 2']);
      return true;
    });
    assert.equal(writes.updates.length, 0);
  }
  {
    const { prisma, writes } = fakePrisma(leanderProperty());
    const result = await new TrackerSyncService(prisma).apply(leander(), { force: true });
    assert.equal(result.applied, true);
    const [update] = writes.updates;
    assert.deepEqual([update.buildings, update.sold, update.available], [81, 48, 33]);
    assert.equal(update.detail.overview, 'kept');
    assert.equal('floorPlans' in update.detail, false);
    assert.equal(update.detail.trackerCounts.units, 81);
    assert.equal(writes.syncs[0].forced, true);
  }
});

// ── 2. The removal guard, per building ─────────────────────────────────────

test('removing a whole building is refused even when the property is large', () => {
  const floorPlans = {
    buildings: [
      { building: 'Building 1', unitList: Array.from({ length: 40 }, (_, i) => ({ label: String(101 + i), status: 'sold' })) },
      { building: 'Building 9', unitList: Array.from({ length: 8 }, (_, i) => ({ label: String(901 + i), status: 'sold' })) },
    ],
  };
  const tracker = snapshot([
    { id: 'b1', name: 'Building 1', units: Array.from({ length: 40 }, (_, i) => unit(`u${101 + i}`, String(101 + i), 'SOLD')) },
    { id: 'b9', name: 'Building 9', units: [] },
  ]);
  const { report } = mergeSnapshot(floorPlans, ZERO, tracker);
  // 8 of 48 is under the property-wide quarter; 8 of Building 9's 8 is not.
  assert.equal(report.refusals.some((r) => r === 'would remove 8 of 48 unit rows'), false);
  assert.match(report.refused ?? '', /would remove 8 of 8 unit rows in Building 9/);
  assert.match(report.refused ?? '', /would empty Building 9/);
  assert.equal(report.buildings[1].removed.length, 8);
});

test('removing a row with photos or a pin needs force; a bare row does not', () => {
  const floorPlans = (extra: Record<string, unknown>) => ({
    buildings: [
      {
        building: 'Building 8',
        unitList: [
          { label: '801', status: 'sold' },
          { label: '802', status: 'sold', ...extra },
        ],
      },
    ],
  });
  const tracker = snapshot([{ id: 'b8', name: 'Building 8', units: [unit('u801', '801', 'SOLD')] }]);

  const photos = mergeSnapshot(floorPlans({ images: ['a.jpg', ''] }), ZERO, tracker);
  assert.match(photos.report.refused ?? '', /would remove rows with photos or a pin in Building 8: 802 \(1 photos\)/);
  assert.deepEqual(photos.report.buildings[0].removed, [{ label: '802', photos: 1, pinned: false, bound: false }]);

  const pinned = mergeSnapshot(floorPlans({ x: 0.4, y: 0.6 }), ZERO, tracker);
  assert.match(pinned.report.refused ?? '', /802 \(pin\)/);

  const bare = mergeSnapshot(floorPlans({ images: [] }), ZERO, tracker);
  assert.equal(bare.report.refused, null);
  assert.deepEqual(bare.report.buildings[0].removed, [{ label: '802', photos: 0, pinned: false, bound: false }]);
  assert.equal(bare.report.counts.removed, 1);
});

// ── 3. 3D bindings follow a relabel ────────────────────────────────────────

test('a relabel re-points the site model and the building model; a removal leaves its bindings', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 6',
        trackerBuildingId: 'b6',
        model: { url: 'b6.glb', meshNames: ['unit-605', 'Node7', 'unit-607'], bindings: { Node7: '606+608' } },
        unitList: [
          { label: '605', status: 'leased', trackerUnitIds: ['u605'] },
          { label: '606+608', status: 'leased', trackerUnitIds: ['u606', 'u608'] },
          { label: '607', status: 'available', trackerUnitIds: ['u607'] },
        ],
      },
    ],
  };
  const siteModel: SiteModel = {
    url: 'site.glb',
    unitBindings: {
      empty_62: { unitLabel: '605', buildingLabel: 'Building 6' },
      empty_63: { unitLabel: '606+608', buildingLabel: 'Building 6' },
      empty_64: { unitLabel: '607', buildingLabel: 'Building 6' },
      empty_90: { unitLabel: '605', buildingLabel: 'Building 8' },
    },
    buildingBindings: { empty_1: 'Building 6' },
  };
  const result = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      {
        id: 'b6',
        name: 'Building 6',
        units: [
          unit('u605', '605A', 'LEASED'),
          unit('u606', '606', 'LEASED', { dealRef: 'LEASE:SRI' }),
          unit('u608', '608', 'LEASED', { dealRef: 'LEASE:SRI' }),
        ],
      },
    ]),
    { siteModel, force: true },
  );
  const bindings = result.siteModel!.unitBindings!;
  assert.deepEqual(bindings.empty_62, { unitLabel: '605A', buildingLabel: 'Building 6' });
  // Unchanged rows, other buildings and the removed 607 keep theirs.
  assert.deepEqual(bindings.empty_63, siteModel.unitBindings!.empty_63);
  assert.deepEqual(bindings.empty_64, { unitLabel: '607', buildingLabel: 'Building 6' });
  assert.deepEqual(bindings.empty_90, { unitLabel: '605', buildingLabel: 'Building 8' });
  assert.deepEqual(result.siteModel!.buildingBindings, siteModel.buildingBindings);
  // The building's own model: the shape named unit-605 gets an explicit binding, as applyUnitChange() does.
  assert.deepEqual(result.floorPlans.buildings[0].model.bindings, { Node7: '606+608', 'unit-605': '605A' });
  assert.deepEqual(
    result.report.rebound.map((r) => [r.mesh, r.model, r.to]),
    [['empty_62', 'site', 'Building 6 / 605A'], ['unit-605', 'Building 6', '605A']],
  );
  assert.equal(result.report.buildings[0].removed[0].bound, true);
  // The input is never mutated.
  assert.equal(siteModel.unitBindings!.empty_62.unitLabel, '605');
});

test('two units swapping numbers swap their shapes and keep their own photographs', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 8',
        unitList: [
          { label: '812', status: 'sold', trackerUnitIds: ['a'], images: ['a.jpg'] },
          { label: '814', status: 'sold', trackerUnitIds: ['b'], images: ['b.jpg'] },
        ],
      },
    ],
  };
  const siteModel: SiteModel = {
    unitBindings: { m1: { buildingLabel: 'Building 8', unitLabel: '812' }, m2: { buildingLabel: 'Building 8', unitLabel: '814' } },
  };
  const { floorPlans: next, siteModel: nextSite } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([{ id: 'b8', name: 'Building 8', units: [unit('a', '814', 'SOLD'), unit('b', '812', 'SOLD')] }]),
    { siteModel },
  );
  assert.deepEqual(nextSite!.unitBindings, {
    m1: { buildingLabel: 'Building 8', unitLabel: '814' },
    m2: { buildingLabel: 'Building 8', unitLabel: '812' },
  });
  assert.deepEqual(row(next, 0, '812').images, ['b.jpg']);
  assert.deepEqual(row(next, 0, '814').images, ['a.jpg']);
});

test('a new unit that takes a renumbered unit\'s old number does not take its photographs', () => {
  const floorPlans = {
    buildings: [{ building: 'Building 7', unitList: [{ label: '701', status: 'available', trackerUnitIds: ['u701'], images: ['old.jpg'] }] }],
  };
  const { floorPlans: next, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([{ id: 'b7', name: 'Building 7', units: [unit('u701', '701A', 'AVAILABLE'), unit('fresh', '701', 'AVAILABLE')] }]),
  );
  assert.deepEqual(row(next, 0, '701A').images, ['old.jpg']);
  assert.deepEqual(row(next, 0, '701').images, []);
  assert.deepEqual(report.buildings[0].added, ['701']);
});

// ── 4. Website data survives identity changes ──────────────────────────────

const building4 = (linked: boolean) => ({
  buildings: [
    {
      building: 'Building 4',
      ...(linked ? { trackerBuildingId: 'b4' } : {}),
      unitList: [
        {
          label: '402+404',
          status: 'sold',
          tenant: 'Prodigy AT Centre',
          description: 'Corner suite',
          images: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'],
          x: 0.2,
          y: 0.3,
          ...(linked ? { trackerUnitIds: ['u402', 'u404'] } : {}),
        },
      ],
    },
  ],
});

test('a 402/404 split keeps the photographs on both halves — first sync and linked', () => {
  // SOLD 402 with UNDER_CONTRACT 404: the deal ref is lost, so the pair splits.
  const split = snapshot([{ id: 'b4', name: 'Building 4', units: [unit('u402', '402', 'SOLD'), unit('u404', '404', 'UNDER_CONTRACT')] }]);
  for (const linked of [false, true]) {
    const { floorPlans: next, report } = mergeSnapshot(building4(linked), ZERO, split);
    assert.equal(report.refused, null, `linked=${linked}`);
    assert.deepEqual(labels(next), ['402', '404']);
    for (const label of ['402', '404']) {
      assert.equal(row(next, 0, label).images.length, 5, `${label} linked=${linked}`);
      assert.equal(row(next, 0, label).description, 'Corner suite');
      assert.deepEqual([row(next, 0, label).x, row(next, 0, label).y], [0.2, 0.3]);
    }
    assert.deepEqual(report.buildings[0].removed, []);
    assert.deepEqual(report.buildings[0].relabelled, [{ from: '402+404', to: '402' }]);
    assert.deepEqual(report.buildings[0].carried, [{ label: '404', from: ['402+404'] }]);
    assert.equal(row(next, 0, '404').status, 'sold');
  }
});

test('a combine keeps both rows\' photographs and lights both shapes, using the ids it was merged from', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 7',
        trackerBuildingId: 'b7',
        unitList: [
          { label: '701', status: 'available', trackerUnitIds: ['u701'], images: ['a.jpg'], description: '' },
          { label: '702', status: 'available', trackerUnitIds: ['u702'], images: ['b.jpg', 'a.jpg'], description: 'Drive-through', x: 1, y: 2 },
        ],
      },
    ],
  };
  const siteModel: SiteModel = {
    unitBindings: { m1: { buildingLabel: 'Building 7', unitLabel: '701' }, m2: { buildingLabel: 'Building 7', unitLabel: '702' } },
  };
  // Combining mints a new unit; only mergedFromIds say what it continues.
  const combined = snapshot(
    [{ id: 'b7', name: 'Building 7', units: [unit('uNew', '701-702', 'AVAILABLE', { sqft: 3377, mergedFromIds: ['u701', 'u702'] })] }],
    2,
  );
  const { floorPlans: next, siteModel: nextSite, report } = mergeSnapshot(floorPlans, ZERO, combined, { siteModel });
  assert.equal(report.refused, null);
  const only = next.buildings[0].unitList;
  assert.equal(only.length, 1);
  assert.equal(only[0].label, '701-702');
  assert.deepEqual(only[0].images, ['a.jpg', 'b.jpg']);
  assert.equal(only[0].description, 'Drive-through');
  assert.deepEqual([only[0].x, only[0].y], [1, 2]);
  assert.deepEqual(report.buildings[0].absorbed, [{ label: '702', into: ['701-702'], dropped: [] }]);
  assert.deepEqual(Object.values(nextSite!.unitBindings!).map((b) => b.unitLabel), ['701-702', '701-702']);
});

test('a combine lists what the absorbed row loses: its logo, its link, a second pin', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 7',
        trackerBuildingId: 'b7',
        unitList: [
          { label: '701', status: 'leased', trackerUnitIds: ['u701'], logo: 'cafe.png', x: 1, y: 1 },
          { label: '702', status: 'leased', trackerUnitIds: ['u702'], logo: 'deli.png', tenantUrl: 'https://deli.example', x: 2, y: 2 },
        ],
      },
    ],
  };
  const { floorPlans: next, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([{ id: 'b7', name: 'Building 7', units: [unit('uNew', '701+702', 'AVAILABLE', { mergedFromIds: ['u701', 'u702'] })] }], 2),
  );
  assert.deepEqual(report.buildings[0].absorbed, [{ label: '702', into: ['701+702'], dropped: ['logo', 'tenantUrl', 'pin'] }]);
  assert.equal(report.refused, null);
  assert.deepEqual([row(next, 0, '701+702').logo, row(next, 0, '701+702').x], ['cafe.png', 1]);
});

test('deal partners renumbered together keep their own photographs and pins', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 4',
        trackerBuildingId: 'b4',
        unitList: [
          { label: '402', status: 'sold', trackerUnitIds: ['a'], images: ['402.jpg'], description: 'Corner', x: 1, y: 1 },
          { label: '404', status: 'sold', trackerUnitIds: ['b'], images: ['404.jpg'], description: '', x: null, y: null },
        ],
      },
    ],
  };
  // Two sales of one deal, so each unit names the other in dealUnitIds.
  const { floorPlans: next } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot(
      [
        {
          id: 'b4',
          name: 'Building 4',
          units: [
            unit('a', '502', 'SOLD', { dealUnitIds: ['a', 'b'] }),
            unit('b', '504', 'UNDER_CONTRACT', { dealUnitIds: ['a', 'b'] }),
          ],
        },
      ],
      2,
    ),
  );
  assert.deepEqual(row(next, 0, '502').images, ['402.jpg']);
  assert.deepEqual(row(next, 0, '504').images, ['404.jpg']);
  assert.deepEqual([row(next, 0, '504').description, row(next, 0, '504').x, row(next, 0, '504').y], ['', null, null]);
  assert.deepEqual([row(next, 0, '502').x, row(next, 0, '502').y], [1, 1]);
});

test('a SOLD/UNDER_CONTRACT swap inside a deal does not give one unit another\'s photographs', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 4',
        trackerBuildingId: 'b4',
        unitList: [
          { label: '401+402', status: 'sold', trackerUnitIds: ['u401', 'u402'], images: ['pair.jpg'] },
          { label: '403', status: 'sold', trackerUnitIds: ['u403'], images: ['403.jpg'] },
        ],
      },
    ],
  };
  // 402 falls back to UNDER_CONTRACT and leaves the sold group; 403 joins it.
  const deal = ['u401', 'u402', 'u403'];
  const { floorPlans: next, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot(
      [
        {
          id: 'b4',
          name: 'Building 4',
          units: [
            unit('u401', '401', 'SOLD', { dealRef: 'SALE:X', dealUnitIds: deal }),
            unit('u402', '402', 'UNDER_CONTRACT', { dealUnitIds: deal }),
            unit('u403', '403', 'SOLD', { dealRef: 'SALE:X', dealUnitIds: deal }),
          ],
        },
      ],
      2,
    ),
  );
  assert.equal(report.refused, null);
  assert.deepEqual(labels(next), ['401+403', '402']);
  assert.equal(row(next, 0, '402').images.includes('403.jpg'), false);
  assert.deepEqual(row(next, 0, '402').images, ['pair.jpg']);
  assert.deepEqual(row(next, 0, '401+403').images, ['pair.jpg', '403.jpg']);
});

test('a unit moved between buildings keeps its photographs and its shape, but not its 2D pin', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 8',
        trackerBuildingId: 'b8',
        unitList: [
          { label: '801', status: 'sold', trackerUnitIds: ['u801'], images: ['p.jpg'], description: 'End cap', x: 0.1, y: 0.9 },
          { label: '802', status: 'sold', trackerUnitIds: ['u802'] },
        ],
      },
      { building: 'Building 9', trackerBuildingId: 'b9', unitList: [{ label: '901', status: 'sold', trackerUnitIds: ['u901'] }] },
    ],
  };
  const siteModel: SiteModel = { unitBindings: { m: { buildingLabel: 'Building 8', unitLabel: '801' } } };
  const { floorPlans: next, siteModel: nextSite, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      { id: 'b8', name: 'Building 8', units: [unit('u802', '802', 'SOLD')] },
      { id: 'b9', name: 'Building 9', units: [unit('u801', '801', 'SOLD'), unit('u901', '901', 'SOLD')] },
    ]),
    { siteModel },
  );
  assert.equal(report.refused, null);
  assert.equal(report.removedRows, 0);
  assert.deepEqual(row(next, 1, '801').images, ['p.jpg']);
  assert.equal(row(next, 1, '801').description, 'End cap');
  // The pin was a point on Building 8's plan.
  assert.deepEqual([row(next, 1, '801').x, row(next, 1, '801').y], [null, null]);
  assert.deepEqual(report.buildings[0].movedOut, [{ label: '801', to: 'Building 9' }]);
  assert.deepEqual(report.buildings[1].movedIn, [{ label: '801', from: 'Building 8', pinCleared: true }]);
  // The input is never mutated.
  assert.equal(floorPlans.buildings[0].unitList[0].x, 0.1);
  assert.deepEqual(nextSite!.unitBindings!.m, { buildingLabel: 'Building 9', unitLabel: '801' });
});

test('labels are normalised: prefixes, leading zeros and spaces around "+"', () => {
  assert.equal(normaliseLabel(' Unit 905 '), '905');
  assert.equal(normaliseLabel('Suite #101A'), '101A');
  assert.equal(normaliseLabel('#12'), '12');
  assert.equal(normaliseLabel('0906'), '906');
  assert.equal(normaliseLabel('203 + 0204'), '203+204');
  assert.equal(normaliseLabel('1001'), '1001');
  assert.equal(normaliseLabel('Units 5'), 'Units 5');

  const floorPlans = {
    buildings: [
      {
        building: 'Building 9',
        unitList: [
          { label: '905', status: 'sold', images: ['a.jpg'] },
          { label: '906', status: 'sold', images: ['b.jpg'] },
          { label: '203 + 204', status: 'leased', images: ['c.jpg'] },
        ],
      },
    ],
  };
  const { floorPlans: next, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      {
        id: 'b9',
        name: 'Building 9',
        units: [
          unit('a', 'Unit 905', 'SOLD'),
          unit('b', '0906', 'SOLD'),
          unit('c', '203', 'LEASED', { dealRef: 'LEASE:JB' }),
          unit('d', '204', 'LEASED', { dealRef: 'LEASE:JB' }),
        ],
      },
    ]),
  );
  assert.equal(report.refused, null);
  assert.deepEqual(labels(next), ['203+204', '905', '906']);
  assert.deepEqual(next.buildings[0].unitList.map((u: any) => u.images[0]), ['c.jpg', 'a.jpg', 'b.jpg']);
  assert.deepEqual(report.buildings[0].added, []);
  assert.equal(row(next, 0, '905').tracker.unitNumber, 'Unit 905');
});

test('overlapping labels that carry on as they were never trade photographs', () => {
  // Building 2's wart: 201 is let on its own and also part of the sold suite.
  const floorPlans = {
    buildings: [
      {
        building: 'Building 2',
        unitList: [
          { label: '201', status: 'available', images: ['201.jpg'] },
          { label: '201+202+203+204', status: 'sold', images: ['suite.jpg'] },
          { label: '203+204', status: 'leased', tenant: 'JB Sree Ventures', images: ['jb.jpg'] },
        ],
      },
    ],
  };
  const { floorPlans: next, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      {
        id: 'b2',
        name: 'Building 2',
        units: [
          unit('u201', '201', 'AVAILABLE'),
          unit('suite', '201+202+203+204', 'SOLD'),
          // The lease ended: the pair splits.
          unit('u203', '203', 'AVAILABLE'),
          unit('u204', '204', 'AVAILABLE'),
        ],
      },
    ]),
  );
  assert.equal(report.refused, null);
  assert.deepEqual(row(next, 0, '201').images, ['201.jpg']);
  assert.deepEqual(row(next, 0, '201+202+203+204').images, ['suite.jpg']);
  assert.deepEqual(row(next, 0, '203').images, ['jb.jpg']);
  assert.deepEqual(row(next, 0, '204').images, ['jb.jpg']);
  assert.deepEqual([row(next, 0, '203').tenant, row(next, 0, '204').tenant], ['', '']);
});

// ── 5. Counts per status ───────────────────────────────────────────────────

test('per-status counts are stored while the headline keeps its formula', () => {
  const { totals, trackerCounts, report } = mergeSnapshot(
    { buildings: [{ building: 'Building 1', unitList: [] }] },
    ZERO,
    snapshot([
      {
        id: 'b1',
        name: 'Building 1',
        units: [
          unit('a', '101', 'AVAILABLE'),
          unit('b', '102', 'UNDER_CONTRACT'),
          unit('c', '103', 'LEASE_PENDING'),
          unit('d', '104', 'SOLD'),
          unit('e', '105', 'UNDER_CONSTRUCTION'),
          unit('f', '106', 'OCCUPIED'),
        ],
      },
    ]),
  );
  assert.deepEqual(trackerCounts, {
    units: 6,
    byStatus: { AVAILABLE: 1, UNDER_CONTRACT: 1, LEASE_PENDING: 1, LEASED: 0, OCCUPIED: 1, SOLD: 1, UNDER_CONSTRUCTION: 1 },
  });
  // Unchanged until the client decides: everything not available counts as sold.
  assert.deepEqual(totals, { buildings: 6, sold: 5, available: 1 });
  assert.deepEqual(report.trackerCounts, trackerCounts);
});

// ── 6. Building mapping ────────────────────────────────────────────────────

test('a linked building is matched by its stored id, never again by name', () => {
  const floorPlans = {
    buildings: [
      { building: 'Building 1', trackerBuildingId: 'old-b1', unitList: [{ label: '101', status: 'sold', images: ['x.jpg'] }] },
      { building: 'Building 2', trackerBuildingId: 'b2', unitList: [{ label: '201', status: 'sold' }] },
      { building: 'Building 3', unitList: [] },
    ],
  };
  const { floorPlans: next, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      // A new tracker building that happens to have Building 1's name.
      { id: 'new-b1', name: 'Building 1', units: [unit('n', '101', 'AVAILABLE')] },
      { id: 'b2', name: 'Building 2 (Retail)', units: [unit('u201', '201', 'SOLD')] },
      { id: 'b3', name: 'Bldg 03', units: [unit('u301', '301', 'SOLD')] },
    ]),
  );
  assert.deepEqual(report.buildings.map((b) => [b.building, b.matchedBy]), [['Building 2', 'id'], ['Building 3', 'name']]);
  assert.deepEqual(report.staleLinks, [{ building: 'Building 1', trackerBuildingId: 'old-b1', reason: 'not-in-snapshot' }]);
  assert.deepEqual(report.unmatchedTrackerBuildings.map((t) => t.id), ['new-b1']);
  assert.match(report.refused ?? '', /Building 1 \(1 units\)/);
  // First-time match stored, so the next push matches Building 3 by id.
  assert.equal(next.buildings[2].trackerBuildingId, 'b3');
  assert.deepEqual(next.buildings[0], floorPlans.buildings[0]);
});

test('a building duplicated in the CMS, link and all, is reported and counted once', () => {
  const copy = { building: 'Building 4 copy', trackerBuildingId: 'b4', units: 2, available: 1, unitList: [{ label: '401', status: 'available' }, { label: '402', status: 'sold' }] };
  const { floorPlans: next, totals, report } = mergeSnapshot(
    {
      buildings: [{ building: 'Building 4', trackerBuildingId: 'b4', unitList: [] }, copy],
    },
    ZERO,
    snapshot([{ id: 'b4', name: 'Building 4', units: [unit('u401', '401', 'AVAILABLE'), unit('u402', '402', 'SOLD')] }]),
  );
  assert.deepEqual(report.staleLinks, [{ building: 'Building 4 copy', trackerBuildingId: 'b4', reason: 'claimed-by-another-building' }]);
  assert.deepEqual(next.buildings[1], copy);
  assert.deepEqual(totals, { buildings: 2, sold: 1, available: 1 });
});

// ── 7. Unknown statuses and the sync-owned tenant ──────────────────────────

test('an unknown status keeps the row\'s previous status, is reported, and never becomes available', () => {
  const floorPlans = {
    buildings: [{ building: 'Building 7', unitList: [{ label: '703', status: 'sold', tenant: 'Owner' }] }],
  };
  const { floorPlans: next, totals, report } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      {
        id: 'b7',
        name: 'Building 7',
        units: [unit('u703', '703', 'RESERVED'), unit('u704', '704', 'RESERVED'), unit('u705', '705', 'AVAILABLE')],
      },
    ]),
  );
  assert.deepEqual(labels(next), ['703', '705']);
  assert.equal(row(next, 0, '703').status, 'sold');
  assert.equal(row(next, 0, '703').tenant, 'Owner');
  assert.equal(row(next, 0, '703').tracker.status, 'RESERVED');
  assert.deepEqual(report.buildings[0].unknownStatus, [
    { label: '703', status: 'RESERVED', kept: 'sold' },
    // A new unit with an unknown status is held back, not published.
    { label: '704', status: 'RESERVED', kept: null },
  ]);
  assert.deepEqual(totals, { buildings: 3, sold: 2, available: 1 });
  assert.equal(report.trackerCounts.byStatus.RESERVED, 2);
  assert.deepEqual(report.buildings[0].added, ['705']);
});

test('LEASED → LEASE_PENDING or AVAILABLE clears the tenant the sync wrote; a sold row keeps the website\'s', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 6',
        unitList: [
          // Written by an earlier push: the tracker sent this occupant.
          { label: '605', status: 'leased', tenant: 'JRays Corner', tracker: { occupant: 'JRays Corner' } },
          { label: '606', status: 'leased', tenant: 'Sri Vanguard' },
          { label: '607', status: 'sold', tenant: 'Owner Dental' },
          { label: '608', status: 'leased', tenant: 'Typed in the CMS' },
        ],
      },
    ],
  };
  const { floorPlans: next } = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot([
      {
        id: 'b6',
        name: 'Building 6',
        units: [
          unit('a', '605', 'LEASE_PENDING'),
          unit('b', '606', 'AVAILABLE'),
          unit('c', '607', 'SOLD'),
          // Leased with no lease on record: the website's name stays.
          unit('d', '608', 'LEASED'),
        ],
      },
    ]),
  );
  assert.deepEqual(next.buildings[0].unitList.map((u: any) => [u.label, u.status, u.tenant]), [
    ['605', 'leased', ''],
    ['606', 'available', ''],
    ['607', 'sold', 'Owner Dental'],
    ['608', 'leased', 'Typed in the CMS'],
  ]);
});

test('a tenant typed in the CMS survives LEASE_PENDING across pushes; one the sync wrote does not', () => {
  const floorPlans = {
    buildings: [
      {
        building: 'Building 6',
        unitList: [
          { label: '605', status: 'leased', tenant: 'Opening soon: Chipotle' },
          { label: '606', status: 'leased', tenant: '' },
        ],
      },
    ],
  };
  const push = (fp: any, units: SnapshotUnit[]) => mergeSnapshot(fp, ZERO, snapshot([{ id: 'b6', name: 'Building 6', units }])).floorPlans;
  const tenants = (fp: any) => fp.buildings[0].unitList.map((u: any) => u.tenant);

  // Push 1: 605 pending with a CMS tenant; 606 leased, so the sync writes its name.
  const first = push(floorPlans, [unit('a', '605', 'LEASE_PENDING'), unit('b', '606', 'LEASED', { occupant: 'JRays Corner' })]);
  assert.deepEqual(tenants(first), ['Opening soon: Chipotle', 'JRays Corner']);
  assert.equal(first.buildings[0].unitList[1].tracker.occupant, 'JRays Corner');

  // Push 2: both pending. The CMS text stays; the name the sync wrote goes.
  const second = push(jsonbRoundTrip(first), [unit('a', '605', 'LEASE_PENDING'), unit('b', '606', 'LEASE_PENDING')]);
  assert.deepEqual(tenants(second), ['Opening soon: Chipotle', '']);
});

// ── 8. Snapshot v2 ─────────────────────────────────────────────────────────

/** The global ValidationPipe's options in src/main.ts. */
async function validateLikeMain(body: unknown) {
  const instance = plainToInstance(TrackerSnapshotDto, body, { enableImplicitConversion: true });
  return validate(instance as object, { whitelist: true, forbidNonWhitelisted: true });
}

const v1Body = {
  version: 1,
  generatedAt: '2026-10-27T10:00:00.000Z',
  project: { id: 'p', name: 'Centro Plaza', websiteSlug: 'centro-plaza' },
  buildings: [{ id: 'b2', name: 'Building 2', units: [{ id: 'u', unitNumber: '203', status: 'LEASED', sqft: 1510, dealRef: null, occupant: 'JB' }] }],
};

const v2Body = {
  ...v1Body,
  version: 2,
  buildings: [
    {
      id: 'b2',
      name: 'Building 2',
      totalSqft: 9500,
      stories: 1,
      units: [
        {
          id: 'u',
          unitNumber: '203',
          status: 'AVAILABLE',
          sqft: 1510,
          dealRef: null,
          occupant: null,
          dealUnitIds: [],
          mergedFromIds: ['old'],
          unitType: 'RETAIL',
          askingRent: 24.5,
          askingPrice: null,
          availableSince: '2026-09-16T00:00:00.000Z',
        },
      ],
    },
  ],
};

test('the DTO accepts version 1 and version 2, and still rejects the unknown', async () => {
  assert.deepEqual(await validateLikeMain(v1Body), []);
  assert.deepEqual(await validateLikeMain(v2Body), []);
  // A status a newer tracker added is the merge's to handle, not a 400.
  assert.deepEqual(await validateLikeMain({ ...v1Body, buildings: [{ ...v1Body.buildings[0], units: [{ ...v1Body.buildings[0].units[0], status: 'RESERVED' }] }] }), []);

  assert.notDeepEqual(await validateLikeMain({ ...v1Body, version: 3 }), []);
  const withBuyer = { ...v1Body, buildings: [{ ...v1Body.buildings[0], units: [{ ...v1Body.buildings[0].units[0], buyer: 'Sai Reddy' }] }] };
  assert.notDeepEqual(await validateLikeMain(withBuyer), []);
  assert.notDeepEqual(await validateLikeMain({ ...v1Body, buildings: [{ ...v1Body.buildings[0], units: [{ ...v1Body.buildings[0].units[0], status: 'leased' }] }] }), []);
});

test('v2 values go under row.tracker; the fields the site reads are written exactly as from v1', () => {
  const floorPlans = { buildings: [{ building: 'Building 2', unitList: [{ label: '203', status: 'leased', tenant: 'JB', images: ['jb.jpg'], rate: '' }] }] };
  const v1 = mergeSnapshot(floorPlans, ZERO, snapshot([{ id: 'b2', name: 'Building 2', units: [unit('u', '203', 'AVAILABLE', { sqft: 1510 })] }], 1));
  const v2 = mergeSnapshot(
    floorPlans,
    ZERO,
    snapshot(
      [
        {
          id: 'b2',
          name: 'Building 2',
          totalSqft: 9500,
          stories: 1,
          units: [
            unit('u', '203', 'AVAILABLE', {
              sqft: 1510,
              unitType: 'RETAIL',
              askingRent: 24.5,
              askingPrice: 650000,
              availableSince: '2026-09-16T00:00:00.000Z',
              dealUnitIds: [],
              mergedFromIds: [],
            }),
          ],
        },
      ],
      2,
    ),
  );
  const strip = (r: any) => {
    const { tracker: _tracker, ...rest } = r;
    return rest;
  };
  assert.deepEqual(strip(v2.floorPlans.buildings[0].unitList[0]), strip(v1.floorPlans.buildings[0].unitList[0]));
  assert.deepEqual(v2.totals, v1.totals);
  assert.deepEqual(v2.floorPlans.buildings[0].unitList[0].tracker, {
    ids: ['u'],
    unitNumber: '203',
    status: 'AVAILABLE',
    sqft: 1510,
    unitType: 'RETAIL',
    availableSince: '2026-09-16T00:00:00.000Z',
    occupant: null,
    syncedAt: '2026-10-23T10:00:00.000Z',
  });
  assert.deepEqual(v2.floorPlans.buildings[0].tracker, { id: 'b2', name: 'Building 2', totalSqft: 9500, stories: 1 });
  assert.equal(v2.report.version, 2);
});

test('asking rent and price are accepted but never stored — detail is public as stored', () => {
  const { floorPlans: next, report } = mergeSnapshot(
    { buildings: [{ building: 'Building 2', unitList: [] }] },
    ZERO,
    snapshot([{ id: 'b2', name: 'Building 2', units: [unit('u', '202', 'AVAILABLE', { askingRent: 30, askingPrice: 500000 })] }], 2),
  );
  const json = JSON.stringify({ next, report });
  for (const leaked of ['askingRent', 'askingPrice', '500000']) assert.equal(json.includes(leaked), false, leaked);
});

test('row.tracker.syncedAt moves only when a tracker value changes', () => {
  const at = (generatedAt: string, status: string) => ({
    ...snapshot([{ id: 'b1', name: 'Building 1', units: [unit('u', '101', status)] }], 2),
    generatedAt,
  });
  const first = mergeSnapshot({ buildings: [{ building: 'Building 1', unitList: [] }] }, ZERO, at('2026-10-27T10:00:00.000Z', 'AVAILABLE'));
  const same = mergeSnapshot(first.floorPlans, first.totals, at('2026-10-27T11:00:00.000Z', 'AVAILABLE'), { trackerCounts: first.trackerCounts });
  const sold = mergeSnapshot(first.floorPlans, first.totals, at('2026-10-27T12:00:00.000Z', 'SOLD'), { trackerCounts: first.trackerCounts });
  assert.equal(same.report.changed, false);
  assert.equal(same.floorPlans.buildings[0].unitList[0].tracker.syncedAt, '2026-10-27T10:00:00.000Z');
  assert.equal(sold.floorPlans.buildings[0].unitList[0].tracker.syncedAt, '2026-10-27T12:00:00.000Z');
});

// The same vector is asserted in prime-tracker-main's website-signature.spec.ts.
// If either side changes how it signs, one of the two suites fails.
test('signature matches the vector shared with Prime Tracker', () => {
  assert.equal(
    sign('test-secret', '1761213600000', '/api/integrations/tracker/snapshot?force=true', '{"version":1}'),
    'sha256=d802ec60fc1d55f09dc2028a1bfddbf8a9417d69d2d069c843e7b154501f7f1e',
  );
});

test('signature: accepts a fresh match, rejects stale, tampered, re-targeted and missing', () => {
  const now = 1761213600000;
  const ts = String(now);
  const body = '{"version":1}';
  const path = '/api/integrations/tracker/snapshot';
  const good = sign('s', ts, path, body);
  assert.equal(verify('s', ts, good, path, body, now + 1000), null);
  assert.equal(verify('s', ts, good, path, body, now + 6 * 60 * 1000), 'stale');
  assert.equal(verify('s', ts, good, path, '{"version":2}', now), 'mismatch');
  assert.equal(verify('s', ts, good, `${path}?force=true`, body, now), 'mismatch');
  assert.equal(verify('other', ts, good, path, body, now), 'mismatch');
  assert.equal(verify('s', ts, 'sha256=short', path, body, now), 'mismatch');
  assert.equal(verify('s', undefined, good, path, body, now), 'missing');
});
