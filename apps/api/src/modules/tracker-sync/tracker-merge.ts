/**
 * Merges a Prime Tracker project snapshot into a property's floor plans.
 *
 * Pure on purpose: no Prisma, no Nest. Everything the sync decides — which row
 * is which, what changes, what is refused — is decided here, so all of it can
 * be tested without a database. See docs/tracker-sync-and-aws-plan.md.
 *
 * The tracker owns a unit row's label, status, size and (for leased units)
 * tenant, and everything under `row.tracker`. Everything else on the row —
 * photographs, pins, logo, rate, description — belongs to the website and is
 * carried over untouched, including when the tracker renumbers a unit, moves
 * it to another building, or splits or combines units.
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

/** Snapshot versions this file merges. Version 2 only adds optional fields. */
export const SNAPSHOT_VERSIONS = [1, 2] as const;

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

/**
 * Null for a status a newer tracker added that this file does not know yet.
 * Never a default: reading an unknown status as "available" would advertise a
 * unit the tracker may already have taken.
 */
const websiteStatusOf = (status: string): WebsiteUnitStatus | null =>
  Object.prototype.hasOwnProperty.call(STATUS_MAP, status) ? STATUS_MAP[status as TrackerUnitStatus] : null;

export interface SnapshotUnit {
  id: string;
  unitNumber: string;
  /** A `TrackerUnitStatus`, or one a newer tracker added — see `unknownStatus`. */
  status: string;
  sqft: number | null;
  /** `LEASE:<ref>` or `SALE:<ref>` when let or sold together with other units. */
  dealRef: string | null;
  /** Tenant brand of the active lease. Never a buyer. */
  occupant: string | null;

  // Version 2. All optional, so a version 1 snapshot is merged exactly as before.

  /** Every unit in the same deal, this one included, whatever each one's status. */
  dealUnitIds?: string[];
  /** Units combined into this one. Combining mints a new tracker id; these say what it continues. */
  mergedFromIds?: string[];
  unitType?: string | null;
  /** Per sq ft per month. The tracker sends it for units on the market only. */
  askingRent?: number | null;
  askingPrice?: number | null;
  availableSince?: string | null;
}

export interface SnapshotBuilding {
  id: string;
  name: string;
  units: SnapshotUnit[];
  /** Version 2. */
  totalSqft?: number | null;
  stories?: number | null;
}

export interface TrackerSnapshot {
  version: (typeof SNAPSHOT_VERSIONS)[number];
  generatedAt: string;
  project: { id: string; name: string; websiteSlug: string };
  buildings: SnapshotBuilding[];
}

/**
 * What the sync last wrote about a row, under `row.tracker`. Written only by
 * the sync; the top-level fields the public site and CMS read are still
 * written exactly as before, so nothing reads this yet.
 */
export interface RowTrackerFields {
  ids: string[];
  /** The tracker's own unit numbers, joined with "+" like the label. */
  unitNumber: string;
  /** The tracker's status; for a row of units whose statuses differ, each one in unit order, joined with "+". */
  status: string;
  sqft: number | null;
  unitType: string | null;
  askingRent: number | null;
  askingPrice: number | null;
  availableSince: string | null;
  /**
   * The snapshot that last changed the values above. Not every push: the
   * hourly push must compare equal to what is stored, or it would be a write.
   */
  syncedAt: string;
}

/** A unit row as it sits in `detail.floorPlans.buildings[].unitList`. */
export type WebsiteUnit = Record<string, any> & {
  label?: string;
  status?: string;
  trackerUnitIds?: string[];
  tracker?: RowTrackerFields;
};

export type WebsiteBuilding = Record<string, any> & {
  building?: string;
  number?: string;
  unitList?: WebsiteUnit[];
  /** The tracker building this one mirrors, stored on its first match and matched on first ever after. */
  trackerBuildingId?: string;
  /** A per-building model: `bindings` maps mesh name → unit label (apps/web/src/lib/units.js). */
  model?: Record<string, any> & { url?: string; bindings?: Record<string, string>; meshNames?: string[] };
};

/** `detail.siteModel`. `unitBindings` maps mesh name → building and unit label (apps/web/src/lib/siteModel.js). */
export type SiteModel = Record<string, any> & {
  unitBindings?: Record<string, Record<string, any> & { buildingLabel?: string; unitLabel?: string }>;
};

export interface Totals {
  /** The column is called `buildings` but holds the total UNIT count. */
  buildings: number;
  sold: number;
  available: number;
}

/**
 * `detail.trackerCounts`: every unit in the snapshot by the tracker's own
 * status, matched to a website building or not.
 *
 * Stored, not shown. The headline totals still count "sold" as every unit that
 * is not available, so UNDER_CONTRACT and LEASE_PENDING (and
 * UNDER_CONSTRUCTION) count as taken, while the tracker's own header counts
 * SOLD + LEASED + OCCUPIED. Which is right for UNDER_CONTRACT and
 * LEASE_PENDING is the client's call; until it is made the headline keeps its
 * formula, so nothing visible changes, and these counts let it follow the
 * decision without another push.
 */
