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

/**
 * The shape of a new unit, in one place.
 *
 * Both the "Add unit" button and tap-to-tag in the 3D model create units, and
 * a unit missing a field one of them sets would render as a blank row in the
 * other's form.
 */
export const makeUnit = (label = '') => ({
  label,
  status: 'available',
  tenant: '',
  size: '',
  floor: '',
  rate: '',
  frontage: '',
  description: '',
  x: null,
  y: null,
  // Tenant mark, shown on the unit in the 3D view once it is leased or
  // sold. Empty means the unit shows its number instead.
  logo: '',
  // Photographs of this specific unit — the storefront, the interior, the
  // dock. First one doubles as the unit's card thumbnail on the homepage,
  // which is why this is an array of plain URLs rather than objects: the
  // order is the only thing that carries meaning.
  //
  // Distinct from the property gallery. A property photograph shows the
  // plaza; these show the space being let, and a leased unit's photographs
  // are the whole reason its card is worth showing at all.
  images: [],
  // Both only ever surface on a leased or sold unit, where the tenant is the
  // subject of the card rather than an aside. `tenantCategory` is the trade
  // ("Coffee", "Dental"), which is what makes a tenant list read as a mix
  // rather than as a column of names.
  tenantUrl: '',
  tenantCategory: '',
  // Which named road this unit fronts, or '' for none set. Unset means
  // "inherit the building's own facingRoad" — see resolveFacingRoad() in
  // siteModel.js, which is what every caller should read instead of this
  // field directly.
  facingRoad: '',
})

/**
 * The lowest unused label at or above 101, matching how the client numbers
 * retail units.
 *
 * Auto-numbering has to avoid collisions rather than just count: bindings are
 * keyed by label, so two units sharing one would make the second impossible to
 * bind — the existing duplicate-label warning says as much.
 */
export function nextUnitLabel(units) {
  const taken = new Set(units.map((unit) => norm(unit.label)).filter(Boolean))
  let n = 101
  while (taken.has(String(n))) n += 1
  return String(n)
}

/**
 * DOM id of a unit's form row, used by tap-to-tag to scroll the unit it just
 * created into view.
 *
 * Scoped by the building's folder because the admin renders every building on
 * one page: a bare `unit-form-0` would collide across buildings and
 * getElementById would land on the first one, sending the admin to a different
 * building's unit than the shape they tapped.
 */
export const unitFormId = (folder, index) =>
  `unit-form-${String(folder ?? 'b').replace(/[^a-zA-Z0-9]+/g, '-')}-${index}`

/**
 * Groups meshes that share plan vertices into blocks.
 *
 * Converter output has no notion of a unit: a retail block arrives as a dozen
 * separate wall panels of two triangles each. Binding one of those would tag a
 * sliver of wall rather than the shop the admin actually clicked, so tapping
 * has to act on the whole connected block.
 *
 * `items` is `[{ name, keys }]` where `keys` is a Set of quantised x|y vertex
 * strings. Returns mesh name -> group id.
 *
 * Panels that belong to no group (the full-footprint floor and ceiling slabs,
 * which touch every unit and would otherwise fuse the whole building into one
 * block) are expected to be filtered out by the caller before this is called.
 */
export function groupBySharedVertices(items) {
  const parent = items.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  const seen = new Map()
  items.forEach((item, i) => {
    for (const key of item.keys) {
      if (seen.has(key)) union(seen.get(key), i)
      else seen.set(key, i)
    }
  })

  const groupOf = new Map()
  items.forEach((item, i) => groupOf.set(item.name, `g${find(i)}`))
  return groupOf
}

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
    const override = overrides.get(norm(meshName))

    // Scenery is not interactive *unless an admin explicitly bound it*. That
    // exception is what makes models from format converters usable at all:
    // they arrive with every object called `Node1`, `Node2`… so no mesh can
    // claim a unit by name, and without this the binding UI would have nothing
    // to offer and the model could never be made clickable.
    if (claimedLabel === null && override === undefined) continue

    const unit = findUnitByLabel(units, override ?? claimedLabel)
    if (unit) {
      matched.push({ meshName, unit })
      claimed.add(unit.index)
    } else if (claimedLabel !== null) {
      unmatched.push(meshName)
    }
    // A bound scenery mesh whose unit was later deleted simply reverts to
    // scenery. Listing it as "unmatched" would ask the admin to fix a shape
    // they never named — the stale binding is pruned on the next upload.
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

