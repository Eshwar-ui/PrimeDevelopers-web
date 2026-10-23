// Prime Tracker → website sync: the merge and the request signature.
//
//   pnpm --filter @prime-developers/api test
//
// Pure functions only — nothing here touches a database, which matters because
// apps/api/.env points at production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SnapshotBuilding,
  SnapshotUnit,
  TrackerSnapshot,
  Totals,
  mergeSnapshot,
  toRows,
} from '../src/modules/tracker-sync/tracker-merge';
import { sign, verify } from '../src/modules/tracker-sync/tracker-signature';

const unit = (id: string, unitNumber: string, status: SnapshotUnit['status'], extra: Partial<SnapshotUnit> = {}): SnapshotUnit => ({
  id,
  unitNumber,
  status,
  sqft: null,
  dealRef: null,
  occupant: null,
  ...extra,
});

const snapshot = (buildings: SnapshotBuilding[]): TrackerSnapshot => ({
  version: 1,
  generatedAt: '2026-10-23T10:00:00.000Z',
  project: { id: 'proj-centro', name: 'Centro Plaza', websiteSlug: 'centro-plaza' },
  buildings,
});

const ZERO: Totals = { buildings: 0, sold: 0, available: 0 };

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

test('buildings the tracker lacks are untouched and still counted; unknown tracker buildings are reported', () => {
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
  assert.deepEqual(report.unmatchedTrackerBuildings, ['Building 5']);
  assert.deepEqual(totals, { buildings: 7, sold: 4, available: 3 });
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

test('a snapshot that changes nothing reports no change', () => {
  const tracker = snapshot([{ id: 'b1', name: 'Building 1', units: [unit('u101', '101', 'SOLD', { sqft: 900 })] }]);
  const first = mergeSnapshot({ buildings: [{ building: 'Building 1', unitList: [] }] }, ZERO, tracker);
  const second = mergeSnapshot(first.floorPlans, first.totals, tracker);
  assert.equal(second.report.changed, false);
});

// The same vector is asserted in prime-tracker-main's website-signature.spec.ts.
// If either side changes how it signs, one of the two suites fails.
test('signature matches the vector shared with Prime Tracker', () => {
  assert.equal(
    sign('test-secret', '1761213600000', '{"version":1}'),
    'sha256=70ee07dfaff5ffbde8b592f27b0a965f7f5966bf583395b5004b82ba29da78c3',
  );
});

test('signature: accepts a fresh match, rejects stale, tampered and missing', () => {
  const now = 1761213600000;
  const ts = String(now);
  const body = '{"version":1}';
  const good = sign('s', ts, body);
  assert.equal(verify('s', ts, good, body, now + 1000), null);
  assert.equal(verify('s', ts, good, body, now + 6 * 60 * 1000), 'stale');
  assert.equal(verify('s', ts, good, '{"version":2}', now), 'mismatch');
  assert.equal(verify('other', ts, good, body, now), 'mismatch');
  assert.equal(verify('s', ts, 'sha256=short', body, now), 'mismatch');
  assert.equal(verify('s', undefined, good, body, now), 'missing');
});
