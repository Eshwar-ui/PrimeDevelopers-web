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
 * Left out: `trackerUnitIds` and the `tracker` sub-object (ids, occupant,
 * availableSince), and the two opt-in flags below.
 */
export const PUBLIC_UNIT_FIELDS = [
  'label',
  'status',
  'tenant',
  'tenantUrl',
  'tenantCategory',
  'size',
  'floor',
  'rate',
  'frontage',
  'description',
  'x',
  'y',
  'logo',
  'images',
  'facingRoad',
] as const;

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
 * The CMS's opt-ins, set per unit. `publishTenant` publishes a sold unit's
 * occupant (an owner-occupier's trading name, say); `publishRate` publishes
 * the rate of a leased or sold unit. Only a literal `true` counts.
 */
export const OPT_IN = { tenant: 'publishTenant', rate: 'publishRate' } as const;

export function toPublicUnit(unit: unknown): Row {
  if (!isObject(unit)) return {};
  const out = pick(unit, PUBLIC_UNIT_FIELDS);
  const status = String(unit.status ?? '').trim();
  if (!TENANT_PUBLIC.has(status) && unit[OPT_IN.tenant] !== true) {
    for (const key of TENANT_FIELDS) delete out[key];
  }
  if (!RATE_PUBLIC.has(status) && unit[OPT_IN.rate] !== true) delete out.rate;
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

function toPublicBuilding(building: unknown): unknown {
  if (!isObject(building)) return building;
  const out = withoutTracker(building);
  if ('unitList' in out) out.unitList = Array.isArray(out.unitList) ? out.unitList.map(toPublicUnit) : [];
  return out;
}

/**
 * `detail.pricing.capRate` names a tenant on each row, and the page shows it
 * only while `showTenantNames` is on (PropertyPricingTables.jsx). Enforced
 * here as well, so a name waiting on the client's sign-off is not in the
 * response either.
 */
function toPublicPricing(pricing: unknown): unknown {
  if (!isObject(pricing) || !isObject(pricing.capRate) || pricing.capRate.showTenantNames === true) return pricing;
  const rows = pricing.capRate.rows;
  if (!Array.isArray(rows)) return pricing;
  return {
    ...pricing,
    capRate: {
      ...pricing.capRate,
      rows: rows.map((row) => {
        if (!isObject(row)) return row;
        const { tenant: _tenant, ...rest } = row;
        return rest;
      }),
    },
  };
}

export function toPublicDetail(detail: unknown): Row {
  if (!isObject(detail)) return {};
  const out = withoutTracker(detail);
  if (isObject(out.floorPlans) && Array.isArray(out.floorPlans.buildings)) {
    out.floorPlans = { ...out.floorPlans, buildings: out.floorPlans.buildings.map(toPublicBuilding) };
  }
  if ('pricing' in out) out.pricing = toPublicPricing(out.pricing);
  // `siteModel` goes out as it is: the 3D viewer needs every binding in it,
  // and it holds mesh names and labels, nothing about who is in a unit.
  return out;
}

export function toPublicProperty(property: Row): Row {
  const out = pick(property, PUBLIC_COLUMNS);
  out.detail = toPublicDetail(property.detail);
  return out;
}
