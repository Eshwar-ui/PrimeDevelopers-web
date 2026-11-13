/**
 * What GET /properties and GET /properties/:slug send a visitor.
 *
 * Those routes used to return the Prisma row as it stands, `detail` and all,
 * so whatever the CMS or the tracker sync wrote into the row was public the
 * moment it landed: a sold unit's buyer, what a leased unit went for, and
 * every Prime Tracker id. This is the read-side twin of
 * apps/web/src/admin/propertyPayload.js — a list of what may go out, not the
 * row minus the parts known to be private, so a field added to the row later
 * stays private until someone adds it here.
 *
 * The admin routes (/admin/properties) still return the whole row: the editor
 * saves `detail` back in one piece, and an editor working from this copy would
 * wipe every field it leaves out.
 */

import { labelParts } from '../tracker-sync/tracker-merge';

type Row = Record<string, any>;

const isObject = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pick = (source: Row, keys: readonly string[]) => {
  const out: Row = {};
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
};

/**
 * The columns the public site reads. Not `sortOrder`, `published` or the
 * timestamps (the list arrives sorted and every row is published), and never
 * `trackerProjectId` or `trackerSyncedAt`.
 */
export const PUBLIC_COLUMNS = [
  'id',
  'slug',
  'name',
  'address',
  'category',
  'buildings',
  'sold',
  'available',
  'image',
  'gallery',
  'detail',
] as const;

/**
 * The unit-row fields some public component reads — the unit card and page,
 * the unit list and comparison, the 2D pin plan, the 3D viewer, the rent roll.
 * `makeUnit()` in apps/web/src/lib/units.js names the CMS's side of them.
 * Left out: `trackerUnitIds`, the `tracker` sub-object (ids, occupant,
 * availableSince, what the tracker last said), `trackerSync` and
 * `trackerOverrides`, the two opt-in flags below, and `hidden`
 * (WITHHELD_UNIT_FIELDS). `floor` went when the unit page swapped it for
 * `clearHeight`; rows still carry it, unread.
 *
 * The price fields are filtered by status in toPublicUnit(), not here.
 */
export const PUBLIC_UNIT_FIELDS = [
  'label',
  'status',
  'tenant',
  'tenantUrl',
  'tenantCategory',
  'size',
  'clearHeight',
  'rate',
  'leasePrice',
  'salePrice',
  'soldPrice',
  'frontage',
  'description',
  'x',
  'y',
  'logo',
  'images',
  'facingRoad',
] as const;

/**
 * Unit-row fields that are decided on and never sent. `hidden` is the CMS's
 * "Show on website" switch, inverted: a hidden unit is dropped whole (see
 * toPublicBuilding), so there is nothing left for the flag to say.
 */
export const WITHHELD_UNIT_FIELDS = ['hidden'] as const;

/**
 * A unit an editor switched off. Only absent, null or false shows it: a value
 * the CMS never writes ("true", 1) hides the unit rather than publishing it.
 */
export const isHiddenUnit = (unit: unknown) => isObject(unit) && Boolean(unit.hidden);

/**
 * Who the occupant is, withheld together: the site never shows the link or
 * trade without the name.
 *
 * `description` is not among them and is always public. It is the editor's
 * copy, so keeping a buyer or a price out of it is the editor's job — the unit
 * form says so on a sold unit (apps/web/src/admin/components/UnitFields.jsx).
 */
const TENANT_FIELDS = ['tenant', 'tenantUrl', 'tenantCategory'] as const;

// By status, what is public without an opt-in. A missing status is one the
// site shows as available. Anything else — a status this file does not know —
// is treated as the most private, so a new status cannot publish a buyer.
//
// A sold unit's tenant is its owner, often a private person; a leased unit's
// is the business trading there. A rate is published only while it is still
// an offer: what a let or sold space went for is commercially sensitive.
const TENANT_PUBLIC = new Set(['', 'available', 'coming-soon', 'leased']);
const RATE_PUBLIC = new Set(['', 'available', 'coming-soon']);

/**
 * The structured prices, and the statuses each one means something in: a lease
 * price is what a space is offered at or let for, a sale price is an offer, a
 * sold price is what a sale closed at. A figure outside its statuses is stale
 * (a leased unit's old sale price) and never goes out, opt-in or not.
 *
 * Within those, only an offer is public without an opt-in. What a let or sold
 * space went for is commercially sensitive, so the unit's `publishRate` — the
 * same switch that publishes the legacy `rate` — has to be ticked. A status
 * this file does not know has no price at all.
 */
