/**
 * Merges a Prime Tracker project snapshot into a property's floor plans.
 *
 * Pure on purpose: no Prisma, no Nest. Everything the sync decides — which row
 * is which, what changes, what is refused — is decided here, so all of it can
 * be tested without a database. See docs/tracker-sync-and-aws-plan.md.
 *
 * The tracker owns a unit row's label, status, size and (for leased units)
 * tenant. Everything else on the row — photographs, pins, logo, rate,
 * description — belongs to the website and is carried over untouched.
 */

/** Prime Tracker's `UnitStatus` enum, verbatim. */
export const TRACKER_UNIT_STATUSES = [
  'AVAILABLE',
  'UNDER_CONTRACT',
  'LEASE_PENDING',
  'LEASED',
  'OCCUPIED',
  'SOLD',
  'UNDER_CONSTRUCTION',
] as const;
export type TrackerUnitStatus = (typeof TRACKER_UNIT_STATUSES)[number];

export type WebsiteUnitStatus = 'available' | 'leased' | 'coming-soon' | 'sold';

/**
 * Seven tracker states onto the website's four (apps/web/src/lib/unitStatus.js).
 *
 * The two pending states show as taken: a unit with a signed LOI or a lease out
 * for signature is spoken for, and advertising it invites an enquiry the team
 * has to turn away. Both are awaiting the client's confirmation.
 */
export const STATUS_MAP: Record<TrackerUnitStatus, WebsiteUnitStatus> = {
  AVAILABLE: 'available',
  UNDER_CONSTRUCTION: 'coming-soon',
  LEASED: 'leased',
  OCCUPIED: 'leased',
  LEASE_PENDING: 'leased',
  SOLD: 'sold',
  UNDER_CONTRACT: 'sold',
};

export interface SnapshotUnit {
  id: string;
  unitNumber: string;
  status: TrackerUnitStatus;
  sqft: number | null;
  /** `LEASE:<ref>` or `SALE:<ref>` when let or sold together with other units. */
  dealRef: string | null;
  /** Tenant brand of the active lease. Never a buyer. */
  occupant: string | null;
}

export interface SnapshotBuilding {
  id: string;
  name: string;
  units: SnapshotUnit[];
}

export interface TrackerSnapshot {
  version: 1;
  generatedAt: string;
  project: { id: string; name: string; websiteSlug: string };
  buildings: SnapshotBuilding[];
}

/** A unit row as it sits in `detail.floorPlans.buildings[].unitList`. */
export type WebsiteUnit = Record<string, any> & {
  label?: string;
  status?: string;
  trackerUnitIds?: string[];
};

export type WebsiteBuilding = Record<string, any> & {
  building?: string;
  number?: string;
  unitList?: WebsiteUnit[];
  trackerBuildingId?: string;
};

export interface Totals {
  /** The column is called `buildings` but holds the total UNIT count. */
  buildings: number;
  sold: number;
  available: number;
}

export interface BuildingReport {
  building: string;
  trackerBuilding: string;
  matchedBy: 'id' | 'name' | 'number';
  added: string[];
  removed: { label: string; photos: number }[];
  relabelled: { from: string; to: string }[];
  statusChanged: { label: string; from: string; to: string }[];
  units: number;
  available: number;
}

export interface MergeReport {
  changed: boolean;
  buildings: BuildingReport[];
  /** Website buildings the tracker has no building for — left exactly as they were. */
  untouched: string[];
  /** Tracker buildings with no website building — reported, never created. */
  unmatchedTrackerBuildings: string[];
  totals: { before: Totals; after: Totals };
  removedRows: number;
  existingRows: number;
  /** Set when the removal guard refused this snapshot. */
  refused: string | null;
}

export interface MergeResult {
  floorPlans: Record<string, any>;
  totals: Totals;
  report: MergeReport;
}

/**
 * A snapshot that would remove more than this share of the rows in the
 * buildings it touches — and more than MIN_REMOVALS_TO_GUARD rows — is refused
 * unless forced. A tracker query that silently lost its units must not empty
 * the public site; a genuine clean-up is sent again with `force`.
 */
