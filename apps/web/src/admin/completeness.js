// What a unit or building still needs before its public card reads as finished.
// Pure, so the chip row, the summary strip and the tests all agree.
import { isTrackerUnit, siteLinkedUnits, unitFed, unitPlacement } from './unitChecks.js'
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

// A price of any kind. A unit needs one to read as finished, but which one
// depends on its stage — a lease price while it is for lease, a sold price once
// sold — so any of the three (or the older free-text rate) will do.
const hasPrice = (unit) => [unit?.leasePrice, unit?.salePrice, unit?.soldPrice, unit?.rate].some((value) => !blank(value))

/**
 * Field names a unit is still missing. What the tracker will fill in on its
 * next sync is skipped — the editor would only be typing over it — and so is
 * the label of a tracker unit, which is the tracker's alone to change.
 */
export function unitMissing(unit) {
  const missing = []
  if (!isTrackerUnit(unit) && blank(unit?.label)) missing.push('Label')
  if (!unitFed(unit, 'size') && blank(unit?.size)) missing.push('Size')
  if (blank(unit?.clearHeight)) missing.push('Clear height')
  if (!hasPrice(unit) && !unitFed(unit, 'leasePrice') && !unitFed(unit, 'salePrice')) missing.push('Price')
  if (TENANTED.has(unit?.status) && !unitFed(unit, 'tenant') && blank(unit?.tenant)) missing.push('Tenant')
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
