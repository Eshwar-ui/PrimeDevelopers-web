// Rules about units that the admin's editors share — who owns a field, which
// labels can be saved, and where a unit sits on the plan or in 3D. Kept out of
// the component files so Fast Refresh can keep hot-swapping those.
import { getUnits, reconcile, unitLabelParts } from '../lib/units'

/** The hint under every field, and on every control, the tracker sync owns. */
export const TRACKER_MANAGED = 'Managed by Prime Tracker'

/** A unit the Prime Tracker sync has claimed (docs/tracker-sync-and-aws-plan.md). */
export const isTrackerUnit = (unit) => (unit?.trackerUnitIds ?? []).length > 0

const norm = (value) => String(value ?? '').trim().toLowerCase()

/**
 * What is wrong with the unit labels across a property's buildings.
 *
 * `errors` block the save:
 * - an empty label — the unit has no address (`/units/<building>/<label>`), so
 *   it can't be opened, linked in 3D or enquired about;
 * - two units with one label in the same building — only the first can ever
 *   be linked to a shape, and the second disappears from 3D unexplained.
 *
 * `warnings` don't: two different labels that share a unit number — `201`
 * beside `201+202+203+204` — usually mean a combined suite and one of its
 * parts are both listed, so the same space shows twice. Occasionally it is
 * deliberate, which is why it only warns.
 *
 * Each entry carries its building's index, so BuildingBlock can show its own.
 */
export function unitLabelProblems(buildings) {
  const errors = []
  const warnings = []
  ;(buildings ?? []).forEach((building, buildingIndex) => {
    const name = String(building?.building ?? '').trim() || `Building ${buildingIndex + 1}`
    const units = building?.unitList ?? []

    const seen = new Set()
    const reported = new Set()
    units.forEach((unit, unitIndex) => {
      const key = norm(unit?.label)
      if (!key) {
        errors.push({ buildingIndex, text: `${name}: unit ${unitIndex + 1} has no label.` })
      } else if (seen.has(key) && !reported.has(key)) {
        reported.add(key)
        errors.push({ buildingIndex, text: `${name}: more than one unit is labelled “${String(unit.label).trim()}”.` })
      }
      seen.add(key)
    })

    const parts = units.map((unit) => new Set(unitLabelParts(unit?.label).map(norm)))
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = norm(units[i]?.label)
        const b = norm(units[j]?.label)
        if (!a || !b || a === b) continue
        const shared = [...parts[i]].filter((part) => parts[j].has(part))
        if (shared.length) {
          warnings.push({
            buildingIndex,
            text: `${name}: “${String(units[i].label).trim()}” and “${String(units[j].label).trim()}” both include ${shared.join(', ')} — is the same space listed twice?`,
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