export const MAX_REMOVAL_RATIO = 0.25;
export const MIN_REMOVALS_TO_GUARD = 3;

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Same split as `unitLabelParts()` in apps/web/src/lib/units.js. */
const labelParts = (label: unknown) =>
  String(label ?? '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

const partsKey = (label: unknown) => labelParts(label).map(norm).sort(byNumber).join('+');

/**
 * Every field `makeUnit()` in apps/web/src/lib/units.js sets. A row created
 * here without one of them renders as a blank field in the admin's unit form.
 */
const blankUnit = (label: string): WebsiteUnit => ({
  label,
  status: 'available',
  tenant: '',
  size: '',
  floor: '',
  rate: '',
  frontage: '',
  description: '',
  x: null,
  y: null,
  logo: '',
  images: [],
  tenantUrl: '',
  tenantCategory: '',
  facingRoad: '',
});

interface TrackerRow {
  ids: string[];
  label: string;
  status: WebsiteUnitStatus;
  sqft: number | null;
  occupant: string | null;
}

/**
 * One website row per tracker unit, except units let or sold together as one
 * deal, which share a row labelled "203+204" — the same grouping the tracker's
 * own "2 units leased together" applies.
 *
 * A deal whose members disagree on status is not grouped: one row can only
 * carry one status, and showing a vacant unit as leased because its neighbour
 * is would be worse than showing two rows.
 */
export function toRows(units: SnapshotUnit[]): TrackerRow[] {
  const byDeal = new Map<string, SnapshotUnit[]>();
  const singles: SnapshotUnit[][] = [];

  for (const unit of units) {
    if (!unit.dealRef) {
      singles.push([unit]);
      continue;
    }
    const members = byDeal.get(unit.dealRef) ?? [];
    members.push(unit);
    byDeal.set(unit.dealRef, members);
  }

  const groups: SnapshotUnit[][] = [];
  for (const members of byDeal.values()) {
    const statuses = new Set(members.map((m) => STATUS_MAP[m.status]));
    if (members.length > 1 && statuses.size === 1) groups.push(members);
    else singles.push(...members.map((m) => [m]));
  }

  return [...groups, ...singles]
    .map((members) => {
      const ordered = [...members].sort((a, b) => byNumber(a.unitNumber, b.unitNumber));
      const sizes = ordered.map((m) => m.sqft);
      return {
        ids: ordered.map((m) => m.id),
        label: ordered.map((m) => labelParts(m.unitNumber).join('+')).join('+'),
        status: STATUS_MAP[ordered[0].status] ?? 'available',
        // A partial sum would understate the space, so an unknown member makes
        // the whole row unknown and the website's own figure stays.
        sqft: sizes.every((s) => typeof s === 'number' && s > 0)
          ? (sizes as number[]).reduce((sum, s) => sum + s, 0)
          : null,
        occupant: ordered.map((m) => m.occupant?.trim()).find(Boolean) ?? null,
      };
    })
    .sort((a, b) => byNumber(a.label, b.label));
}

/** "Building 01", "Bldg 1" and "building-1" all read as the same name. */
const nameKey = (name: unknown) =>
  norm(name)
    .replace(/\bbldg\b/g, 'building')
    .replace(/[^a-z0-9]/g, '')
    .replace(/(\D)0+(\d)/g, '$1$2');

const numberKey = (value: unknown) => {
  const match = String(value ?? '').match(/(\d+)\s*$/);
  return match ? String(Number(match[1])) : null;
};

function pairBuildings(websiteBuildings: WebsiteBuilding[], trackerBuildings: SnapshotBuilding[]) {
  const pairs = new Map<number, { tracker: SnapshotBuilding; matchedBy: BuildingReport['matchedBy'] }>();
  const claimed = new Set<string>();

  const pass = (
    matchedBy: BuildingReport['matchedBy'],
    keyOf: (w: WebsiteBuilding) => string | null | undefined,
    trackerKey: (t: SnapshotBuilding) => string | null,
  ) => {
    websiteBuildings.forEach((website, index) => {
      if (pairs.has(index)) return;
      const key = keyOf(website);
      if (!key) return;
      const candidates = trackerBuildings.filter((t) => !claimed.has(t.id) && trackerKey(t) === key);
      // An ambiguous match is no match: guessing which of two "Building 1"s
      // is meant would mirror one building's units onto another's plan.
      if (candidates.length !== 1) return;
      pairs.set(index, { tracker: candidates[0], matchedBy });
      claimed.add(candidates[0].id);
    });
  };

  pass('id', (w) => w.trackerBuildingId, (t) => t.id);
  pass('name', (w) => nameKey(w.building), (t) => nameKey(t.name));
  pass('number', (w) => numberKey(w.number) ?? numberKey(w.building), (t) => numberKey(t.name));

  return { pairs, unmatched: trackerBuildings.filter((t) => !claimed.has(t.id)) };
}

/**
 * Finds the existing row each tracker row continues, in three passes so a
 * weaker match can never take a row a stronger one needs: shared tracker ids,
 * then the same label, then the same unit numbers in any order or spacing.
 */
function pairRows(existing: WebsiteUnit[], rows: TrackerRow[]) {
  const priorOf = new Map<number, number>();
  const claimed = new Set<number>();

  const pass = (matches: (unit: WebsiteUnit, row: TrackerRow) => boolean) => {
    rows.forEach((row, r) => {
      if (priorOf.has(r)) return;
      const e = existing.findIndex((unit, i) => !claimed.has(i) && matches(unit, row));
      if (e === -1) return;
      priorOf.set(r, e);
      claimed.add(e);
    });
  };

  pass((unit, row) => (unit.trackerUnitIds ?? []).some((id) => row.ids.includes(id)));
  pass((unit, row) => norm(unit.label) !== '' && norm(unit.label) === norm(row.label));
  pass((unit, row) => partsKey(unit.label) !== '' && partsKey(unit.label) === partsKey(row.label));

  return { priorOf, claimed };
}

function mergeRow(prior: WebsiteUnit | undefined, row: TrackerRow): WebsiteUnit {
  const next: WebsiteUnit = {
    ...(prior ?? blankUnit(row.label)),
    label: row.label,
    status: row.status,
    trackerUnitIds: row.ids,
  };
  // Only where the tracker knows the size: blanking one the site already has
  // would be a loss, not a mirror.
  if (row.sqft !== null) next.size = row.sqft.toLocaleString('en-US');

  // The tenant is the tracker's only while a lease says who it is. A sold
  // unit's text is left to the website — the tracker's party there is a buyer,
  // which is never published, and an owner-occupier's trading name is the
  // website's to write.
  if (row.status === 'leased') next.tenant = row.occupant ?? prior?.tenant ?? '';
  else if (row.status === 'available' || row.status === 'coming-soon') next.tenant = '';

  return next;
}

const photoCount = (unit: WebsiteUnit) =>
  (Array.isArray(unit.images) ? unit.images : []).filter((url: unknown) => String(url ?? '').trim()).length;

export function mergeSnapshot(
  floorPlans: Record<string, any> | null | undefined,
  totalsBefore: Totals,
  snapshot: TrackerSnapshot,
  options: { force?: boolean } = {},
): MergeResult {
  const websiteBuildings: WebsiteBuilding[] = floorPlans?.buildings ?? [];
  const { pairs, unmatched } = pairBuildings(websiteBuildings, snapshot.buildings);

  const reports: BuildingReport[] = [];
  const untouched: string[] = [];
  let removedRows = 0;
  let existingRows = 0;
  let totalUnits = 0;
  let totalAvailable = 0;

  const buildings = websiteBuildings.map((building, index) => {
    const pair = pairs.get(index);
    if (!pair) {
      untouched.push(String(building.building ?? `#${index + 1}`));
      totalUnits += Number(building.units) || (building.unitList ?? []).length;
      totalAvailable += Number(building.available) || 0;
      return building;
    }

    const existing = building.unitList ?? [];
    const rows = toRows(pair.tracker.units);
    const { priorOf, claimed } = pairRows(existing, rows);

    const report: BuildingReport = {
      building: String(building.building ?? ''),
      trackerBuilding: pair.tracker.name,
      matchedBy: pair.matchedBy,
      added: [],
      removed: [],
      relabelled: [],
      statusChanged: [],
      units: 0,
      available: 0,
    };

    const unitList = rows.map((row, r) => {
      const e = priorOf.get(r);
      const prior = e === undefined ? undefined : existing[e];
      if (!prior) report.added.push(row.label);
      else {
        if (norm(prior.label) !== norm(row.label)) report.relabelled.push({ from: String(prior.label), to: row.label });
        if (prior.status !== row.status) {
          report.statusChanged.push({ label: row.label, from: String(prior.status ?? ''), to: row.status });
        }
      }
      // Headline counts are in units, not rows: "203+204" counts as two. A
      // single tracker record named "201+202+203+204" counts as one, which is
      // how the tracker's own header arrives at its figure.
      report.units += row.ids.length;
      if (row.status === 'available') report.available += row.ids.length;
      return mergeRow(prior, row);
    });

    existing.forEach((unit, i) => {
      if (!claimed.has(i)) report.removed.push({ label: String(unit.label ?? ''), photos: photoCount(unit) });
    });

    removedRows += report.removed.length;
    existingRows += existing.length;
    totalUnits += report.units;
    totalAvailable += report.available;
    reports.push(report);

    return {
      ...building,
      trackerBuildingId: pair.tracker.id,
      unitList,
      units: report.units,
      available: report.available,
    };
  });

  const totals: Totals = {
    buildings: totalUnits,
    sold: totalUnits - totalAvailable,
    available: totalAvailable,
  };

  const nextFloorPlans = { ...(floorPlans ?? {}), buildings };
  const changed =
    JSON.stringify(nextFloorPlans) !== JSON.stringify(floorPlans ?? {}) ||
    totals.buildings !== totalsBefore.buildings ||
    totals.sold !== totalsBefore.sold ||
    totals.available !== totalsBefore.available;

  const tooMany =
    removedRows > MIN_REMOVALS_TO_GUARD && removedRows > existingRows * MAX_REMOVAL_RATIO;
  const refused =
    tooMany && !options.force
      ? `would remove ${removedRows} of ${existingRows} unit rows; resend with force to apply`
      : null;

  return {
    floorPlans: nextFloorPlans,
    totals,
    report: {
      changed,
      buildings: reports,
      untouched,
      unmatchedTrackerBuildings: unmatched.map((t) => t.name),
      totals: { before: totalsBefore, after: totals },
      removedRows,
      existingRows,
      refused,
    },
  };
}
