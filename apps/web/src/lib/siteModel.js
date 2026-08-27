// The whole-property counterpart to units.js.
//
// A per-building model (units.js) only ever has one kind of addressable
// shape — a unit — bound by a `unit-<label>` naming convention or a manual
// override. A whole-site model has three: a building, a unit *within* a
// tagged building, and a road. None of the client's whole-site exports carry
// usable names at all (every mesh is `empty_2`, `empty_3`, … — see the
// SITE LAYOUT.glb inspection in the site-model PRD), so unlike units.js,
// binding here is admin tap-to-tag first and a naming convention second —
// the convention exists mainly so a hand-authored test fixture doesn't need
// a bindings map to be useful.
import { findUnitByLabel, getUnits } from './units'

export const ROAD_MESH_PREFIX = 'road-'
export const BUILDING_MESH_PREFIX = 'building-'

const norm = (value) => String(value ?? '').trim().toLowerCase()

export const getSiteModel = (property) => property?.detail?.siteModel ?? null
export const hasSiteModel = (property) => Boolean(property?.detail?.siteModel?.url)

/** The road name a mesh claims by naming convention, or null. Mirrors
 *  meshUnitLabel() in units.js. */
export function meshRoadName(meshName) {
  const name = String(meshName ?? '').trim()
  if (!name.toLowerCase().startsWith(ROAD_MESH_PREFIX)) return null
  return name.slice(ROAD_MESH_PREFIX.length).trim()
}

/** The building label a mesh claims by naming convention, or null. */
export function meshBuildingName(meshName) {
  const name = String(meshName ?? '').trim()
  if (!name.toLowerCase().startsWith(BUILDING_MESH_PREFIX)) return null
  return name.slice(BUILDING_MESH_PREFIX.length).trim()
}

export const findBuildingByLabel = (buildings, label) => {
  const target = norm(label)
  if (!target) return null
  return (buildings ?? []).find((b) => norm(b.building) === target) ?? null
}

/** The shape of a new road, in one place — same reason makeUnit() exists. */
export const makeRoad = (name = '') => ({ name, trafficNote: '' })

/**
 * A unit's effective facing road: its own facingRoad if set, otherwise its
 * building's. Every caller (detail card, public filter, admin summary)
 * should read this rather than `unit.facingRoad` directly, so "inherit
 * unless overridden" stays a single rule instead of being re-implemented
 * wherever facing is shown.
 */
export function resolveFacingRoad(building, unit) {
  const own = String(unit?.facingRoad ?? '').trim()
  if (own) return own
  return String(building?.facingRoad ?? '').trim() || null
}

/**
 * Resolve every mesh in the whole-site model against the property's
 * buildings/units and the site model's own road list.
 *
 * Generalizes reconcile() from units.js to three addressable kinds instead
 * of one. Explicit bindings (buildingBindings/unitBindings/roadBindings,
 * keyed by mesh name) are checked first; a naming convention is the
 * fallback, which only ever matters for hand-authored fixtures since real
 * client exports have no usable mesh names at all.
 *
 * Used identically by the public site viewer and the admin tagging screen —
 * same reason units.js's reconcile() is shared, see that file's comment.
 */
export function reconcileSite(meshNames, buildings, siteModel) {
  const buildingBindings = siteModel?.buildingBindings ?? {}
  const unitBindings = siteModel?.unitBindings ?? {}
  const roadBindings = siteModel?.roadBindings ?? {}
  const roads = siteModel?.roads ?? []

  const resolved = []
  const unbound = []
  const staleBindings = []
  const claimedBuildings = new Set()
  const claimedUnits = new Set() // `${buildingLabel}::${unitLabel}`, normalized
  const claimedRoads = new Set()

  for (const meshName of meshNames) {
    const unitBind = unitBindings[meshName]
    const roadBind = roadBindings[meshName]
    const buildingBind = buildingBindings[meshName]

    if (unitBind) {
      const building = findBuildingByLabel(buildings, unitBind.buildingLabel)
      const unit = building ? findUnitByLabel(getUnits(building), unitBind.unitLabel) : null
      if (building && unit) {
        resolved.push({ meshName, kind: 'unit', building, unit })
        claimedUnits.add(`${norm(building.building)}::${norm(unit.label)}`)
      } else {
        // Bound to a building/unit pair that has since been renamed or
        // deleted. Same call as reconcile()'s stale-binding handling: this
        // is pruned on next upload, not surfaced as a shape needing a fix
        // the admin never asked for.
        staleBindings.push(meshName)
      }
      continue
    }

    if (roadBind) {
      const road = roads.find((r) => norm(r.name) === norm(roadBind))
      if (road) {
        resolved.push({ meshName, kind: 'road', road })
        claimedRoads.add(norm(road.name))
      } else {
        staleBindings.push(meshName)
      }
      continue
    }

    if (buildingBind) {
      const building = findBuildingByLabel(buildings, buildingBind)
      if (building) {
        resolved.push({ meshName, kind: 'building', building })
        claimedBuildings.add(norm(building.building))
      } else {
        staleBindings.push(meshName)
      }
      continue
    }

    // No explicit binding — try the naming conventions before giving up.
    const conventionRoad = meshRoadName(meshName)
    if (conventionRoad !== null) {
      const road = roads.find((r) => norm(r.name) === norm(conventionRoad))
      if (road) {
        resolved.push({ meshName, kind: 'road', road })
        claimedRoads.add(norm(road.name))
        continue
      }
    }
    const conventionBuilding = meshBuildingName(meshName)
    if (conventionBuilding !== null) {
      const building = findBuildingByLabel(buildings, conventionBuilding)
      if (building) {
        resolved.push({ meshName, kind: 'building', building })
        claimedBuildings.add(norm(building.building))
        continue
      }
    }

    // Genuinely untagged — a candidate the admin can still bind, distinct
    // from inert scenery in intent, but rendered the same until tagged.
    unbound.push(meshName)
  }

  const unmodelledBuildings = (buildings ?? []).filter((b) => !claimedBuildings.has(norm(b.building)))
  const unmodelledUnits = (buildings ?? []).flatMap((building) =>
    getUnits(building)
      .filter((unit) => !claimedUnits.has(`${norm(building.building)}::${norm(unit.label)}`))
      .map((unit) => ({ building, unit }))
  )
  const unmodelledRoads = roads.filter((r) => !claimedRoads.has(norm(r.name)))

  return { resolved, unbound, staleBindings, unmodelledBuildings, unmodelledUnits, unmodelledRoads }
}