// Lives here rather than beside the compass that produces the bearings: the
// detail card and the comparison table both name a unit's aspect, and they
// must not reach into the 3D viewer's module to do it — that module carries
// three/fiber/drei and is lazy precisely so it never enters the main bundle.
const COMPASS_POINTS = [
  'North',
  'North-east',
  'East',
  'South-east',
  'South',
  'South-west',
  'West',
  'North-west',
]

/** A compass bearing in degrees as one of eight points, or null if unknown. */
export const bearingLabel = (bearing) =>
  Number.isFinite(bearing) ? COMPASS_POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8] : null

/**
 * The individual unit numbers inside a label.
 *
 * The client writes a suite that has been combined as one unit whose label
 * joins its parts — "101+102+103+106". Rendered as that raw string it is a
 * single unbreakable word: it cannot wrap, so it overflows the detail card's
 * heading and gets clipped. Splitting it lets every surface put break
 * opportunities between the parts and space them out to read as a set of
 * numbers rather than as one long number.
 *
 * A plain label simply comes back as a single-element array, so callers need
 * no special case.
 */
export const unitLabelParts = (label) =>
  String(label ?? '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)

/** The same, spaced for a single line of text — chips, lists, option labels. */
export const formatUnitLabel = (label) => unitLabelParts(label).join(' + ') || String(label ?? '')

/**
 * A unit's photographs, always an array.
 *
 * Every unit written before `images` existed simply has no key, and a unit
 * whose last photograph was removed in the admin can hold an array of empty
 * strings — both have to read as "no photographs" rather than as one broken
 * `<img>`. Callers get to treat the result as a list and nothing else.
 */
export const getUnitImages = (unit) =>
  (Array.isArray(unit?.images) ? unit.images : []).filter((url) => String(url ?? '').trim())

// A positive number from one end of a size, ignoring thousands separators and
// any unit text around it — "1,500", "2,000 sq ft". Null for anything else.
const parseArea = (text) => {
  const digits = String(text ?? '').replace(/[^\d.]/g, '')
  const n = digits ? Number(digits) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * A unit's size as display text, or null when there is no usable number.
 *
 * Ranges stay ranges. Sizes are typed by hand and a divisible suite is
 * entered as "1,500-2,000"; stripping every non-digit from that whole string
 * ran the two ends together into 15,002,000 sq ft. Each end is read on its
 * own now, and a value that is not a range reads exactly as it always did.
 */
export const formatArea = (size) => {
  const text = String(size ?? '')
  // Hyphen, en and em dash, or "to". A leading minus is not a range — sizes
  // are never negative, and splitting it would leave an empty first end.
  const ends = text.split(/\s*(?:[-–—]|\bto\b)\s*/i).filter((part) => /\d/.test(part))
  if (ends.length === 2) {
    const [low, high] = ends.map(parseArea)
    if (low && high) {
      return low === high
        ? `${low.toLocaleString()} sq ft`
        : `${Math.min(low, high).toLocaleString()}–${Math.max(low, high).toLocaleString()} sq ft`
    }
  }
  const n = parseArea(text)
  return n ? `${n.toLocaleString()} sq ft` : null
}

export const formatBytes = (bytes) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}

/**
 * URL-safe form of a building or unit label — "Building 10" → "building-10",
 * "101+102+103+106" → "101-102-103-106". Labels rather than indexes, because an
 * index breaks the moment the client reorders the list, and these URLs are
 * ones people send each other.
 */
export const labelSlug = (label) =>
  String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** The public page for one unit. */
export const unitPath = (propertySlug, buildingLabel, unitLabel) =>
  `/properties/${propertySlug}/units/${labelSlug(buildingLabel)}/${labelSlug(unitLabel)}`

/** Every unit in a property, with where it sits. */
export const listUnits = (property) =>
  getBuildings(property).flatMap((building, buildingIndex) =>
    getUnits(building).map((unit) => ({ building, buildingIndex, unit, unitIndex: unit.index })),
  )

/** A unit by its slugged building and unit labels, or null. */
export const findUnitBySlugs = (property, buildingSlugValue, unitSlugValue) =>
  listUnits(property).find(
    (u) => labelSlug(u.building.building) === buildingSlugValue && labelSlug(u.unit.label) === unitSlugValue,
  ) ?? null

/**
 * The identity a whole-site unit binding resolves by: its building and unit
 * labels, trimmed and case-folded. reconcileSite() in siteModel.js claims
 * units under exactly this key, and rekeySiteBindings() below matches by it,
 * so "Building 6"/"605" and " building 6 "/"605" are one unit everywhere.
 */
export const siteUnitKey = (buildingLabel, unitLabel) => `${norm(buildingLabel)}::${norm(unitLabel)}`

// How many units in a list carry this label. A rename may only carry bindings
// with it when the old label was the unit's alone and the new one is not
// already someone else's — see the guard in applyUnitChange().
const labelCount = (units, label) => (units ?? []).filter((unit) => norm(unit?.label) === norm(label)).length

/**
 * Re-points a whole-site model's bindings after a unit or building changes
 * identity. Pure: returns a new siteModel, or the one it was given when
 * nothing pointed at the old identity.
 *
 * The data it edits, all in `detail.siteModel`, keyed by mesh name:
 *   unitBindings[mesh]     = { buildingLabel, unitLabel }
 *   buildingBindings[mesh] = buildingLabel
 * Labels match trimmed and case-insensitively (see siteUnitKey); written
 * labels are the new ones exactly as given.
 *
 * `change` is one of:
 *   { type: 'renameUnit', building, from, to }
 *       every unit binding on (building, from) now points at (building, to).
 *   { type: 'removeUnit', building, unit }
 *       every unit binding on (building, unit) is dropped, and its mesh is
 *       bound to `building` instead (unless it already has a building
 *       binding), so the shape stays part of its building rather than
 *       turning into grey scenery.
 *   { type: 'renameBuilding', from, to }
 *       every unit binding on building `from` and every building binding to
 *       `from` now name `to`.
 *
 * Callers guard collisions; this does not. Re-keying "605" onto a label
 * another unit already holds would merge two units' shapes, so only apply a
 * rename when the old label was unique and the new one is free — which is
 * what applyUnitChangeToDetail() and renameBuildingInDetail() do. The API
 * side (the tracker merge) should mirror this function, guard included, so a
 * relabel from either end keeps the shape.
 */
export function rekeySiteBindings(siteModel, change) {
  if (!siteModel || !change) return siteModel
  const unitBindings = siteModel.unitBindings ?? {}
  const buildingBindings = siteModel.buildingBindings ?? {}
  const nextUnits = { ...unitBindings }
  const nextBuildings = { ...buildingBindings }
  let changed = false

  if (change.type === 'renameUnit') {
    if (!norm(change.to) || siteUnitKey(change.building, change.from) === siteUnitKey(change.building, change.to)) return siteModel
    const key = siteUnitKey(change.building, change.from)
    for (const [mesh, bind] of Object.entries(unitBindings)) {
      if (siteUnitKey(bind?.buildingLabel, bind?.unitLabel) !== key) continue
      nextUnits[mesh] = { ...bind, unitLabel: change.to }
      changed = true
    }
  } else if (change.type === 'removeUnit') {
    const key = siteUnitKey(change.building, change.unit)
    for (const [mesh, bind] of Object.entries(unitBindings)) {
      if (siteUnitKey(bind?.buildingLabel, bind?.unitLabel) !== key) continue
      delete nextUnits[mesh]
      if (!norm(nextBuildings[mesh])) nextBuildings[mesh] = bind.buildingLabel
      changed = true
    }
  } else if (change.type === 'renameBuilding') {
    if (!norm(change.to) || norm(change.from) === norm(change.to)) return siteModel
    for (const [mesh, bind] of Object.entries(unitBindings)) {
      if (norm(bind?.buildingLabel) !== norm(change.from)) continue
      nextUnits[mesh] = { ...bind, buildingLabel: change.to }
      changed = true
    }
    for (const [mesh, label] of Object.entries(buildingBindings)) {
      if (norm(label) !== norm(change.from)) continue
      nextBuildings[mesh] = change.to
      changed = true
    }
  }

  return changed ? { ...siteModel, unitBindings: nextUnits, buildingBindings: nextBuildings } : siteModel
}

/**
 * The building after changing one of its units — or removing it, when `next`
 * is null.
 *
 * Matching to the 3D model is by label, so renaming a unit would otherwise
 * break its link: `301` → `301A` leaves whatever shape was linked to `301`
 * matching nothing. Two cases, both handled: a shape named `unit-301` was
 * linked by *name* (nothing stored — the match was implicit), or some other
 * shape had been *manually* bound to `301` (an explicit `bindings` entry).
 * Either way, whatever mesh resolves to the old label is re-pointed at the
 * new one. A removed unit's explicit bindings go with it. Shared by the
 * property editor and the Units section, so a rename from either keeps the
 * link.
 *
 * This only reaches the building's own model. A property on a whole-site
 * model keeps its bindings in `detail.siteModel`, which a building cannot
 * see — use applyUnitChangeToDetail() there, which calls this and re-keys
 * the site model too.
 *
 * Labels are edited a keystroke at a time, so a rename can pass through a
 * label another unit already holds ("1002" on the way from "100" to "1002A").
 * Bindings only move when the old label was this unit's alone and the new one
 * is free; otherwise they stay put and the duplicate-label warning in the
 * editor says why.
 */
export function applyUnitChange(building, index, next) {
  const units = building.unitList ?? []
  const previous = units[index]
  const removed = next == null
  const unitList = removed ? units.filter((_, i) => i !== index) : units.map((unit, i) => (i === index ? next : unit))
  const model = building.model ?? null

  const wasLabel = norm(previous?.label)
  const nowLabel = removed ? '' : String(next?.label ?? '').trim()
  const unique = wasLabel && labelCount(units, wasLabel) === 1
  if (!model?.url || !unique) return { ...building, unitList }

  const bindings = model.bindings ?? {}
  if (removed) {
    const kept = Object.fromEntries(Object.entries(bindings).filter(([, label]) => norm(label) !== wasLabel))
    return { ...building, unitList, model: { ...model, bindings: kept } }
  }

  if (!nowLabel || wasLabel === norm(nowLabel) || labelCount(units, nowLabel) > 0) {
    return { ...building, unitList }
  }

  // Every explicit binding, not just the first: a unit bound by block owns a
  // dozen wall panels, and re-pointing one of them left the rest on the old
  // label — a shop that lit up as a single sliver of wall.
  const nextBindings = { ...bindings }
  let moved = false
  for (const [mesh, label] of Object.entries(bindings)) {
    if (norm(label) !== wasLabel) continue
    nextBindings[mesh] = nowLabel
    moved = true
  }
  if (!moved) {
    const named = (model.meshNames ?? []).find((name) => norm(meshUnitLabel(name)) === wasLabel)
    if (named) {
      nextBindings[named] = nowLabel
      moved = true
    }
  }

  return { ...building, unitList, model: moved ? { ...model, bindings: nextBindings } : model }
}

const withBuildings = (detail, buildings) => ({
  ...detail,
  floorPlans: { ...(detail?.floorPlans ?? {}), buildings },
})

/**
 * applyUnitChange() at the level of a property's whole `detail`, so a rename
 * or removal also re-keys `detail.siteModel` — the bindings a whole-site
 * model (Centro Plaza) actually uses. `next` null removes the unit.
 *
 * Same collision guard as applyUnitChange(): bindings only follow a rename
 * whose old label was unique in the building and whose new one is free.
 */
export function applyUnitChangeToDetail(detail, buildingIndex, unitIndex, next) {
  const buildings = detail?.floorPlans?.buildings ?? []
  const building = buildings[buildingIndex]
  if (!building) return detail
  const units = building.unitList ?? []
  const previous = units[unitIndex]

  const nextBuildings = buildings.map((b, i) => (i === buildingIndex ? applyUnitChange(b, unitIndex, next) : b))
  let siteModel = detail?.siteModel ?? null

  const wasLabel = String(previous?.label ?? '').trim()
  if (siteModel && wasLabel && labelCount(units, wasLabel) === 1) {
    if (next == null) {
      siteModel = rekeySiteBindings(siteModel, { type: 'removeUnit', building: building.building, unit: wasLabel })
    } else if (labelCount(units, next.label) === 0) {
      siteModel = rekeySiteBindings(siteModel, {
        type: 'renameUnit',
        building: building.building,
        from: wasLabel,
        to: String(next.label ?? '').trim(),
      })
    }
  }

  const out = withBuildings(detail, nextBuildings)
  return siteModel === (detail?.siteModel ?? null) ? out : { ...out, siteModel }
}

/**
 * Renames one building and re-keys the whole-site model's bindings with it.
 *
 * Guarded like a unit rename: nothing moves when another building already
 * carries the new label (typing "Building 1" on the way to "Building 10"
 * would otherwise fold Building 10's shapes into Building 1's), or when the
 * old label was shared.
 */
export function renameBuildingInDetail(detail, buildingIndex, label) {
  const buildings = detail?.floorPlans?.buildings ?? []
  const building = buildings[buildingIndex]
  if (!building) return detail
  const from = String(building.building ?? '').trim()
  const nextBuildings = buildings.map((b, i) => (i === buildingIndex ? { ...b, building: label } : b))
  const out = withBuildings(detail, nextBuildings)

  const siteModel = detail?.siteModel ?? null
  const holders = (value) => buildings.filter((b) => norm(b.building) === norm(value)).length
  if (!siteModel || !from || holders(from) !== 1 || holders(label) > 0) return out

  const rekeyed = rekeySiteBindings(siteModel, { type: 'renameBuilding', from, to: String(label ?? '').trim() })
  return rekeyed === siteModel ? out : { ...out, siteModel: rekeyed }
}