export interface TrackerCounts {
  units: number;
  /** All seven tracker statuses, plus any a newer tracker sent. */
  byStatus: Record<string, number>;
}

export interface RemovedRow {
  label: string;
  photos: number;
  /** Has a 2D placement pin (x/y). */
  pinned: boolean;
  /** A 3D shape is bound to it. The binding is left as it is: render ignores a stale one. */
  bound: boolean;
}

export interface BuildingReport {
  building: string;
  trackerBuilding: string;
  trackerBuildingId: string;
  matchedBy: 'id' | 'name' | 'number';
  added: string[];
  removed: RemovedRow[];
  /** Rows whose units now sit in another row: one side of a split or a combine. Their media went with them. */
  absorbed: { label: string; into: string[] }[];
  movedIn: { label: string; from: string }[];
  movedOut: { label: string; to: string }[];
  relabelled: { from: string; to: string }[];
  statusChanged: { label: string; from: string; to: string }[];
  /** Rows that took photographs, a description or a pin from the rows they continue. */
  carried: { label: string; from: string[] }[];
  /** Rows with a status this file does not know. `kept` is the status left on the row; null means it was not created. */
  unknownStatus: { label: string; status: string; kept: string | null }[];
  units: number;
  available: number;
}

export interface UnmatchedTrackerBuilding {
  id: string;
  name: string;
  units: number;
  available: number;
  rows: string[];
}

/** A website building whose stored `trackerBuildingId` matched nothing. Left as it is and still counted. */
export interface StaleLink {
  building: string;
  trackerBuildingId: string;
  reason: 'not-in-snapshot' | 'claimed-by-another-building';
}

export interface Rebound {
  mesh: string;
  /** "site" for `detail.siteModel`, else the building whose own model it is. */
  model: string;
  from: string;
  to: string;
}

/** Tallies of the lists below, for the tracker's log line. */
export interface ReportCounts {
  added: number;
  removed: number;
  absorbed: number;
  moved: number;
  relabelled: number;
  statusChanged: number;
  rebound: number;
  unknownStatuses: number;
  unmatchedTrackerBuildings: number;
  unmatchedUnits: number;
  staleLinks: number;
  untouched: number;
}

export interface MergeReport {
  version: number;
  changed: boolean;
  buildings: BuildingReport[];
  /** Website buildings the tracker has no building for — left exactly as they were, and still counted. */
  untouched: string[];
  staleLinks: StaleLink[];
  /** Tracker buildings with no website building — never created; their units are counted in the totals. */
  unmatchedTrackerBuildings: UnmatchedTrackerBuilding[];
  /** 3D bindings re-pointed at a relabelled or moved row. */
  rebound: Rebound[];
  trackerCounts: TrackerCounts;
  totals: { before: Totals; after: Totals };
  removedRows: number;
  existingRows: number;
  counts: ReportCounts;
  /** Everything that needs `force`, whether or not force was given. */
  refusals: string[];
  /** Set when this snapshot was refused: the refusals, unforced. */
  refused: string | null;
}

export interface MergeOptions {
  force?: boolean;
  /** `detail.siteModel`, whose unit bindings follow a relabelled or moved row. */
  siteModel?: SiteModel | null;
  /** `detail.trackerCounts` as stored, so a push that changes nothing is not a write. */
  trackerCounts?: TrackerCounts | null;
}

export interface MergeResult {
  floorPlans: Record<string, any>;
  siteModel: SiteModel | null | undefined;
  trackerCounts: TrackerCounts;
  totals: Totals;
  report: MergeReport;
}

/**
 * A snapshot that would remove more than this share of the rows in the
 * buildings it touches — and more than MIN_REMOVALS_TO_GUARD rows — is refused
 * unless forced. Applied to each building as well as to the whole property: a
 * tracker query that silently lost one building's units must not empty that
 * building just because the property is large. A genuine clean-up is sent
 * again with `force`.
 */
export const MAX_REMOVAL_RATIO = 0.25;
export const MIN_REMOVALS_TO_GUARD = 3;

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const unique = <T>(values: T[]) => [...new Set(values)];
const shares = (a: string[], b: string[]) => a.some((value) => b.includes(value));
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((value) => b.includes(value));

/**
 * JSON with every object's keys sorted. Postgres jsonb keeps keys in an order
 * of its own (shortest first), so a stored row and the same row freshly merged
 * differ in key order alone; comparing them as written would make every push a
 * write.
 */
const canonical = (value: unknown) =>
  JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );

/**
 * One unit number as the website writes it. The tracker's numbers are typed by
 * hand, so "Unit 905", "Suite #101A", "#12" and "0906" are the units the
 * website calls 905, 101A, 12 and 906.
 */
