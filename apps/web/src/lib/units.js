// The single fan-out point for building/unit data.
//
// Every presentation tier — the 3D viewer, the 2D pin plan, the DOM unit list
// — reads units through here, so they cannot disagree about availability. It
// is also the only module that knows the shape of `properties.detail`, so the
// planned move to relational buildings/units tables is a change to this file
// and nothing else.

// The whole contract between a .glb and the app: a mesh named `unit-301` is
// the unit labelled "301". Anything else is scenery.
export const MESH_PREFIX = 'unit-'

// Enforced at upload. Over budget is rejected outright rather than warned
// about — a 40MB model does not degrade on a mid-range phone, it crashes it.
export const MODEL_MAX_BYTES = 8 * 1024 * 1024
export const MODEL_MAX_TRIANGLES = 150_000

const norm = (value) => String(value ?? '').trim().toLowerCase()

/** The unit label a mesh claims, or null if the mesh is scenery. */
export function meshUnitLabel(meshName) {
  const name = String(meshName ?? '').trim()
  if (!name.toLowerCase().startsWith(MESH_PREFIX)) return null
  return name.slice(MESH_PREFIX.length).trim()
}

export const getBuildings = (property) => property?.detail?.floorPlans?.buildings ?? []

/** Units carry their array index so callers can address them without labels,
 *  which are user-entered and not guaranteed unique. */
export const getUnits = (building) =>
  (building?.unitList ?? []).map((unit, index) => ({ ...unit, index }))

export const getModel = (building) => building?.model ?? null
export const hasModel = (building) => Boolean(building?.model?.url)

export const findUnitByLabel = (units, label) => {
  const target = norm(label)
  if (!target) return null
  return units.find((unit) => norm(unit.label) === target) ?? null
}

export const findUnitIndexByLabel = (units, label) => findUnitByLabel(units, label)?.index ?? null

/**
 * Resolve every mesh in a model against the unit list.
 *
 * Used identically by the public viewer and the admin reconciliation screen,
 * which is the point — what an admin is shown is exactly what a visitor gets.
 *
 * `bindings` maps mesh name -> unit label and holds manual overrides only.
 * Name matches are never persisted; storing them would create a second source
 * of truth that drifts the moment a label is edited.
 */
export function reconcile(meshNames, units, bindings = {}) {
  const overrides = new Map(Object.entries(bindings ?? {}).map(([mesh, label]) => [norm(mesh), label]))

  const matched = []
  const unmatched = []
  const claimed = new Set()

  for (const meshName of meshNames) {
    const claimedLabel = meshUnitLabel(meshName)
    if (claimedLabel === null) continue // scenery — never interactive

    const unit = findUnitByLabel(units, overrides.get(norm(meshName)) ?? claimedLabel)
    if (unit) {
      matched.push({ meshName, unit })
      claimed.add(unit.index)
    } else {
      unmatched.push(meshName)
    }
  }

  return {
    matched,
    unmatched,
    // Present in the CMS, absent from the model. Still fully functional in the
    // 2D plan and the unit list — it simply cannot be clicked in 3D.
    unmodelled: units.filter((unit) => !claimed.has(unit.index)),
  }
}

/** Mesh name -> unit, for the viewer's raycast lookup. */
export function unitsByMeshName(meshNames, units, bindings) {
  const map = new Map()
  for (const { meshName, unit } of reconcile(meshNames, units, bindings).matched) {
    map.set(meshName, unit)
  }
  return map
}

/** Compare a freshly parsed model against the one it would replace, so a
 *  re-upload can never silently break bindings the admin cannot see. */
export function diffModels(previousMeshNames = [], nextMeshNames = []) {
  const before = new Set(previousMeshNames.filter((n) => meshUnitLabel(n) !== null))
  const after = new Set(nextMeshNames.filter((n) => meshUnitLabel(n) !== null))
  return {
    retained: [...before].filter((n) => after.has(n)),
    removed: [...before].filter((n) => !after.has(n)),
    added: [...after].filter((n) => !before.has(n)),
  }
}

/** Drop bindings whose mesh no longer exists; keep every one that still
 *  resolves. Losing a binding should require the mesh to actually be gone. */
export function pruneBindings(bindings = {}, meshNames = []) {
  const present = new Set(meshNames.map(norm))
  return Object.fromEntries(Object.entries(bindings).filter(([mesh]) => present.has(norm(mesh))))
}

export const countByStatus = (units) =>
  units.reduce((acc, unit) => {
    const key = unit.status || 'available'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

export const formatArea = (size) => {
  const n = Number(String(size ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString()} sq ft` : null
}

export const formatBytes = (bytes) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}