const OFFER = new Set(['', 'available', 'coming-soon']);
const PRICE_STATUSES = {
  leasePrice: new Set(['', 'available', 'coming-soon', 'leased']),
  salePrice: new Set(['', 'available', 'coming-soon']),
  soldPrice: new Set(['sold']),
} as const;

/**
 * The CMS's opt-ins, set per unit. `publishTenant` publishes a sold unit's
 * occupant (an owner-occupier's trading name, say); `publishRate` publishes
 * the rate and prices of a leased or sold unit. Only a literal `true` counts.
 */
export const OPT_IN = { tenant: 'publishTenant', rate: 'publishRate' } as const;

export function toPublicUnit(unit: unknown): Row {
  if (!isObject(unit)) return {};
  const out = pick(unit, PUBLIC_UNIT_FIELDS);
  const status = String(unit.status ?? '').trim();
  const optedIn = unit[OPT_IN.rate] === true;
  if (!TENANT_PUBLIC.has(status) && unit[OPT_IN.tenant] !== true) {
    for (const key of TENANT_FIELDS) delete out[key];
  }
  if (!RATE_PUBLIC.has(status) && !optedIn) delete out.rate;
  for (const [field, statuses] of Object.entries(PRICE_STATUSES)) {
    if (!statuses.has(status) || (!OFFER.has(status) && !optedIn)) delete out[field];
  }
  return out;
}

// Every field the tracker sync adds to a building or to `detail` is named
// `tracker…` (trackerBuildingId, tracker, trackerCounts), so this keeps the
// next one out too. Everything else at these two levels is content the CMS
// writes for the page — plan images, models and their bindings, copy.
const withoutTracker = (source: Row) => {
  const out: Row = {};
  for (const [key, value] of Object.entries(source)) if (!key.startsWith('tracker')) out[key] = value;
  return out;
};

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** A unit as the 3D bindings name it, matched the way reconcileSite() does: building and label, trimmed and lower-cased. */
const unitKey = (building: unknown, label: unknown) => `${norm(building)}::${norm(label)}`;

/** URL-safe form of a building or unit label — `labelSlug()` in apps/web/src/lib/units.js, which builds a unit page's address. */
export const labelSlug = (label: unknown) =>
  String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const unitRows = (detail: unknown): { building: unknown; unit: Row }[] => {
  const buildings = isObject(detail) && isObject(detail.floorPlans) ? detail.floorPlans.buildings : null;
  if (!Array.isArray(buildings)) return [];
  return buildings.filter(isObject).flatMap((building) =>
    (Array.isArray(building.unitList) ? building.unitList : []).filter(isObject).map((unit: Row) => ({ building: building.building, unit })),
  );
};

/**
 * What a property's hidden units are called, read off the stored rows before
 * any is dropped. A name a shown unit also holds is left out of both sets:
 * labels are typed by hand and not guaranteed unique, and blanking a shown
 * unit's shape or rate-sheet row to be safe about a hidden one is the worse
 * mistake of the two.
 */
interface HiddenUnits {
  /** `unitKey()`s — for the 3D bindings, which name a unit by building and label. */
  keys: Set<string>;
  /** Unit numbers ("603", "201" and "202" of "201+202") — for the rate sheet, which names them with no building. */
  numbers: Set<string>;
}

function hiddenUnitsOf(detail: unknown): HiddenUnits {
  const hidden: HiddenUnits = { keys: new Set(), numbers: new Set() };
  const shown: HiddenUnits = { keys: new Set(), numbers: new Set() };
  for (const { building, unit } of unitRows(detail)) {
    const side = isHiddenUnit(unit) ? hidden : shown;
    side.keys.add(unitKey(building, unit.label));
    for (const part of labelParts(unit.label)) side.numbers.add(norm(part));
  }
  for (const key of shown.keys) hidden.keys.delete(key);
  for (const number of shown.numbers) hidden.numbers.delete(number);
  return hidden;
}

/**
 * The unit pages that must not resolve, as `property-slug/building-slug/unit-slug`
 * (what `unitPath()` in apps/web/src/lib/units.js builds, lower-cased). For the
 * content endpoint, whose homepage cards and links name units by address.
 */
export function hiddenUnitPaths(properties: { slug: string; detail: unknown }[]): Set<string> {
  const hidden = new Set<string>();
  const shown = new Set<string>();
  for (const { slug, detail } of properties) {
    for (const { building, unit } of unitRows(detail)) {
      const unitSlug = labelSlug(unit.label);
      if (!unitSlug) continue;
      (isHiddenUnit(unit) ? hidden : shown).add(`${norm(slug)}/${labelSlug(building)}/${unitSlug}`);
    }
  }
  for (const path of shown) hidden.delete(path);
  return hidden;
}

