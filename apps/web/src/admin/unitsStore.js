import { useCallback } from 'react'
import { useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { applyUnitChange, getBuildings, labelSlug } from '../lib/units'

/** The admin URL of one unit's editor. */
export const unitEditPath = (property, buildingLabel, unitLabel) =>
  `/admin/units/${property.id}/${labelSlug(buildingLabel)}/${labelSlug(unitLabel)}`

const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

/**
 * Change one unit and write it back — against a fresh copy of the property.
 *
 * Units live inside the property's `detail` JSON, and the API replaces
 * `detail` whole. Writing back the copy the Units page loaded would undo
 * anything saved to that property since — a building renamed in the property
 * editor, a unit edited in another tab. So each save re-reads the property,
 * finds the building and unit by label (falling back to position only when
 * the label is gone), applies this one change, and sends `detail` alone —
 * with the `updatedAt` of the copy it read, so a save that lands between the
 * read and the write is caught by the API (409) and this change re-applied on
 * top of it, rather than written over it.
 *
 * `change` is one of:
 *   { type: 'update', unit }      replace the matched unit
 *   { type: 'remove' }            delete it
 *   { type: 'add', unit }         append to the building
 * Resolves to the updated property.
 */
export function useSaveUnit() {
  const refetch = useContentRefetch()
  return useCallback(
    (args) =>
      withFreshRetry(async () => {
        const saved = await writeUnit(args)
        await refetch()
        return saved
      }),
    [refetch],
  )
}

/**
 * Runs a read-modify-write once more if the write lost a race.
 *
 * Each write below sends the `updatedAt` of the copy it just read, and the API
 * answers 409 if another save landed in between. These writes re-read and
 * re-apply their one change, so trying again is always safe — and twice is
 * enough: a third collision inside a second means something is looping.
 */
export async function withFreshRetry(work) {
  try {
    return await work()
  } catch (err) {
    if (err?.status !== 409) throw err
    return work()
  }
}

async function writeUnit({ propertySlug, buildingLabel, buildingIndex, unitLabel, unitIndex, change }) {
  const fresh = await api.get(`/admin/properties/${encodeURIComponent(propertySlug)}`)
  const buildings = [...getBuildings(fresh)]
  let bi = buildings.findIndex((b) => same(b.building, buildingLabel))
  if (bi < 0 && buildingIndex != null && buildings[buildingIndex]) bi = buildingIndex
  if (bi < 0) throw new Error(`“${buildingLabel}” is no longer on this property — it may have been renamed or removed.`)

  const building = buildings[bi]
  const units = building.unitList ?? []
  if (change.type === 'add') {
    if (units.some((u) => same(u.label, change.unit.label))) {
      throw new Error(`${building.building} already has a unit labelled “${change.unit.label}”.`)
    }
    buildings[bi] = { ...building, unitList: [...units, change.unit] }
  } else {
    let ui = units.findIndex((u) => same(u.label, unitLabel))
    if (ui < 0 && unitIndex != null && units[unitIndex] && !unitLabel) ui = unitIndex
    if (ui < 0) throw new Error(`Unit “${unitLabel}” is no longer in ${building.building} — it may have been renamed or removed.`)
    if (change.type === 'remove') {
      buildings[bi] = { ...building, unitList: units.filter((_, i) => i !== ui) }
    } else {
      const clash = units.some((u, i) => i !== ui && same(u.label, change.unit.label))
      if (clash) throw new Error(`${building.building} already has a unit labelled “${change.unit.label}”.`)
      buildings[bi] = applyUnitChange(building, ui, change.unit)
    }
  }

  const detail = { ...fresh.detail, floorPlans: { ...(fresh.detail?.floorPlans ?? {}), buildings } }
  return api.patch(`/admin/properties/${fresh.id}`, { detail, expectedUpdatedAt: fresh.updatedAt })
}