/** Mesh name -> resolved entry, for the viewer's raycast lookup. Mirrors
 *  unitsByMeshName() in units.js. */
export function siteMeshMap(meshNames, buildings, siteModel) {
  const map = new Map()
  for (const entry of reconcileSite(meshNames, buildings, siteModel).resolved) {
    map.set(entry.meshName, entry)
  }
  return map
}

/**
 * Binds a set of meshes to one target (a unit within a building, a road, or
 * a building itself), clearing any prior binding of a different kind first —
 * a mesh is exactly one of building/unit/road/unbound at a time, never two,
 * so re-tagging a shape has to release its old role before taking a new one.
 * `target: null` unbinds.
 */
export function bindSiteMeshes(siteModel, meshNames, target) {
  const next = {
    ...siteModel,
    buildingBindings: { ...(siteModel?.buildingBindings ?? {}) },
    unitBindings: { ...(siteModel?.unitBindings ?? {}) },
    roadBindings: { ...(siteModel?.roadBindings ?? {}) },
  }
  for (const meshName of meshNames) {
    delete next.buildingBindings[meshName]
    delete next.unitBindings[meshName]
    delete next.roadBindings[meshName]
    if (target?.kind === 'unit') {
      next.unitBindings[meshName] = { buildingLabel: target.buildingLabel, unitLabel: target.unitLabel }
    } else if (target?.kind === 'road') {
      next.roadBindings[meshName] = target.roadName
    } else if (target?.kind === 'building') {
      next.buildingBindings[meshName] = target.buildingLabel
    }
  }
  return next
}

/** Drops bindings whose mesh no longer exists after a re-upload — mirrors
 *  pruneBindings() in units.js, generalized to all three binding maps. */
export function pruneSiteBindings(siteModel, meshNames = []) {
  const present = new Set(meshNames.map(norm))
  const keep = (bindings) => Object.fromEntries(Object.entries(bindings ?? {}).filter(([mesh]) => present.has(norm(mesh))))
  return {
    ...siteModel,
    buildingBindings: keep(siteModel?.buildingBindings),
    unitBindings: keep(siteModel?.unitBindings),
    roadBindings: keep(siteModel?.roadBindings),
  }
}

/** Compare a freshly parsed model against the one it would replace — same
 *  intent as diffModels() in units.js, but keyed on which meshes are
 *  actually bound to something (any kind), since these files have no naming
 *  convention to diff by. */
export function diffSiteModel(previousSiteModel, nextMeshNames = []) {
  const boundBefore = new Set([
    ...Object.keys(previousSiteModel?.buildingBindings ?? {}),
    ...Object.keys(previousSiteModel?.unitBindings ?? {}),
    ...Object.keys(previousSiteModel?.roadBindings ?? {}),
  ])
  const after = new Set(nextMeshNames)
  return {
    retained: [...boundBefore].filter((n) => after.has(n)),
    removed: [...boundBefore].filter((n) => !after.has(n)),
  }
}

/**
 * Flattens reconcileSite()'s result into the shape ModelViewer.jsx already
 * knows how to drive — `{ meshName, kind, index, label, status? }` — so the
 * viewer's existing per-index machinery (camera framing, labels, hover,
 * selection) works for buildings and roads exactly as it already does for
 * units, with zero changes to that machinery itself.
 *
 * `index` is unique per *identity*, not per mesh: several meshes bound to the
 * same unit (a block of wall panels) share one index, the same way
 * unitsByMeshName() in units.js already does for per-building models.
 */
export function toViewerEntries(reconcileResult) {
  const indexFor = new Map() // `${kind}:${identity}` -> index
  let next = 0
  const indexOf = (key) => {
    if (!indexFor.has(key)) indexFor.set(key, next++)
    return indexFor.get(key)
  }

  return reconcileResult.resolved.map(({ meshName, kind, building, unit, road }) => {
    if (kind === 'unit') {
      const index = indexOf(`unit:${norm(building.building)}::${norm(unit.label)}`)
      return { meshName, kind, index, label: unit.label, status: unit.status, unit, building }
    }
    if (kind === 'road') {
      const index = indexOf(`road:${norm(road.name)}`)
      return { meshName, kind, index, label: road.name, road }
    }
    // kind === 'building'
    const index = indexOf(`building:${norm(building.building)}`)
    return { meshName, kind, index, label: building.building, building }
  })
}