const normalisePart = (part: string) =>
  part
    .trim()
    .replace(/^(?:(?:unit|suite)(?![a-z])[\s.:#-]*|#\s*)/i, '')
    .replace(/^0+(?=\d)/, '');

/** Same split as `unitLabelParts()` in apps/web/src/lib/units.js, with each part normalised. */
export const labelParts = (label: unknown) =>
  String(label ?? '')
    .split('+')
    .map(normalisePart)
    .filter(Boolean);

/** "Unit 203 + 0204" → "203+204": what the merge writes, and what it matches on. */
export const normaliseLabel = (label: unknown) => {
  const parts = labelParts(label);
  return parts.length ? parts.join('+') : String(label ?? '').trim();
};

const labelKey = (label: unknown) => norm(normaliseLabel(label));
const partsKey = (label: unknown) => labelParts(label).map(norm).sort(byNumber).join('+');
const overlaps = (a: unknown, b: unknown) => shares(labelParts(a).map(norm), labelParts(b).map(norm));

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

export interface TrackerRow {
  ids: string[];
  /** Units combined into this row's units (version 2). */
  mergedFromIds: string[];
  /** Every unit in a deal with this row's units, whatever their status (version 2). */
  dealUnitIds: string[];
  label: string;
  /** Null when a unit's status is one this file does not know. */
  status: WebsiteUnitStatus | null;
  sqft: number | null;
  occupant: string | null;
  units: SnapshotUnit[];
}

/**
 * One website row per tracker unit, except units let or sold together as one
 * deal, which share a row labelled "203+204" — the same grouping the tracker's
 * own "2 units leased together" applies.
 *
 * A deal whose members disagree on status is not grouped: one row can only
 * carry one status, and showing a vacant unit as leased because its neighbour
 * is would be worse than showing two rows. A unit whose status is unknown is
 * never grouped, for the same reason.
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
    const statuses = members.map((m) => websiteStatusOf(m.status));
    if (members.length > 1 && !statuses.includes(null) && new Set(statuses).size === 1) groups.push(members);
    else singles.push(...members.map((m) => [m]));
  }

  return [...groups, ...singles]
    .map((members) => {
      const ordered = [...members].sort((a, b) => byNumber(normaliseLabel(a.unitNumber), normaliseLabel(b.unitNumber)));
      const ids = ordered.map((m) => m.id);
      const statuses = ordered.map((m) => websiteStatusOf(m.status));
      const sizes = ordered.map((m) => m.sqft);
      return {
        ids,
        mergedFromIds: unique(ordered.flatMap((m) => m.mergedFromIds ?? [])).filter((id) => !ids.includes(id)),
        dealUnitIds: unique(ordered.flatMap((m) => m.dealUnitIds ?? [])),
        label: ordered.map((m) => normaliseLabel(m.unitNumber)).join('+'),
        status: statuses.includes(null) ? null : statuses[0],
        // A partial sum would understate the space, so an unknown member makes
        // the whole row unknown and the website's own figure stays.
        sqft: sizes.every((s) => typeof s === 'number' && s > 0)
          ? (sizes as number[]).reduce((sum, s) => sum + s, 0)
          : null,
        occupant: ordered.map((m) => m.occupant?.trim()).find(Boolean) ?? null,
        units: ordered,
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

const buildingLabel = (building: WebsiteBuilding, index: number) => String(building.building ?? `#${index + 1}`);

/**
 * Website buildings to tracker buildings. The stored `trackerBuildingId` is
 * the mapping: once a building has matched it stays matched whatever either
 * side is renamed, and it never falls back to its name — a linked building
 * whose tracker building has gone is reported, not re-matched to whichever
 * building now has its name. Name, then number, is the first-time fallback for
 * buildings never linked.
 */
function pairBuildings(websiteBuildings: WebsiteBuilding[], trackerBuildings: SnapshotBuilding[]) {
  const pairs = new Map<number, { tracker: SnapshotBuilding; matchedBy: BuildingReport['matchedBy'] }>();
  const claimed = new Set<string>();
  const staleLinks: StaleLink[] = [];

  websiteBuildings.forEach((website, index) => {
    const id = website.trackerBuildingId;
    if (!id) return;
    const tracker = trackerBuildings.find((t) => t.id === id);
    if (!tracker || claimed.has(id)) {
      // Claimed twice is a building duplicated in the CMS, link and all.
      const reason = tracker ? 'claimed-by-another-building' : 'not-in-snapshot';
      staleLinks.push({ building: buildingLabel(website, index), trackerBuildingId: id, reason });
      return;
    }
    pairs.set(index, { tracker, matchedBy: 'id' });
    claimed.add(id);
  });

  const pass = (
    matchedBy: BuildingReport['matchedBy'],
    keyOf: (w: WebsiteBuilding) => string | null | undefined,
    trackerKey: (t: SnapshotBuilding) => string | null,
  ) => {
    websiteBuildings.forEach((website, index) => {
      if (pairs.has(index) || website.trackerBuildingId) return;
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

  pass('name', (w) => nameKey(w.building), (t) => nameKey(t.name));
  pass('number', (w) => numberKey(w.number) ?? numberKey(w.building), (t) => numberKey(t.name));

  return { pairs, unmatched: trackerBuildings.filter((t) => !claimed.has(t.id)), staleLinks };
}

interface Prior {
  b: number;
  unit: WebsiteUnit;
}

interface Slot {
  b: number;
  row: TrackerRow;
}

const idsOf = (prior: Prior) => (Array.isArray(prior.unit.trackerUnitIds) ? prior.unit.trackerUnitIds : []);

/**
 * Whether a row carries on a prior row as the same thing: same building, same
 * label, and — once rows carry tracker ids — the same units. A first sync has
 * no ids to compare, so there the label decides.
 */
const continuesUnchanged = (prior: Prior, slot: Slot) =>
  prior.b === slot.b &&
  String(prior.unit.label ?? '') === slot.row.label &&
  (idsOf(prior).length === 0 || sameSet(idsOf(prior), slot.row.ids));

/**
 * Finds the existing row each tracker row continues, across every building
 * the snapshot touches, in passes so a weaker match can never take a row a
 * stronger one needs: shared tracker ids (same building first, then any, so a
 * moved unit keeps its photographs), the ids a combined unit was made from,
 * then — in the same building only — the same label, the same unit numbers in
 * any order or spacing, and finally any unit number in common (a split, or a
 * combine the tracker has no ids for yet).
 *
 * Labels and numbers only ever match a row that is not linked to a unit the
 * snapshot still has: once a row carries tracker ids, those decide. Otherwise
 * a unit taking a renumbered neighbour's old number would take its
 * photographs too.
 *
 * Then the donors: rows a new or renamed row takes media from. A row that
 * continues one prior row unchanged takes nothing, which is what keeps
 * Building 2's 201 apart from its neighbour "201+202+203+204"; and a donor
 * must itself be gone or renamed, so a row that carries on as it was never
 * gives its photographs away.
 */
function pairRows(
  websiteBuildings: WebsiteBuilding[],
  rowsByBuilding: Map<number, TrackerRow[]>,
  snapshotIds: string[],
) {
  const priors: Prior[] = [];
  const slots: Slot[] = [];
  for (const [b, rows] of rowsByBuilding) {
    for (const unit of websiteBuildings[b].unitList ?? []) priors.push({ b, unit });
    for (const row of rows) slots.push({ b, row });
  }

  const live = new Set(snapshotIds);
  const free = (prior: Prior) => !idsOf(prior).some((id) => live.has(id));

  const primaryOf = new Map<Slot, Prior>();
  const continuedBy = new Map<Prior, Slot>();

  const pass = (matches: (prior: Prior, slot: Slot) => boolean) => {
    for (const slot of slots) {
      if (primaryOf.has(slot)) continue;
      const prior = priors.find((p) => !continuedBy.has(p) && matches(p, slot));
      if (!prior) continue;
      primaryOf.set(slot, prior);
      continuedBy.set(prior, slot);
    }
  };

  pass((p, s) => p.b === s.b && shares(idsOf(p), s.row.ids));
  pass((p, s) => shares(idsOf(p), s.row.ids));
  pass((p, s) => shares(idsOf(p), s.row.mergedFromIds));
  const byLabel = (key: (label: unknown) => string) => (p: Prior, s: Slot) =>
    p.b === s.b && free(p) && key(p.unit.label) !== '' && key(p.unit.label) === key(s.row.label);
  pass(byLabel(labelKey));
  pass(byLabel(partsKey));
  pass((p, s) => p.b === s.b && free(p) && overlaps(p.unit.label, s.row.label));

  const donorsOf = new Map<Slot, Prior[]>();
  for (const slot of slots) {
    const primary = primaryOf.get(slot);
    if (primary && continuesUnchanged(primary, slot)) continue;
    // A row with an unknown status and nothing to continue is not created, so it takes nothing.
    if (!primary && slot.row.status === null) continue;
    const identity = [...slot.row.ids, ...slot.row.mergedFromIds];
    const donors = priors.filter((p) => {
      if (p === primary) return false;
      const next = continuedBy.get(p);
      if (next && continuesUnchanged(p, next)) return false;
      if (shares(idsOf(p), identity)) return true;
      if (p.b !== slot.b) return false;
      return shares(idsOf(p), slot.row.dealUnitIds) || (free(p) && overlaps(p.unit.label, slot.row.label));
    });
    if (donors.length) donorsOf.set(slot, donors);
  }

  return { priors, slots, primaryOf, continuedBy, donorsOf };
}

const imagesOf = (unit: WebsiteUnit): string[] =>
  (Array.isArray(unit.images) ? unit.images : []).filter((url: unknown) => String(url ?? '').trim());

const photoCount = (unit: WebsiteUnit) => imagesOf(unit).length;

const hasPin = (unit: WebsiteUnit) => Number.isFinite(unit.x) && Number.isFinite(unit.y);

/**
 * Photographs, description and pin from the rows this one continues under a
 * new identity — the other half of a split, the rest of a combine. Only into
 * what the row lacks: its own are never replaced or reordered.
 */
function carryMedia(next: WebsiteUnit, donors: WebsiteUnit[]): boolean {
  const own = imagesOf(next);
  const added: string[] = [];
  let carried = false;
  for (const donor of donors) {
    for (const url of imagesOf(donor)) {
      if (!own.includes(url) && !added.includes(url)) added.push(url);
    }
    if (!String(next.description ?? '').trim() && String(donor.description ?? '').trim()) {
      next.description = donor.description;
      carried = true;
    }
    if (!hasPin(next) && hasPin(donor)) {
      next.x = donor.x;
      next.y = donor.y;
      carried = true;
    }
  }
  if (added.length) next.images = [...(Array.isArray(next.images) ? next.images : []), ...added];
  return carried || added.length > 0;
}

/** One value when every unit of the row agrees on it, else null. */
const agreed = <T>(values: (T | null | undefined)[]): T | null => {
  const first = values[0] ?? null;
  return values.every((v) => (v ?? null) === first) ? first : null;
};

const trackerKeyOf = (t: Partial<RowTrackerFields> | undefined) =>
  JSON.stringify([t?.ids, t?.unitNumber, t?.status, t?.sqft, t?.unitType, t?.askingRent, t?.askingPrice, t?.availableSince]);

function trackerFields(row: TrackerRow, previous: RowTrackerFields | undefined, syncedAt: string): RowTrackerFields {
  // Asking figures only while the row is on the market: on a let or sold unit
  // they read as what was paid. The tracker sends them only then as well.
  const onMarket = row.status === 'available' || row.status === 'coming-soon';
  const fields = {
    ids: row.ids,
    unitNumber: row.units.map((u) => String(u.unitNumber).trim()).join('+'),
    status: unique(row.units.map((u) => u.status)).join('+'),
    sqft: row.sqft,
    unitType: agreed(row.units.map((u) => u.unitType)),
    askingRent: onMarket ? agreed(row.units.map((u) => u.askingRent)) : null,
    askingPrice: onMarket ? agreed(row.units.map((u) => u.askingPrice)) : null,
    availableSince: agreed(row.units.map((u) => u.availableSince)),
  };
  const unchanged = previous?.syncedAt && trackerKeyOf(previous) === trackerKeyOf(fields);
  return { ...fields, syncedAt: unchanged ? previous.syncedAt : syncedAt };
}

function mergeRow(prior: WebsiteUnit | undefined, row: TrackerRow, donors: WebsiteUnit[], syncedAt: string) {
  const next: WebsiteUnit = {
    ...(prior ?? blankUnit(row.label)),
    label: row.label,
    // An unknown status keeps the row's last one — see websiteStatusOf().
    status: row.status ?? prior?.status,
    trackerUnitIds: row.ids,
  };
  const carried = carryMedia(next, donors);

  // Only where the tracker knows the size: blanking one the site already has
  // would be a loss, not a mirror.
  if (row.sqft !== null) next.size = row.sqft.toLocaleString('en-US');

  // The tenant is the tracker's only while a lease says who it is. A sold
  // unit's text is left to the website — the tracker's party there is a buyer,
  // which is never published, and an owner-occupier's trading name is the
  // website's to write. A row whose units are all LEASE_PENDING has no lease
  // in place: the tracker moves LEASED → LEASE_PENDING when a successor signs
  // while the sitting tenant leaves, so the name the sync wrote goes too.
  const pendingOnly = row.units.every((u) => u.status === 'LEASE_PENDING');
  if (row.status === 'leased') next.tenant = row.occupant ?? (pendingOnly ? '' : prior?.tenant ?? '');
  else if (row.status === 'available' || row.status === 'coming-soon') next.tenant = '';

  next.tracker = trackerFields(row, prior?.tracker, syncedAt);
  return { next, carried };
}

const MESH_PREFIX = 'unit-';

/** The unit label a per-building model's mesh claims by name — `meshUnitLabel()` in apps/web/src/lib/units.js. */
const meshUnitLabel = (meshName: string) => {
  const name = String(meshName ?? '').trim();
  return name.toLowerCase().startsWith(MESH_PREFIX) ? name.slice(MESH_PREFIX.length).trim() : null;
};

const siteKey = (building: unknown, label: unknown) => `${norm(building)}::${norm(label)}`;

/** Whether any 3D shape, in the site model or the building's own, resolves to this row. */
function isBound(siteModel: SiteModel | null | undefined, building: WebsiteBuilding, label: unknown) {
  const key = siteKey(building.building, label);
  const site = Object.values(siteModel?.unitBindings ?? {}).some((b) => siteKey(b?.buildingLabel, b?.unitLabel) === key);
  if (site || !building.model?.url) return site;
  const explicit = Object.values(building.model.bindings ?? {}).some((l) => norm(l) === norm(label));
  const byName = (building.model.meshNames ?? []).some((mesh) => {
    const claimed = meshUnitLabel(mesh);
    return claimed !== null && norm(claimed) === norm(label) && !(mesh in (building.model?.bindings ?? {}));
  });
  return explicit || byName;
}

interface Rekey {
  fromBuilding: number;
  fromLabel: string;
  toBuilding: number;
  toLabel: string;
}

/**
 * Re-points the site model's unit bindings at relabelled and moved rows, keyed
 * as siteModel.js keys them (building label and unit label, trimmed and
 * lower-cased). Every binding is looked up once against the old labels, so two
 * units swapping numbers swap their shapes too. A removed row's binding is
 * left alone — reconcileSite() ignores a stale one, and restoring the unit
 * re-links its shape.
 */
function rekeySiteBindings(siteModel: SiteModel | null | undefined, rekeys: Rekey[], buildings: WebsiteBuilding[]) {
  const rebound: Rebound[] = [];
  if (!siteModel?.unitBindings || !rekeys.length) return { siteModel, rebound };

  const targets = new Map(
    rekeys.map((k) => [
      siteKey(buildings[k.fromBuilding].building, k.fromLabel),
      { buildingLabel: String(buildings[k.toBuilding].building ?? ''), unitLabel: k.toLabel },
    ]),
  );
  const unitBindings: NonNullable<SiteModel['unitBindings']> = {};
  for (const [mesh, binding] of Object.entries(siteModel.unitBindings)) {
    const to = targets.get(siteKey(binding?.buildingLabel, binding?.unitLabel));
    if (!to || (binding.buildingLabel === to.buildingLabel && binding.unitLabel === to.unitLabel)) {
      unitBindings[mesh] = binding;
      continue;
    }
    unitBindings[mesh] = { ...binding, ...to };
    rebound.push({
      mesh,
      model: 'site',
      from: `${binding.buildingLabel} / ${binding.unitLabel}`,
      to: `${to.buildingLabel} / ${to.unitLabel}`,
    });
  }
  return { siteModel: rebound.length ? { ...siteModel, unitBindings } : siteModel, rebound };
}

/**
 * The same for a building's own model, the way `applyUnitChange()` in
 * apps/web/src/lib/units.js does it: an explicit binding to the old label is
 * re-pointed, and a shape linked by name (`unit-605`) — which has nothing
 * stored to re-point — gets an explicit binding to the new one.
 */
function rekeyModelBindings(building: WebsiteBuilding, renames: Map<string, string>) {
  const model = building.model;
  const rebound: Rebound[] = [];
  if (!model?.url || !renames.size) return { model, rebound };

  const explicit = model.bindings ?? {};
  const bindings: Record<string, string> = { ...explicit };
  const where = String(building.building ?? '');
  for (const [mesh, label] of Object.entries(explicit)) {
    const to = renames.get(norm(label));
    if (to === undefined || label === to) continue;
    bindings[mesh] = to;
    rebound.push({ mesh, model: where, from: String(label), to });
  }
  for (const mesh of model.meshNames ?? []) {
    const claimed = meshUnitLabel(mesh);
    if (claimed === null || mesh in explicit) continue;
    const to = renames.get(norm(claimed));
    if (to === undefined || norm(claimed) === norm(to)) continue;
    bindings[mesh] = to;
    rebound.push({ mesh, model: where, from: claimed, to });
  }
  return { model: rebound.length ? { ...model, bindings } : model, rebound };
}

function countStatuses(snapshot: TrackerSnapshot): TrackerCounts {
  const byStatus: Record<string, number> = Object.fromEntries(TRACKER_UNIT_STATUSES.map((s) => [s, 0]));
  let units = 0;
  for (const building of snapshot.buildings) {
    for (const unit of building.units) {
      units++;
      byStatus[unit.status] = (byStatus[unit.status] ?? 0) + 1;
    }
  }
  return { units, byStatus };
}

const tooMany = (removed: number, existing: number) =>
  removed > MIN_REMOVALS_TO_GUARD && removed > existing * MAX_REMOVAL_RATIO;

export function mergeSnapshot(
  floorPlans: Record<string, any> | null | undefined,
  totalsBefore: Totals,
  snapshot: TrackerSnapshot,
  options: MergeOptions = {},
): MergeResult {
  const websiteBuildings: WebsiteBuilding[] = Array.isArray(floorPlans?.buildings) ? floorPlans!.buildings : [];
  const { pairs, unmatched, staleLinks } = pairBuildings(websiteBuildings, snapshot.buildings);
  const syncedAt = snapshot.generatedAt;

  const rowsByBuilding = new Map<number, TrackerRow[]>();
  for (const [b, pair] of pairs) rowsByBuilding.set(b, toRows(pair.tracker.units));
  const { priors, slots, primaryOf, continuedBy, donorsOf } = pairRows(
    websiteBuildings,
    rowsByBuilding,
    snapshot.buildings.flatMap((b) => b.units.map((u) => u.id)),
  );

  const reports = new Map<number, BuildingReport>();
  const untouched: string[] = [];
  const rekeys: Rekey[] = [];
  let totalUnits = 0;
  let totalAvailable = 0;

  const absorbedInto = new Map<Prior, Slot[]>();
  for (const [slot, donors] of donorsOf) {
    for (const donor of donors) {
      if (!continuedBy.has(donor)) absorbedInto.set(donor, [...(absorbedInto.get(donor) ?? []), slot]);
    }
  }

  const buildings = websiteBuildings.map((building, b) => {
    const pair = pairs.get(b);
    if (!pair) {
      untouched.push(buildingLabel(building, b));
      totalUnits += Number(building.units) || (building.unitList ?? []).length;
      totalAvailable += Number(building.available) || 0;
      return building;
    }

    const report: BuildingReport = {
      building: String(building.building ?? ''),
      trackerBuilding: pair.tracker.name,
      trackerBuildingId: pair.tracker.id,
      matchedBy: pair.matchedBy,
      added: [],
      removed: [],
      absorbed: [],
      movedIn: [],
      movedOut: [],
      relabelled: [],
      statusChanged: [],
      carried: [],
      unknownStatus: [],
      units: 0,
      available: 0,
    };
    reports.set(b, report);

    const unitList: WebsiteUnit[] = [];
    for (const slot of slots.filter((s) => s.b === b)) {
      const { row } = slot;
      const primary = primaryOf.get(slot);
      const prior = primary?.unit;

      // Headline counts are in units, not rows: "203+204" counts as two. A
      // single tracker record named "201+202+203+204" counts as one, which is
      // how the tracker's own header arrives at its figure.
      report.units += row.ids.length;

      if (row.status === null) {
        const status = unique(row.units.map((u) => u.status).filter((s) => websiteStatusOf(s) === null)).join('+');
        report.unknownStatus.push({ label: row.label, status, kept: prior ? String(prior.status ?? '') : null });
        // Nothing to keep: held back until the status is one this file knows,
        // rather than published as something it may not be.
        if (!prior) continue;
      }

      if (!primary || !prior) report.added.push(row.label);
      else {
        if (primary.b !== b) {
          report.movedIn.push({ label: row.label, from: buildingLabel(websiteBuildings[primary.b], primary.b) });
        }
        const was = String(prior.label ?? '');
        if (was !== row.label) report.relabelled.push({ from: was, to: row.label });
        if (row.status !== null && prior.status !== row.status) {
          report.statusChanged.push({ label: row.label, from: String(prior.status ?? ''), to: row.status });
        }
        if (primary.b !== b || was !== row.label) {
          rekeys.push({ fromBuilding: primary.b, fromLabel: was, toBuilding: b, toLabel: row.label });
        }
      }

      const donors = donorsOf.get(slot) ?? [];
      const { next, carried } = mergeRow(prior, row, donors.map((d) => d.unit), syncedAt);
      if (carried) report.carried.push({ label: row.label, from: donors.map((d) => String(d.unit.label ?? '')) });
      if (next.status === 'available') report.available += row.ids.length;
      unitList.push(next);
    }

    totalUnits += report.units;
    totalAvailable += report.available;

    return {
      ...building,
      trackerBuildingId: pair.tracker.id,
      unitList,
      units: report.units,
      available: report.available,
      tracker: {
        id: pair.tracker.id,
        name: pair.tracker.name,
        totalSqft: pair.tracker.totalSqft ?? null,
        stories: pair.tracker.stories ?? null,
      },
    } as WebsiteBuilding;
  });

  // What every prior row became: continued (perhaps moved), absorbed into
  // another row with its media, or removed.
  let removedRows = 0;
  let existingRows = 0;
  for (const prior of priors) {
    const report = reports.get(prior.b)!;
    const label = String(prior.unit.label ?? '');
    existingRows++;
    const next = continuedBy.get(prior);
    if (next) {
      if (next.b !== prior.b) report.movedOut.push({ label, to: buildingLabel(websiteBuildings[next.b], next.b) });
      continue;
    }
    const into = absorbedInto.get(prior);
    if (into) {
      report.absorbed.push({ label, into: into.map((s) => s.row.label) });
      // Into one row, its shapes follow (both halves of a combine light up);
      // into several, there is no one row to point at, so they are left.
      if (into.length === 1 && label !== into[0].row.label) {
        rekeys.push({ fromBuilding: prior.b, fromLabel: label, toBuilding: into[0].b, toLabel: into[0].row.label });
      }
      continue;
    }
    removedRows++;
    report.removed.push({
      label,
      photos: photoCount(prior.unit),
      pinned: hasPin(prior.unit),
      bound: isBound(options.siteModel, websiteBuildings[prior.b], label),
    });
  }

  // 3D bindings follow relabelled and moved rows.
  const site = rekeySiteBindings(options.siteModel, rekeys, websiteBuildings);
  const rebound = [...site.rebound];
  for (const [b, building] of buildings.entries()) {
    if (!reports.has(b)) continue;
    const renames = new Map(
      rekeys.filter((k) => k.fromBuilding === b && k.toBuilding === b).map((k) => [norm(k.fromLabel), k.toLabel]),
    );
    const own = rekeyModelBindings(building, renames);
    if (own.rebound.length) {
      buildings[b] = { ...building, model: own.model };
      rebound.push(...own.rebound);
    }
  }

  // Tracker buildings with no website building are never created — a building
  // needs its plan artwork first — but their units are still the project's,
  // so the totals count them rather than shrinking.
  const unmatchedTrackerBuildings: UnmatchedTrackerBuilding[] = unmatched.map((tracker) => {
    const rows = toRows(tracker.units);
    const units = tracker.units.length;
    const available = tracker.units.filter((u) => websiteStatusOf(u.status) === 'available').length;
    totalUnits += units;
    totalAvailable += available;
    return { id: tracker.id, name: tracker.name, units, available, rows: rows.map((r) => r.label) };
  });

  // The headline keeps its formula — see TrackerCounts.
  const totals: Totals = {
    buildings: totalUnits,
    sold: totalUnits - totalAvailable,
    available: totalAvailable,
  };
  const trackerCounts = countStatuses(snapshot);

  const nextFloorPlans = Array.isArray(floorPlans?.buildings) ? { ...floorPlans, buildings } : floorPlans;
  const changed =
    canonical(nextFloorPlans) !== canonical(floorPlans) ||
    rebound.length > 0 ||
    canonical(trackerCounts) !== canonical(options.trackerCounts) ||
    totals.buildings !== totalsBefore.buildings ||
    totals.sold !== totalsBefore.sold ||
    totals.available !== totalsBefore.available;

  const refusals: string[] = [];
  const unmatchedWithUnits = unmatchedTrackerBuildings.filter((t) => t.units > 0);
  if (unmatchedWithUnits.length) {
    // A building with no units can lose nothing, so it is reported but does
    // not hold up the rest.
    const list = unmatchedWithUnits.map((t) => `${t.name} (${t.units} units)`).join(', ');
    refusals.push(
      websiteBuildings.length === 0
        ? `the property has no floor-plan buildings on the website, so ${list} would replace its totals`
        : `tracker buildings with no website building: ${list}`,
    );
  }
  for (const [b, report] of reports) {
    const existing = (websiteBuildings[b].unitList ?? []).length;
    if (tooMany(report.removed.length, existing)) {
      refusals.push(`would remove ${report.removed.length} of ${existing} unit rows in ${report.building}`);
    }
    if (report.removed.length && !(buildings[b].unitList ?? []).length) {
      refusals.push(`would empty ${report.building}`);
    }
    const kept = report.removed.filter((r) => r.photos > 0 || r.pinned);
    if (kept.length) {
      const what = (r: RemovedRow) => [r.photos ? `${r.photos} photos` : '', r.pinned ? 'pin' : ''].filter(Boolean).join(', ');
      const list = kept.map((r) => `${r.label} (${what(r)})`).join(', ');
      refusals.push(`would remove rows with photos or a pin in ${report.building}: ${list}`);
    }
  }
  if (tooMany(removedRows, existingRows)) {
    refusals.push(`would remove ${removedRows} of ${existingRows} unit rows`);
  }
  const refused = refusals.length && !options.force ? `${refusals.join('; ')}; resend with force to apply` : null;

  const buildingReports = [...reports.values()];
  const sum = (pick: (r: BuildingReport) => unknown[]) => buildingReports.reduce((n, r) => n + pick(r).length, 0);

  return {
    floorPlans: nextFloorPlans as Record<string, any>,
    siteModel: site.siteModel,
    trackerCounts,
    totals,
    report: {
      version: snapshot.version,
      changed,
      buildings: buildingReports,
      untouched,
      staleLinks,
      unmatchedTrackerBuildings,
      rebound,
      trackerCounts,
      totals: { before: totalsBefore, after: totals },
      removedRows,
      existingRows,
      counts: {
        added: sum((r) => r.added),
        removed: removedRows,
        absorbed: sum((r) => r.absorbed),
        moved: sum((r) => r.movedIn),
        relabelled: sum((r) => r.relabelled),
        statusChanged: sum((r) => r.statusChanged),
        rebound: rebound.length,
        unknownStatuses: sum((r) => r.unknownStatus),
        unmatchedTrackerBuildings: unmatchedTrackerBuildings.length,
        unmatchedUnits: unmatchedTrackerBuildings.reduce((n, t) => n + t.units, 0),
        staleLinks: staleLinks.length,
        untouched: untouched.length,
      },
      refusals,
      refused,
    },
  };
}
