// Mirror Centro Plaza's unit inventory from Prime Tracker onto the website CMS.
//
// Prime Tracker (the internal construction/sales platform) is the client's
// source of truth for who has bought or leased what. The website's own
// `detail.floorPlans.buildings[].unitList` had drifted from it in both
// directions, and the client asked for the site to match the tracker
// unit-for-unit. That is a destructive sync by design: rows the tracker has no
// record of are dropped, not kept.
//
// What this deliberately does NOT touch:
//
//   • Building entries themselves. A building keeps its floor-plan image, its
//     3D model and its numbering even when the tracker leaves it with no units
//     — Building 3 and Building 10 end up present but empty rather than gone,
//     so the plan artwork survives and the units can be restored by hand.
//   • siteModel.unitBindings. 57 meshes are tagged with a building/unit pair,
//     and some point at units this sync removes. reconcileSite() already treats
//     a binding whose unit no longer resolves as stale — it is ignored at
//     render and pruned on the next model upload, never thrown. Leaving the
//     bindings in place means restoring a unit re-links its shape for free;
//     pruning them here would throw away tagging work to no benefit.
//   • Any field the tracker has no opinion on. Existing units are merged, not
//     replaced: photographs, pins, logos, descriptions and rates all survive,
//     which is what keeps unit 908's four storefront photographs attached.
//
//   node --env-file=.env.seed scripts/sync-centro-from-tracker.mjs
//   node --env-file=.env.seed scripts/sync-centro-from-tracker.mjs --commit
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const COMMIT = process.argv.includes('--commit')
const SLUG = 'centro-plaza'

/**
 * Centro Plaza as Prime Tracker holds it, read from the project's Units tab on
 * 16 Sep 2026. `units` is the client's own numbering: a row covering several
 * unit numbers is one row here and one row in the CMS, joined with '+' the way
 * unitLabelParts() expects, but counts as several units in the headline totals
 * — which is how the tracker's own "47/54" is arrived at.
 *
 * Verbatim, including the parts that do not reconcile: Building 2 carries 201,
 * 202, 203 and 204 as their own lettings *and* a separate sold suite named
 * "201+202+203+204". Both are real records there, so both are mirrored; the
 * overlapping numbering is flagged in the run output rather than resolved here,
 * because deciding which one a visitor should see is the client's call.
 */
