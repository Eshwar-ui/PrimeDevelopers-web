// Rules about units that the admin's editors share — who owns a field, which
// labels can be saved, and where a unit sits on the plan or in 3D. Kept out of
// the component files so Fast Refresh can keep hot-swapping those.
// With its extension, so the API's tests can import this file under plain Node.
import { getUnits, reconcile, unitLabelParts } from '../lib/units.js'

/** The hint under every field, and on every control, the tracker sync owns. */
export const TRACKER_MANAGED = 'Managed by Prime Tracker'

/** A unit the Prime Tracker sync has claimed (docs/tracker-sync-and-aws-plan.md). */
export const isTrackerUnit = (unit) => (unit?.trackerUnitIds ?? []).length > 0

/**
 * A building the sync has linked to a tracker building. Its unit list is the
 * tracker's: a unit added here is not in the snapshot, so the next sync either
 * removes it or, once it has photographs, refuses the whole push until someone
 * forces it. Units for these buildings are added in the tracker.
 */
export const isTrackerBuilding = (building) => Boolean(building?.trackerBuildingId)

/**
 * The unit fields Prime Tracker feeds, mirroring TRACKED_FIELDS in the API's
 * tracker-merge.ts. A fed field follows the tracker until the editor changes it
 * (it then becomes an override the sync leaves alone) or turns the tracker off
 * for the unit. The label is not among them: it is how a unit is matched to
 * its tracker units and its 3D shape, so a renumbering is made in the tracker.
 */
export const TRACKED_FIELDS = ['status', 'size', 'tenant', 'leasePrice', 'salePrice', 'soldPrice']

/** Fields compared as numbers, so "1,510" and "1510" are one size. */
const NUMERIC_FIELDS = new Set(['size', 'leasePrice', 'salePrice', 'soldPrice'])

/** Whether the tracker feeds this unit: it is linked, and the editor has not switched the tracker off for it. */
export const followsTracker = (unit) => isTrackerUnit(unit) && unit?.trackerSync !== false

/**
 * What the tracker last said for each fed field, in the website's own terms
 * (`row.tracker.values`, written by the sync), or null before the first sync
 * that records it. A field is absent where the tracker has no opinion.
 */
export const trackerValues = (unit) => {
  const values = isTrackerUnit(unit) ? unit.tracker?.values : null
  return values && typeof values === 'object' ? values : null
}

