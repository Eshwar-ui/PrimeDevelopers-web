// What a unit or building still needs before its public card reads as finished.
// Pure, so the chip row, the summary strip and the tests all agree.
import { isTrackerUnit, siteLinkedUnits, unitPlacement } from './unitChecks.js'
import { TENANTED } from '../lib/unitStatus.js'

const blank = (value) => !String(value ?? '').trim()

// The words an editor uses for the three states a unit can be in.
// Stored values stay available / leased / sold (and coming-soon).
export const STATUS_WORDS = {
  available: { short: 'Unsold', long: 'Unsold · available' },
  leased: { short: 'In lease', long: 'In lease' },
  sold: { short: 'Sold', long: 'Sold' },
  'coming-soon': { short: 'Coming soon', long: 'Coming soon' },
}

/** Field names a unit is still missing. Tracker-owned fields are skipped — the editor can't fill them. */
export function unitMissing(unit) {
  const synced = isTrackerUnit(unit)
  const missing = []
  if (!synced && blank(unit?.label)) missing.push('Label')
  if (!synced && blank(unit?.size)) missing.push('Size')
  if (blank(unit?.floor)) missing.push('Floor / level')
  if (blank(unit?.rate)) missing.push('Lease rate / price')
  if (TENANTED.has(unit?.status) && blank(unit?.tenant)) missing.push('Tenant')
  if (!(unit?.images ?? []).some((url) => !blank(url))) missing.push('Photograph')
  if (blank(unit?.description)) missing.push('Description')
  return missing
}

/** Field names a building is still missing. */
export function buildingMissing(building) {
  const missing = []
  if (blank(building?.building)) missing.push('Building name')
  if (blank(building?.area)) missing.push('Area')
  if (blank(building?.number)) missing.push('Number')
  if ((building?.unitList ?? []).length === 0) missing.push('Units')
  return missing
}

/** Whether a unit is linked into a 3D model, with the same rule the unit form uses. */
export function unitHas3D(building, unit, siteModel) {
  const siteLinked = siteLinkedUnits(siteModel)
  const placement = unitPlacement({ siteLinked, building, unit })
  return placement.kind !== 'pin' && placement.linked
}

/** A building has 3D when it has its own model, or any of its units is tagged in the site model. */
export function buildingHas3D(building, siteModel) {
  if (building?.model?.url) return true
  if (!siteModel?.url) return false
  const label = String(building?.building ?? '').trim().toLowerCase()
  if (!label) return false
  const bound = Object.values(siteModel.buildingBindings ?? {}).some(
    (value) => String(value ?? '').trim().toLowerCase() === label,
  )
  return bound || (building?.unitList ?? []).some((unit) => unitHas3D(building, unit, siteModel))
}

/** Roll-up for the strip above the chips. */
export function summarise(buildings, siteModel) {
  let units = 0
  let complete = 0
  let in3D = 0
  const counts = { available: 0, leased: 0, sold: 0, 'coming-soon': 0 }
  for (const building of buildings ?? []) {
    for (const unit of building?.unitList ?? []) {
      units += 1
      if (unitMissing(unit).length === 0) complete += 1
      if (unitHas3D(building, unit, siteModel)) in3D += 1
      if (unit?.status in counts) counts[unit.status] += 1
    }
  }
  const buildingsIncomplete = (buildings ?? []).filter((b) => buildingMissing(b).length > 0).length
  return { units, complete, in3D, counts, pending: units - complete, buildingsIncomplete }
}