function toPublicBuilding(building: unknown, hidden: HiddenUnits): unknown {
  if (!isObject(building)) return building;
  const out = withoutTracker(building);
  if ('unitList' in out) {
    // Dropped, not flagged: a unit that is switched off must not be in the
    // body at all — its tenant, photographs and rate included. Positions in
    // the list shift, which nothing public depends on (units are addressed by
    // label, and the viewers read the list they are given).
    out.unitList = Array.isArray(out.unitList) ? out.unitList.filter((unit) => !isHiddenUnit(unit)).map(toPublicUnit) : [];
  }
  // A shape bound to a hidden unit's label would otherwise carry that label
  // out. Blanked rather than removed: the viewer already treats a label no
  // unit holds as scenery, and an empty one resolves the same way.
  if (hidden.keys.size && isObject(out.model) && isObject(out.model.bindings)) {
    const bindings = Object.fromEntries(
      Object.entries(out.model.bindings).map(([mesh, label]) => [mesh, hidden.keys.has(unitKey(out.building, label)) ? '' : label]),
    );
    out.model = { ...out.model, bindings };
  }
  return out;
}

/**
 * The same for the whole-site model's unit tags. Its tracker id goes too: a
 * stale tag is read as "its building" (reconcileSite), which is the fallback
 * for a unit that is simply no longer in the list.
 */
function toPublicSiteModel(siteModel: unknown, hidden: HiddenUnits): unknown {
  if (!hidden.keys.size || !isObject(siteModel) || !isObject(siteModel.unitBindings)) return siteModel;
  const unitBindings = Object.fromEntries(
    Object.entries(siteModel.unitBindings).map(([mesh, bind]) => {
      if (!isObject(bind) || !hidden.keys.has(unitKey(bind.buildingLabel, bind.unitLabel))) return [mesh, bind];
      const { trackerUnitId: _trackerUnitId, ...rest } = bind;
      return [mesh, { ...rest, unitLabel: '' }];
    }),
  );
  return { ...siteModel, unitBindings };
}

/**
 * A rate-sheet row names its unit by hand ("603", "201, 202", "Unit 905"), so
 * it is read as the unit numbers in it, the way the tracker sync reads a label.
 */
const namesHiddenUnit = (row: unknown, hidden: HiddenUnits) =>
  isObject(row) &&
  String(row.unit ?? '')
    .split(/[,&/]/)
    .flatMap(labelParts)
    .some((number) => hidden.numbers.has(norm(number)));

/**
 * `detail.pricing.capRate` names a tenant on each row, and the page shows it
 * only while `showTenantNames` is on (PropertyPricingTables.jsx). Enforced
 * here as well, so a name waiting on the client's sign-off is not in the
 * response either.
 *
 * Both tables are unit listings too, so a row for a hidden unit is dropped.
 */
function toPublicPricing(pricing: unknown, hidden: HiddenUnits): unknown {
  if (!isObject(pricing)) return pricing;
  const out: Row = { ...pricing };
  for (const key of ['units', 'capRate'] as const) {
    const table = out[key];
    if (!isObject(table) || !Array.isArray(table.rows)) continue;
    let rows: unknown[] = hidden.numbers.size ? table.rows.filter((row) => !namesHiddenUnit(row, hidden)) : table.rows;
    if (key === 'capRate' && table.showTenantNames !== true) {
      rows = rows.map((row) => {
        if (!isObject(row)) return row;
        const { tenant: _tenant, ...rest } = row;
        return rest;
      });
    }
    out[key] = { ...table, rows };
  }
  return out;
}

export function toPublicDetail(detail: unknown): Row {
  if (!isObject(detail)) return {};
  const out = withoutTracker(detail);
  const hidden = hiddenUnitsOf(out);
  if (isObject(out.floorPlans) && Array.isArray(out.floorPlans.buildings)) {
    out.floorPlans = { ...out.floorPlans, buildings: out.floorPlans.buildings.map((building) => toPublicBuilding(building, hidden)) };
  }
  if ('pricing' in out) out.pricing = toPublicPricing(out.pricing, hidden);
  // `siteModel` goes out as it is, bar the tags of hidden units: the 3D viewer
  // needs every other binding in it, and it holds mesh names and labels,
  // nothing about who is in a unit.
  if ('siteModel' in out) out.siteModel = toPublicSiteModel(out.siteModel, hidden);
  return out;
}

export function toPublicProperty(property: Row): Row {
  const out = pick(property, PUBLIC_COLUMNS);
  out.detail = toPublicDetail(property.detail);
  return out;
}