const toNumber = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return null
  const n = Number(text.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Two values of one fed field are the same: numbers by value, text trimmed. */
export function sameTrackedValue(field, a, b) {
  if (NUMERIC_FIELDS.has(field)) {
    const x = toNumber(a)
    const y = toNumber(b)
    if (x !== null && y !== null) return x === y
  }
  return String(a ?? '').trim() === String(b ?? '').trim()
}

/**
 * Whether the next sync will write this field of the unit: the tracker feeds
 * the unit, has a value for the field, and the editor has not overridden it.
 * Fields the tracker has no data for stay the website's, and an editor may fill
 * them without any of this applying.
 */
export function unitFed(unit, field) {
  if (!followsTracker(unit) || (unit.trackerOverrides ?? []).includes(field)) return false
  const values = trackerValues(unit)
  if (values) return field in values
  // Synced before the tracker's values were recorded: the next push fills them.
  return field === 'size' && unit.tracker?.sqft != null
}

/**
 * `unit` with `trackerOverrides` brought up to date after an edit: the fed
 * fields whose value differs from the tracker's. Run on every change in the
 * unit form, so the list is always a fact about the unit as it stands — change
 * a field back to the tracker's value and it follows the tracker again.
 *
 * `previous` is the unit before the edit. It matters only for a unit synced
 * before the tracker's values were recorded: there is nothing to compare to, so
 * each field the edit touched is taken as an override, and the next push keeps
 * it instead of overwriting it.
 *
 * Returns `unit` itself when nothing changes, and leaves a unit the editor
 * switched the tracker off for alone — the sync ignores its list.
 */
export function withTrackerOverrides(unit, previous = unit) {
  if (!followsTracker(unit)) return unit
  const values = trackerValues(unit)
  const stored = unit.trackerOverrides ?? []
  const overrides = values
    ? TRACKED_FIELDS.filter((field) => field in values && !sameTrackedValue(field, unit[field], values[field]))
    : [...new Set([...stored, ...TRACKED_FIELDS.filter((field) => !sameTrackedValue(field, unit[field], previous?.[field]))])]
  if (overrides.length === stored.length && overrides.every((field) => stored.includes(field))) return unit
  return { ...unit, trackerOverrides: overrides }
}

/** The unit with every fed field put back to the tracker's value and no overrides. A unit with no recorded values is returned as it is. */
export function replaceWithTracker(unit) {
  const values = trackerValues(unit)
  if (!values) return unit
  const { trackerOverrides: _dropped, ...rest } = unit
  const fed = Object.fromEntries(TRACKED_FIELDS.filter((field) => field in values).map((field) => [field, values[field]]))
  return { ...rest, ...fed }
}

/**
 * The unit with the tracker switched back on: every fed field takes the
 * tracker's value and the edits are dropped, so ticking the box means "use the
 * tracker's data for this unit" rather than "start following it from here".
 *
 * A unit with no recorded tracker values yet has nothing to take, so its
 * overrides are cleared instead and the next sync writes the tracker's data.
 */
export function turnTrackerOn(unit) {
  const { trackerOverrides: _dropped, ...rest } = replaceWithTracker({ ...unit, trackerSync: true })
  return rest
}

const norm = (value) => String(value ?? '').trim().toLowerCase()

// Which row a problem is about, stable across renames and reorders where it
// can be: a tracker row by its tracker ids, anything else by position.
const rowKey = (unit, buildingIndex, unitIndex) =>
  isTrackerUnit(unit) ? `t:${[...unit.trackerUnitIds].sort().join('+')}` : `b${buildingIndex}u${unitIndex}`

/** Every empty or shared label, each with whether the editor could fix it. */
function labelClashes(buildings) {
  const found = []
  ;(buildings ?? []).forEach((building, buildingIndex) => {
    const name = String(building?.building ?? '').trim() || `Building ${buildingIndex + 1}`
    const units = building?.unitList ?? []
    const byLabel = new Map()
    units.forEach((unit, unitIndex) => {
      const key = norm(unit?.label)
      if (!key) {
        found.push({
          buildingIndex,
          key: `empty|${rowKey(unit, buildingIndex, unitIndex)}`,
          fixable: !isTrackerUnit(unit),
          text: `${name}: unit ${unitIndex + 1} has no label.`,
        })
        return
      }
      if (!byLabel.has(key)) byLabel.set(key, [])
      byLabel.get(key).push({ unit, unitIndex })
    })
    for (const rows of byLabel.values()) {
      if (rows.length < 2) continue
      found.push({
        buildingIndex,
        key: `dup|${rows.map(({ unit, unitIndex }) => rowKey(unit, buildingIndex, unitIndex)).sort().join(',')}`,
        fixable: rows.some(({ unit }) => !isTrackerUnit(unit)),
        text: `${name}: more than one unit is labelled “${String(rows[0].unit.label).trim()}”.`,
      })
    }
  })
  return found
}

/**
 * What is wrong with the unit labels across a property's buildings.
 *
 * `errors` block the save, and are the problems the editor can fix:
 * - an empty label — the unit has no address (`/units/<building>/<label>`), so
 *   it can't be opened, linked in 3D or enquired about;
 * - two units with one label in the same building — only the first can ever
 *   be linked to a shape, and the second disappears from 3D unexplained.
 *
 * Not when every row involved belongs to Prime Tracker, though. The tracker
 * allows two units with one number, and the sync can write two tracker-owned
 * "101" rows, whose Label and Delete are locked here — blocking on those left
 * the property unsaveable for good. They are warnings that say to fix it in
 * the tracker. The exception is a problem that is new since the form loaded
 * (`baseline`, the buildings as loaded): this edit caused it, so this edit can
 * undo it.
 *
 * `warnings` never block. Besides those, two different labels that share a
 * unit number — `201` beside `201+202+203+204` — usually mean a combined
 * suite and one of its parts are both listed, so the same space shows twice.
 * Occasionally it is deliberate, which is why it only warns.
 *
 * Each entry carries its building's index, so BuildingBlock can show its own.
 */
export function unitLabelProblems(buildings, baseline) {
  const errors = []
  const warnings = []
  const before = baseline ? new Set(labelClashes(baseline).map((problem) => problem.key)) : null
  for (const problem of labelClashes(buildings)) {
    const isNew = before !== null && !before.has(problem.key)
    if (problem.fixable || isNew) errors.push({ buildingIndex: problem.buildingIndex, text: problem.text })
    else warnings.push({ buildingIndex: problem.buildingIndex, text: `${problem.text} ${TRACKER_MANAGED} — fix it there.` })
  }

  ;(buildings ?? []).forEach((building, buildingIndex) => {
    const name = String(building?.building ?? '').trim() || `Building ${buildingIndex + 1}`
    const units = building?.unitList ?? []
    const parts = units.map((unit) => new Set(unitLabelParts(unit?.label).map(norm)))
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = norm(units[i]?.label)
        const b = norm(units[j]?.label)
        if (!a || !b || a === b) continue
        const shared = [...parts[i]].filter((part) => parts[j].has(part))
        if (shared.length) {
          const inTracker =
            isTrackerUnit(units[i]) && isTrackerUnit(units[j]) ? ` Both are ${TRACKER_MANAGED} — fix it there.` : ''
          warnings.push({
            buildingIndex,
            text: `${name}: “${String(units[i].label).trim()}” and “${String(units[j].label).trim()}” both include ${shared.join(', ')} — is the same space listed twice?${inTracker}`,
          })
        }
      }
    }
  })
  return { errors, warnings }
}