const TRACKER = {
  'Building 1': [
    { units: ['101', '102', '103', '106'], status: 'sold', tenant: 'Centro Plaza Fund LLC' },
    { units: ['104', '105'], status: 'leased', tenant: 'Sangam Chettinad Restaurant' },
  ],
  'Building 2': [
    { units: ['201'], status: 'available' },
    // One record, not four. The tracker renders a genuine grouping with a
    // "n units sold together" sub-label (see 203, 204 below); this row has
    // none — it is a single combined suite whose name simply contains plus
    // signs, and counting it as four is what put the total at 57 not 54.
    { units: ['201+202+203+204'], status: 'sold', size: '5,784', tenant: 'Centro Plaza Bldg2 LLC' },
    { units: ['202'], status: 'leased', tenant: 'Devi Liquors', rate: '$3,684' },
    { units: ['203', '204'], status: 'leased', size: '3,020', tenant: 'JB Sree Ventures' },
    { units: ['205'], status: 'sold', size: '1,441', tenant: 'Sai Reddy' },
    { units: ['206'], status: 'sold', size: '1,291', tenant: 'Swarajya Lakshmi' },
  ],
  'Building 3': [],
  'Building 4': [
    { units: ['401'], status: 'sold', size: '1,296', tenant: 'Ramaseshu Ravepati' },
    { units: ['402', '404'], status: 'sold', tenant: 'Prodigy AT Centre/Srinivas Patlolla' },
    { units: ['403'], status: 'sold', size: '1,511', tenant: 'Venkata Vidya Sagar' },
    { units: ['405'], status: 'sold', size: '1,441', tenant: 'Jaimin Patel' },
    { units: ['406'], status: 'sold', size: '1,291', tenant: 'AARS LLC/Sivakumar' },
  ],
  'Building 6': [
    { units: ['605'], status: 'leased', size: '1,057', tenant: 'JRays Corner', rate: '$2,554' },
    { units: ['606', '608'], status: 'leased', tenant: 'Sri Vanguard Imports America II' },
  ],
  'Building 7': [
    { units: ['701'], status: 'available', size: '1,573' },
    { units: ['702'], status: 'available', size: '1,804' },
    { units: ['703'], status: 'available' },
    { units: ['704'], status: 'available' },
    { units: ['705'], status: 'available' },
    { units: ['706'], status: 'available' },
  ],
  'Building 8': [
    { units: ['801'], status: 'sold', size: '3,104', tenant: 'AUSTINIVS LLC' },
    { units: ['802'], status: 'sold', size: '3,104', tenant: 'OMNIVESTING CAPITAL LLC' },
    { units: ['803'], status: 'sold', size: '1,061', tenant: 'Ganapatthi LLC' },
    { units: ['804'], status: 'sold', size: '1,061', tenant: 'Durga Prasad Patsa' },
    { units: ['805'], status: 'sold', size: '1,057', tenant: 'TPD Texas LLC' },
    { units: ['806'], status: 'sold', size: '1,057', tenant: 'Shyam Bolishetty' },
    { units: ['807'], status: 'sold', size: '1,042', tenant: 'TPD Texas LLC' },
    { units: ['808'], status: 'sold', size: '1,042', tenant: 'Manoj Kumar Thota' },
    { units: ['809'], status: 'sold', size: '1,171', tenant: 'TPD Texas LLC' },
    { units: ['810'], status: 'sold', size: '1,171', tenant: 'Bhavana Krishna' },
    { units: ['811'], status: 'sold', size: '1,171', tenant: 'TPD Texas LLC' },
    { units: ['813'], status: 'sold', size: '1,042', tenant: 'TPD Texas LLC' },
    { units: ['815'], status: 'sold', size: '1,057', tenant: 'TPD Texas LLC' },
    { units: ['816'], status: 'sold', size: '1,057', tenant: 'Tripod Office LLC' },
    { units: ['817'], status: 'sold', size: '1,059', tenant: 'Raghavendra Yarlagadda' },
    { units: ['818'], status: 'sold', size: '1,059', tenant: 'Sridhar Dhuvanthula' },
    { units: ['819'], status: 'sold', size: '2,037', tenant: 'HNRR Properties, LLC' },
    { units: ['820'], status: 'sold', size: '1,967', tenant: 'HDNM Holdings LLC' },
  ],
  'Building 9': [
    { units: ['901'], status: 'sold', size: '2,095', tenant: 'TPD Texas LLC' },
    { units: ['902'], status: 'sold', size: '1,624', tenant: 'TPD Texas LLC' },
    { units: ['903'], status: 'sold', size: '1,118', tenant: 'Ziksa LLC' },
    { units: ['904'], status: 'sold', size: '1,452', tenant: 'TPD Texas LLC' },
    { units: ['905'], status: 'sold', size: '1,118', tenant: 'Chaitanya P Adapa' },
    { units: ['906'], status: 'sold', size: '955', tenant: 'Vijayalakshmi Vallepalli' },
    { units: ['907'], status: 'sold', size: '1,239', tenant: 'Venu Arety' },
    { units: ['908'], status: 'sold', size: '1,421', tenant: 'Hannah Dasari' },
  ],
  'Building 10': [],
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(url, key, { auth: { persistSession: false } })

/** Every field makeUnit() sets, so a new row renders as omitted, not blank. */
const blankUnit = (label) => ({
  label, status: 'available', tenant: '', size: '', floor: '', rate: '',
  frontage: '', description: '', x: null, y: null, logo: '', images: [],
  tenantUrl: '', tenantCategory: '', facingRoad: '',
})

const norm = (s) => String(s ?? '').trim().toLowerCase()

const { data: property, error: readErr } = await supabase
  .from('properties')
  .select('id, slug, buildings, sold, available, detail')
  .eq('slug', SLUG)
  .single()
if (readErr) throw readErr

const before = property.detail?.floorPlans?.buildings ?? []
const changes = []
let totalUnits = 0
let totalAvailable = 0

const after = before.map((building) => {
  const rows = TRACKER[building.building]
  if (!rows) {
    // A building the tracker does not list at all. Left exactly as it is
    // rather than emptied on an assumption.
    changes.push(`${building.building}: not in tracker — left untouched (${(building.unitList ?? []).length} rows)`)
    const units = (building.unitList ?? []).length
    totalUnits += Number(building.units) || units
    totalAvailable += Number(building.available) || 0
    return building
  }

  const existing = building.unitList ?? []
  const kept = []
  const added = []

  const unitList = rows.map((row) => {
    const label = row.units.join('+')
    const prior = existing.find((u) => norm(u.label) === norm(label))
    if (prior) kept.push(label)
    else added.push(label)
    return {
      ...(prior ?? blankUnit(label)),
      label,
      status: row.status,
      // Only overwrite where the tracker actually carries a value — its table
      // shows "—" for plenty of sizes, and blanking a size the site already
      // knows would be a loss, not a mirror.
      ...(row.size ? { size: row.size } : {}),
      ...(row.tenant ? { tenant: row.tenant } : {}),
      ...(row.rate ? { rate: row.rate } : {}),
    }
  })

  const removed = existing
    .filter((u) => !rows.some((r) => norm(r.units.join('+')) === norm(u.label)))
    .map((u) => u.label)

  // Headline counts are in individual units, not rows: a 4-unit combination
  // counts as 4. This is what makes the property total agree with the
  // tracker's own "47 of 54".
  const unitCount = rows.reduce((n, r) => n + r.units.length, 0)
  const availableCount = rows.filter((r) => r.status === 'available').reduce((n, r) => n + r.units.length, 0)
  totalUnits += unitCount
  totalAvailable += availableCount

  if (added.length) changes.push(`${building.building}: + ${added.join(', ')}`)
  if (removed.length) changes.push(`${building.building}: − ${removed.join(', ')}`)
  const photos = unitList.filter((u) => (u.images ?? []).filter(Boolean).length)
  if (photos.length) changes.push(`${building.building}: photographs kept on ${photos.map((u) => u.label).join(', ')}`)

  return { ...building, unitList, units: unitCount, available: availableCount }
})

console.log(`${SLUG}: ${before.length} buildings\n`)
for (const line of changes) console.log(`  ${line}`)

const totals = {
  buildings: totalUnits, // this column is the total UNIT count, not a building count
  sold: totalUnits - totalAvailable,
  available: totalAvailable,
}
console.log(
  `\ntotals: ${property.buildings}/${property.sold}/${property.available}` +
    ` → ${totals.buildings}/${totals.sold}/${totals.available}  (units/taken/available)`,
)

// Building 2 carries unit 201 in its own right *and* a sold suite named
// "201+202+203+204". Both are real records in the tracker, so both are
// mirrored, but the overlapping numbering is worth saying out loud.
const b2 = TRACKER['Building 2']
// Every number that appears as a letting in its own right, whether alone or
// inside a "203, 204"-style grouping.
const plain = new Set(b2.flatMap((r) => (r.units.length > 1 ? r.units : r.units[0].includes('+') ? [] : r.units)))
const overlap = b2
  .filter((r) => r.units.length === 1 && r.units[0].includes('+'))
  .flatMap((r) => r.units[0].split('+'))
  .filter((n) => plain.has(n))
if (overlap.length) {
  console.log(`\n⚠ Building 2: ${overlap.join(', ')} exist as their own rows and inside the sold suite "201+202+203+204" — mirrored as-is`)
}

if (!COMMIT) {
  console.log('\nDry run — nothing written. Re-run with --commit.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `centro-plaza-units-backup-${stamp}.json`
writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))
console.log(`\nbacked up previous state to ${backup}`)

const { error: writeErr } = await supabase
  .from('properties')
  .update({
    ...totals,
    detail: { ...property.detail, floorPlans: { ...property.detail.floorPlans, buildings: after } },
  })
  .eq('id', property.id)
if (writeErr) throw new Error(`CMS write failed: ${JSON.stringify(writeErr)}`)

console.log('CMS updated — Centro Plaza now mirrors Prime Tracker.')