const siteKey = (buildingLabel, unitLabel) => `${norm(buildingLabel)}::${norm(unitLabel)}`

/**
 * The units a whole-site model links to, as `building::unit` keys — or null
 * when the property has no site model.
 *
 * Read from `unitBindings` directly, the same pairs reconcileSite() in
 * lib/siteModel.js resolves, skipping any binding whose shape is no longer in
 * the uploaded file.
 */
export function siteLinkedUnits(siteModel) {
  if (!siteModel?.url) return null
  const meshes = Array.isArray(siteModel.meshNames) ? new Set(siteModel.meshNames) : null
  const linked = new Set()
  for (const [mesh, binding] of Object.entries(siteModel.unitBindings ?? {})) {
    if (meshes && !meshes.has(mesh)) continue
    if (binding?.buildingLabel && binding?.unitLabel) linked.add(siteKey(binding.buildingLabel, binding.unitLabel))
  }
  return linked
}

/**
 * Where one unit sits, as the editor should describe it:
 * - `site`: the property has a whole-site 3D model (detail.siteModel) — the
 *   unit is linked to a shape in it, or not placed;
 * - `model`: the building has its own 3D model — linked by name or binding;
 * - `pin`: neither — a pin on the 2D plan image, or not placed yet.
 *
 * `siteLinked` is siteLinkedUnits()'s result, passed in so a building with
 * fifty units works it out once.
 */
export function unitPlacement({ siteModel, siteLinked, building, unit }) {
  const linkedInSite = siteLinked ?? siteLinkedUnits(siteModel)
  if (linkedInSite) {
    const linked = linkedInSite.has(siteKey(building?.building, unit?.label))
    return { kind: 'site', linked, text: linked ? 'Linked in 3D model' : 'Not placed' }
  }
  const model = building?.model
  if (model?.url) {
    const report = reconcile(model.meshNames ?? [], getUnits(building), model.bindings ?? {})
    const linked = report.matched.some(({ unit: matched }) => norm(matched.label) === norm(unit?.label))
    return { kind: 'model', linked, text: linked ? 'Linked to 3D model' : 'No shape in model' }
  }
  const placed = unit?.x != null && unit?.y != null
  return {
    kind: 'pin',
    linked: placed,
    text: placed ? `Placed at ${Number(unit.x).toFixed(0)}%, ${Number(unit.y).toFixed(0)}%` : 'Not placed yet',
  }
}
