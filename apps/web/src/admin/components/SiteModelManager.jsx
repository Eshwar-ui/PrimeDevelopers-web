import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { uploadModel } from '../../lib/uploads'
import { imageWarning, inspectGlb, triangleWarning, validateModelFile } from '../../lib/glbInspect'
import { ConfirmButton } from './ui'
import UnitFields from './UnitFields'
import { STATUS_WORDS } from '../completeness'
import { resolveNext } from '../adminUtils'
import { formatBytes, getUnits, makeUnit, nextUnitLabel, siteUnitKey } from '../../lib/units'
import { isTrackerBuilding, isTrackerUnit } from '../unitChecks'
import {
  bindSiteMeshes,
  buildingMeshes,
  diffSiteModel,
  findBuildingByLabel,
  makeRoad,
  meshBuilding,
  pruneSiteBindings,
  reconcileSite,
  shapesInBuilding,
  tagBuildingShapes,
  toViewerEntries,
} from '../../lib/siteModel'

const ModelViewer = lazy(() => import('../../components/floorplan/ModelViewer'))

// In order: a building's shapes are tagged first, then its units are picked
// out of those shapes. Roads stand apart and can be done at any point.
const TABS = [
  { key: 'buildings', label: '1 · Buildings' },
  { key: 'units', label: '2 · Units' },
  { key: 'roads', label: '3 · Roads' },
]

/**
 * The whole-property counterpart to ModelManager.jsx — one GLB covering every
 * building on the site, tagged building/unit/road-wise instead of one GLB per
 * building.
 *
 * Tagging is building-first. Step 1 tags each building's shapes; step 2 picks
 * a building and tags its units, and only that building's shapes can be
 * picked — the rest of the site dims, and a tap outside it is refused with a
 * note saying where the shape belongs. Untagging a unit in step 2 leaves its
 * shape in the building rather than dropping it back to untagged.
 *
 * Building creation stays in the Floor Plans section above (it already has a
 * full form for area/units/parking); this panel only *tags* buildings that
 * already exist there. A unit's details come from Prime Tracker once the sync
 * has linked its building: those units are listed here but added in the
 * tracker, and the fields the sync writes are locked (see UnitFields). A
 * building the tracker has no data for keeps the CMS as its editor — units and
 * roads can be created straight from a tap, the same "arm-then-click, or
 * tap-to-create" pattern ModelManager already uses for units.
 */
export default function SiteModelManager({ buildings, onBuildingsChange, siteModel, onSiteModelChange, folder }) {
  const inputRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [tab, setTab] = useState('buildings')
  const [armedBuildingLabel, setArmedBuildingLabel] = useState('')
  const [armedUnitLabel, setArmedUnitLabel] = useState('')
  const [armedRoadName, setArmedRoadName] = useState('')
  const [tagUnitMode, setTagUnitMode] = useState(false) // tap-to-create, mirrors ModelManager
  const [multiSelect, setMultiSelect] = useState(false)
  const [pendingMeshNames, setPendingMeshNames] = useState([])
  const [showUnbound, setShowUnbound] = useState(false)
  // Why the last tap did nothing — a shape outside the building being worked on.
  const [notice, setNotice] = useState(null)

  const model = siteModel ?? null
  // A photo upload lands seconds after it starts; edit from the latest list, not the render's copy.
  const buildingsRef = useRef(buildings)
  buildingsRef.current = buildings
  // Memoised rather than `model?.meshNames ?? []`: a fresh array identity
  // every render (whenever there is no model yet) would recompute `report`
  // and `entries` continuously, which ModelViewer's own memoisation keys on —
  // same reason ModelManager.jsx memoises `bindings`.
  const meshNames = useMemo(() => model?.meshNames ?? [], [model])
  const roads = model?.roads ?? []

  const report = useMemo(() => reconcileSite(meshNames, buildings, model), [meshNames, buildings, model])
  const entries = useMemo(() => toViewerEntries(report), [report])
  // Orange = untagged (when the toggle is on) and whatever shape the editor has just picked.
  const flagged = useMemo(
    () => new Set([...(showUnbound ? report.unbound : []), ...pendingMeshNames]),
    [showUnbound, report, pendingMeshNames],
  )
  const taggedUnits = useMemo(
    () => new Set(Object.values(model?.unitBindings ?? {}).map((b) => siteUnitKey(b.buildingLabel, b.unitLabel))),
    [model],
  )

  const armedBuilding = findBuildingByLabel(buildings, armedBuildingLabel)
  const armedBuildingUnits = armedBuilding ? getUnits(armedBuilding) : []
  // Units of a tracker-linked building are the tracker's to add.
  const trackerBuilding = isTrackerBuilding(armedBuilding)

  /** Step 1's result: how many shapes each building has. Step 2 opens only a building with some. */
  const shapeCounts = useMemo(
    () => new Map(buildings.filter((b) => b.building).map((b) => [b.building, buildingMeshes(model, b.building).length])),
    [buildings, model],
  )
  const buildingsTagged = [...shapeCounts.values()].filter(Boolean).length

  /** While step 2 works inside one building, the rest of the site recedes. */
  const focusMeshes = useMemo(
    () => (tab === 'units' && armedBuilding ? new Set(buildingMeshes(model, armedBuilding.building)) : null),
    [tab, armedBuilding, model],
  )

  const setModel = (next) => onSiteModelChange(next)

  const pick = () => inputRef.current?.click()

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    const rejection = validateModelFile(file)
    if (rejection) {
      setError(rejection)
      return
    }

    setBusy(true)
    try {
      const inspected = await inspectGlb(file)
      setPending({ file, ...inspected, diff: diffSiteModel(model, inspected.meshNames) })
    } catch {
      setError('This file could not be read as a 3D model. Ask your modeller to re-export it as .glb.')
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadModel(pending.file, `${folder}/model`)
      const pruned = pruneSiteBindings(model, pending.meshNames)
      setModel({
        ...pruned,
        url,
        poster: model?.poster ?? '',
        uploadedAt: new Date().toISOString(),
        fileSize: pending.fileSize,
        triangles: pending.triangles,
        meshNames: pending.meshNames,
        roads: model?.roads ?? [],
        orientation: model?.orientation ?? null,
      })
      setPending(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /** What a click should bind to right now, or null if nothing is armed. */
  const armedTarget = () => {
    if (tab === 'buildings') return armedBuildingLabel ? { kind: 'building', buildingLabel: armedBuildingLabel } : null
    if (tab === 'units') {
      if (!armedBuildingLabel || !armedUnitLabel) return null
      return { kind: 'unit', buildingLabel: armedBuildingLabel, unitLabel: armedUnitLabel }
    }
    if (tab === 'roads') return armedRoadName ? { kind: 'road', roadName: armedRoadName } : null
    return null
  }

  const bindNames = (names, target) => {
    setModel(bindSiteMeshes(model, names, target))
  }

  /** Step 1's tag: keeps the units step 2 already tagged on this building's shapes. */
  const tagAsBuilding = (names, buildingLabel) => {
    setModel(tagBuildingShapes(model, names, buildingLabel))
  }

  /** What untagging means on this step: a unit's shape stays in its building. */
  const untagTarget = (buildingLabel) => (tab === 'units' && buildingLabel ? { kind: 'building', buildingLabel } : null)

  /** Applies a tag from any of the three ways to pick one (armed click, multi-select, pick panel). */
  const applyTag = (names, target) => {
    if (target?.kind === 'building') tagAsBuilding(names, target.buildingLabel)
    else bindNames(names, target)
  }

  /** Tap-to-create a unit, mirroring ModelManager's tagShape(): only offered
   *  once a building is armed on the Units tab, since a unit has to belong to
   *  one. */
  const createUnitFromTap = (names) => {
    if (!armedBuilding || trackerBuilding) return
    const label = nextUnitLabel(armedBuildingUnits)
    const unitList = [...(armedBuilding.unitList ?? []), makeUnit(label)]
    const nextBuildings = buildings.map((b) => (b === armedBuilding ? { ...b, unitList } : b))
    onBuildingsChange(nextBuildings)
    setModel(bindSiteMeshes(model, names, { kind: 'unit', buildingLabel: armedBuildingLabel, unitLabel: label }))
  }

  const onMeshClick = (meshName, block) => {
    let names = block?.length ? block : [meshName]
    setNotice(null)

    // Step 2 works inside one building. With none picked yet, a tap on a
    // tagged building picks it (and the unit, if the shape has one); a tap on
    // a shape no building owns is sent back to step 1.
    if (tab === 'units') {
      if (!armedBuilding) {
        const owner = findBuildingByLabel(buildings, meshBuilding(model, meshName))
        if (!owner) {
          setNotice('That shape is not part of a building yet. Tag it in step 1 first, then come back for its units.')
          return
        }
        setArmedBuildingLabel(owner.building)
        setArmedUnitLabel(model?.unitBindings?.[meshName]?.unitLabel ?? '')
        setTagUnitMode(false)
        return
      }
      const inside = shapesInBuilding(model, names, armedBuilding.building)
      if (!inside.length) {
        const owner = meshBuilding(model, meshName)
        setNotice(
          owner
            ? `That shape is part of ${owner}, not ${armedBuilding.building}. Pick ${owner} above to tag its units.`
            : `That shape is not part of ${armedBuilding.building}. If it belongs to it, tag it in step 1 first.`,
        )
        return
      }
      names = inside
    }

    if (multiSelect) {
      setPendingMeshNames((prev) => Array.from(new Set([...prev, ...names])))
      return
    }

    const target = armedTarget()
    if (target) {
      // Clicking a shape that already carries the armed tag takes it off again.
      if (names.every((n) => isBoundTo(n, target))) {
        if (target.kind === 'building' && names.some((n) => model?.unitBindings?.[n])) {
          setNotice(`That shape carries a unit of ${target.buildingLabel}. Untag the unit in step 2 before taking the shape out of the building.`)
          return
        }
        bindNames(names, untagTarget(target.buildingLabel))
        return
      }
      applyTag(names, target)
      // Tagging a whole building unit by unit: move on to the next untagged
      // one so the editor just keeps clicking shapes.
      if (target.kind === 'unit') {
        const done = new Set(taggedUnits).add(siteUnitKey(target.buildingLabel, target.unitLabel))
        const next = armedBuildingUnits.find(
          (u) => u.label && u.label !== target.unitLabel && !done.has(siteUnitKey(target.buildingLabel, u.label)),
        )
        setArmedUnitLabel(next?.label ?? '')
      }
      return
    }
    if (tab === 'units' && tagUnitMode && armedBuilding) {
      createUnitFromTap(names)
      return
    }
    // Units tab, nothing armed: a click on a tagged unit's shape selects that unit for editing.
    const hit = model?.unitBindings?.[names[0]]
    if (tab === 'units' && hit) {
      setArmedBuildingLabel(hit.buildingLabel)
      setArmedUnitLabel(hit.unitLabel)
      return
    }
    // Nothing armed: the click just picks the shape, and the panel below
    // offers every building, unit and road to tag it as.
    setPendingMeshNames(names)
  }

  /** Takes every shape off a unit. They stay in the building, ready for another unit. */
  const untagUnit = (buildingLabel, unitLabel) => {
    const key = siteUnitKey(buildingLabel, unitLabel)
    const names = Object.entries(model?.unitBindings ?? {})
      .filter(([, b]) => siteUnitKey(b.buildingLabel, b.unitLabel) === key)
      .map(([name]) => name)
    if (names.length) bindNames(names, { kind: 'building', buildingLabel })
  }

  /** Edits one unit of the armed building from the side panel. */
  const changeUnit = (index, next) => {
    const current = buildingsRef.current
    const bi = current.findIndex((b) => b.building === armedBuildingLabel)
    if (bi < 0) return
    const before = current[bi].unitList?.[index]
    if (!before) return
    const after = resolveNext(next, before)
    if (after.label !== before.label && armedUnitLabel === before.label) setArmedUnitLabel(after.label)
    onBuildingsChange(
      current.map((b, i) =>
        i === bi ? { ...b, unitList: b.unitList.map((u, j) => (j === index ? after : u)) } : b,
      ),
    )
  }

  const addUnitFromPanel = () => {
    if (!armedBuilding || trackerBuilding) return
    const label = nextUnitLabel(armedBuilding.unitList ?? [])
    onBuildingsChange(
      buildingsRef.current.map((b) => (b === armedBuilding ? { ...b, unitList: [...(b.unitList ?? []), makeUnit(label)] } : b)),
    )
    setArmedUnitLabel(label)
  }

  /** Whether a shape already carries exactly this tag. */
  const isBoundTo = (name, target) => {
    if (target.kind === 'unit') {
      const b = model?.unitBindings?.[name]
      return Boolean(b) && siteUnitKey(b.buildingLabel, b.unitLabel) === siteUnitKey(target.buildingLabel, target.unitLabel)
    }
    if (target.kind === 'road') return model?.roadBindings?.[name] === target.roadName
    // Step 1 asks "is this shape in the building", units inside it included.
    return meshBuilding(model, name) === target.buildingLabel
  }

  /** What the picked shapes are tagged as, in words — every distinct tag, not just the first shape's. */
  const describeMeshes = (names) => {
    const tags = Array.from(new Set(names.map(describeMesh)))
    return tags.length === 1 ? tags[0] : `mixed (${tags.join(', ')})`
  }

  /** What a shape is tagged as right now, in words. */
  const describeMesh = (name) => {
    const unit = model?.unitBindings?.[name]
    if (unit) return `Unit ${unit.unitLabel} · ${unit.buildingLabel}`
    const road = model?.roadBindings?.[name]
    if (road) return `Road: ${road}`
    const building = model?.buildingBindings?.[name]
    if (building) return `Building ${building}`
    return 'Not tagged yet'
  }

  /** Creates a road and tags the picked shapes as it, for when none exists yet. */
  const tagPickedAsNewRoad = () => {
    const name = `Road ${roads.length + 1}`
    setModel(bindSiteMeshes({ ...model, roads: [...roads, makeRoad(name)] }, pendingMeshNames, { kind: 'road', roadName: name }))
    setPendingMeshNames([])
  }

  const tagPicked = (target) => {
    applyTag(pendingMeshNames, target)
    setPendingMeshNames([])
  }

  /** The pick panel's Remove tag, which on step 1 would also drop units step 2 tagged. */
  const removePickedTag = () => {
    if (tab === 'buildings' && pendingMeshNames.some((n) => model?.unitBindings?.[n])) {
      setNotice('Some of those shapes carry units. Untag the units in step 2 before taking the shapes out of their building.')
      return
    }
    bindNames(pendingMeshNames, untagTarget(armedBuildingLabel))
    setPendingMeshNames([])
  }

  const commitPendingSelection = () => {
    const target = armedTarget()
    if (!target || !pendingMeshNames.length) return
    applyTag(pendingMeshNames, target)
    setPendingMeshNames([])
  }

  const addRoad = () => {
    const name = `Road ${roads.length + 1}`
    setModel({ ...model, roads: [...roads, makeRoad(name)] })
    setArmedRoadName(name)
  }

  const renameRoad = (index, name) => {
    setModel({ ...model, roads: roads.map((r, i) => (i === index ? { ...r, name } : r)) })
  }

  const setRoadTrafficNote = (index, trafficNote) => {
    setModel({ ...model, roads: roads.map((r, i) => (i === index ? { ...r, trafficNote } : r)) })
  }

  const removeRoad = (index) => {
    const road = roads[index]
    // Unbind every mesh pointed at this road — an orphaned roadBindings entry
    // would resolve to nothing and quietly vanish from the reconciliation
    // report with no way to find it again.
    const roadBindings = { ...(model?.roadBindings ?? {}) }
    for (const [mesh, name] of Object.entries(roadBindings)) {
      if (name === road?.name) delete roadBindings[mesh]
    }
    setModel({ ...model, roads: roads.filter((_, i) => i !== index), roadBindings })
    if (armedRoadName === road?.name) setArmedRoadName('')
  }

  const sidePanel = tab === 'units' && Boolean(armedBuilding)

  const pendingReport = pending ? reconcileSite(pending.meshNames, buildings, model) : null

  return (
    <div className="rounded-lg border border-white/10 bg-void/40 p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-bone-3">
        Whole-site 3D model — one model for the whole property, tagged building, unit and road wise
      </span>

      {/* ── upload ─────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-bone/80 hover:border-ember hover:text-ember disabled:opacity-50"
        >
          {busy ? 'Working…' : model?.url ? 'Replace model' : 'Upload model'}
        </button>
        {model?.url && (
          <>
            <span className="text-xs text-bone-3">
              {formatBytes(model.fileSize)} · {Number(model.triangles ?? 0).toLocaleString()} triangles ·{' '}
              {report.resolved.length} of {meshNames.length} shapes tagged
            </span>
            {/* Inline, not window.confirm — see ConfirmButton. Takes effect on
                Save, like every other edit here. */}
            <ConfirmButton
              label="Remove"
              prompt="Remove the site model? The page falls back to per-building floor plans."
              confirmLabel="Remove"
              busyLabel="Removing…"
              onConfirm={() => setModel(null)}
            />
          </>
        )}
        <input ref={inputRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={onFile} />
      </div>

      {error && <p className="mt-3 text-xs leading-relaxed text-red-400">{error}</p>}

      {/* ── pending upload review ─────────────────────────────────── */}
      {pending && (
        <div className="mt-4 rounded-lg border border-ember/40 bg-ember/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ember">Review before saving</p>
          <p className="mt-2 text-xs leading-relaxed text-bone/70">
            {pending.meshNames.length} shapes in this file. {pendingReport.resolved.length} already resolve against your
            current tags{model?.url ? '' : ' (none yet — everything starts untagged)'}.
          </p>
          {model?.url && (
            <p className="mt-1 text-xs leading-relaxed text-bone/55">
              Compared to the current model: {pending.diff.retained.length} tagged shapes unchanged,{' '}
              {pending.diff.removed.length} removed
              {pending.diff.removed.length ? ` (their tags will be dropped)` : ''}.
            </p>
          )}
          {triangleWarning(pending.triangles) && (
            <p className="mt-2 text-xs leading-relaxed text-ember">{triangleWarning(pending.triangles)}</p>
          )}
          {imageWarning(pending) && <p className="mt-2 text-xs leading-relaxed text-ember">{imageWarning(pending)}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={commit}
              disabled={busy}
              className="rounded-full bg-ember px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-void disabled:opacity-50"
            >
              {busy ? 'Uploading…' : 'Upload and save'}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-bone/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── tagging ────────────────────────────────────────────────── */}
      {model?.url && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key)
                  setPendingMeshNames([])
                  setNotice(null)
                }}
                aria-pressed={tab === t.key}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  tab === t.key ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                }`}
              >
                {t.label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-white/15" />
            <label className="flex items-center gap-1.5 text-xs text-bone/70">
              <input
                type="checkbox"
                checked={multiSelect}
                onChange={(e) => {
                  setMultiSelect(e.target.checked)
                  setPendingMeshNames([])
                }}
              />
              Select multiple shapes before binding
            </label>
            <label className="flex items-center gap-1.5 text-xs text-bone/70">
              <input type="checkbox" checked={showUnbound} onChange={(e) => setShowUnbound(e.target.checked)} />
              Highlight untagged shapes ({report.unbound.length})
            </label>
          </div>

          {/* Step 1: arm a building that already exists in Floor Plans above and click its shapes. */}
          {tab === 'buildings' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {buildings.length === 0 && (
                <p className="text-xs text-bone-3">Add a building in Floor Plans above first — this panel only tags buildings that already exist.</p>
              )}
              {buildings.length > 0 && (
                <p className="basis-full text-xs text-bone-3">
                  Tag every building's shapes first. Its units are picked out of those shapes in step 2.
                </p>
              )}
              {buildings.map((b) => (
                <button
                  key={b.building || Math.random()}
                  type="button"
                  onClick={() => setArmedBuildingLabel(armedBuildingLabel === b.building ? '' : b.building)}
                  disabled={!b.building}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide disabled:opacity-40 ${
                    armedBuildingLabel === b.building ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                  }`}
                >
                  {b.building || '(unnamed — set a name above first)'}
                  {b.building ? ` · ${shapeCounts.get(b.building) ?? 0}` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: pick a building step 1 tagged (scopes the shapes and the unit list), then a unit, or tap-to-create. */}
          {tab === 'units' && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-bone-3">Building:</span>
                {buildings.map((b) => {
                  const shapes = shapeCounts.get(b.building) ?? 0
                  return (
                    <button
                      key={b.building || Math.random()}
                      type="button"
                      onClick={() => {
                        setArmedBuildingLabel(armedBuildingLabel === b.building ? '' : b.building)
                        setArmedUnitLabel('')
                        setTagUnitMode(false)
                        setPendingMeshNames([])
                        setNotice(null)
                      }}
                      disabled={!b.building || shapes === 0}
                      title={b.building && shapes === 0 ? 'Tag this building’s shapes in step 1 first' : undefined}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide disabled:opacity-40 ${
                        armedBuildingLabel === b.building ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                      }`}
                    >
                      {b.building || '(unnamed)'}
                      {b.building && shapes === 0 ? ' · step 1 first' : ''}
                    </button>
                  )
                })}
              </div>
              {buildingsTagged === 0 && (
                <p className="text-xs text-ember">No building has shapes yet. Tag the buildings in step 1, then come back for their units.</p>
              )}
              {armedBuilding && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-bone-3">Unit:</span>
                  {armedBuildingUnits.map((u) => (
                    <button
                      key={u.index}
                      type="button"
                      onClick={() => setArmedUnitLabel(armedUnitLabel === u.label ? '' : u.label)}
                      disabled={!u.label}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide disabled:opacity-40 ${
                        armedUnitLabel === u.label ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                      }`}
                    >
                      {taggedUnits.has(siteUnitKey(armedBuildingLabel, u.label)) ? '✓ ' : ''}
                      {u.label || '(unlabelled)'}
                    </button>
                  ))}
                  {!trackerBuilding && (
                    <button
                      type="button"
                      onClick={() => {
                        setTagUnitMode((on) => !on)
                        setArmedUnitLabel('')
                      }}
                      aria-pressed={tagUnitMode}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        tagUnitMode ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                      }`}
                    >
                      {tagUnitMode ? 'Done — stop creating new units' : '+ New unit by tapping'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Roads tab: roads live only here — no other editor manages them. */}
          {tab === 'roads' && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {roads.map((r, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setArmedRoadName(armedRoadName === r.name ? '' : r.name)}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        armedRoadName === r.name ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                      }`}
                    >
                      {r.name}
                    </button>
                    <button type="button" onClick={() => removeRoad(i)} aria-label={`Remove ${r.name}`} className="text-bone-3 hover:text-red-400">
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRoad}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-bone/70 hover:border-ember hover:text-ember"
                >
                  + New road
                </button>
              </div>
              {roads.length > 0 && (
                <div className="flex flex-col gap-2">
                  {roads.map((r, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <input
                        value={r.name}
                        onChange={(e) => renameRoad(i, e.target.value)}
                        placeholder="Road name"
                        className="rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-bone outline-none focus:border-ember"
                      />
                      <input
                        value={r.trafficNote}
                        onChange={(e) => setRoadTrafficNote(i, e.target.value)}
                        placeholder="Traffic note, e.g. 23,000+ vehicles/day"
                        className="rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-bone outline-none focus:border-ember"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {multiSelect && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-ember/40 bg-ember/5 px-3 py-2">
              <span className="text-xs text-bone/80">
                {pendingMeshNames.length} shape{pendingMeshNames.length === 1 ? '' : 's'} selected — use this for shapes
                that won't group together on their own.
              </span>
              <button
                type="button"
                onClick={commitPendingSelection}
                disabled={!pendingMeshNames.length || !armedTarget()}
                className="rounded-full bg-ember px-3 py-1 text-xs font-bold uppercase tracking-wide text-void disabled:opacity-40"
              >
                Bind selected as one
              </button>
              <button
                type="button"
                onClick={() => setPendingMeshNames([])}
                disabled={!pendingMeshNames.length}
                className="text-xs text-bone-3 hover:text-ember disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          )}

          {/* ── coverage summary ─────────────────────────────────── */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-bone-3">
            <span>1 · {report.unmodelledBuildings.length} building{report.unmodelledBuildings.length === 1 ? '' : 's'} not yet tagged</span>
            <span>2 · {report.unmodelledUnits.length} unit{report.unmodelledUnits.length === 1 ? '' : 's'} not yet tagged</span>
            <span>3 · {report.unmodelledRoads.length} road{report.unmodelledRoads.length === 1 ? '' : 's'} not yet tagged</span>
          </div>
          {/* A shape whose unit has gone still shows as part of its building
              (see reconcileSite), so this is a to-do, not a breakage: re-tag
              it, or leave it for the unit to come back. */}
          {report.staleBindings.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-ember">
              {report.staleBindings.length} shape{report.staleBindings.length === 1 ? ' is' : 's are'} tagged to a
              unit or road that no longer exists. A shape whose unit has gone still shows as part of its building —
              tag it again to link a unit.
            </p>
          )}

          {/* ── viewer ───────────────────────────────────────────── */}
          <div className={`mt-4 ${sidePanel ? 'grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]' : ''}`}>
          {sidePanel && (
            <UnitSidePanel
              building={armedBuilding}
              units={armedBuildingUnits}
              taggedUnits={taggedUnits}
              armedUnitLabel={armedUnitLabel}
              onArm={(label) => setArmedUnitLabel(armedUnitLabel === label ? '' : label)}
              onUntag={(label) => untagUnit(armedBuildingLabel, label)}
              onChangeUnit={changeUnit}
              onAdd={trackerBuilding ? null : addUnitFromPanel}
              folder={`${folder}/unit-images`}
            />
          )}
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-ember px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-void">
              {armedTarget()
                ? multiSelect
                  ? `Click shapes to add them to the selection`
                  : `Click the shape${tab === 'buildings' ? ' — or shapes — that make up' : ' that is'} ${
                      tab === 'buildings' ? armedBuildingLabel : tab === 'units' ? armedUnitLabel : armedRoadName
                    }`
                : tab === 'units' && tagUnitMode
                  ? `Tap a shape of ${armedBuildingLabel} to create a new unit for it`
                  : tab === 'units'
                    ? armedBuilding
                      ? `Pick a unit, then click its shape — only ${armedBuildingLabel}'s shapes can be picked`
                      : 'Click a tagged building, or pick one above, to tag its units'
                    : `Click any shape to tag it (click a tagged shape again while its tag is armed to untag) — or arm a ${tab === 'buildings' ? 'building' : 'road'} above first and click its shape`}
            </div>
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center rounded-lg border border-white/10 text-xs text-bone-3">
                  Loading preview…
                </div>
              }
            >
              <ModelViewer
                url={model.url}
                siteEntries={entries}
                focusMeshes={focusMeshes}
                defaultMode="3d"
                darkGround
                orientation={Number.isFinite(model.orientation) ? model.orientation : null}
                onSelect={() => {}}
                statusFilter={null}
                flaggedMeshes={flagged}
                onMeshClick={onMeshClick}
                height="h-96 md:h-[34rem]"
              />
            </Suspense>
            {notice && (
              <p role="status" className="mt-2 rounded-lg border border-ember/40 bg-ember/5 px-3 py-2 text-xs leading-relaxed text-ember">
                {notice}
              </p>
            )}
            {pendingMeshNames.length > 0 && (
              <PickPanel
                step={tab}
                names={pendingMeshNames}
                current={describeMeshes(pendingMeshNames)}
                onNewRoad={tagPickedAsNewRoad}
                buildings={tab === 'units' && armedBuilding ? [armedBuilding] : buildings}
                roads={roads}
                taggedUnits={taggedUnits}
                onTag={tagPicked}
                onRemove={removePickedTag}
                onClear={() => setPendingMeshNames([])}
              />
            )}
            <p className="mt-2 text-xs text-bone-3">This is exactly what a visitor sees. Untagged shapes are highlighted in orange when the toggle above is on.</p>
          </div>
          </div>
        </>
      )}
    </div>
  )
}

// Shown after a shape is clicked with nothing armed: one tap tags it as what
// the current step is about — a building on step 1, one of the picked
// building's units on step 2, a road on step 3. Untagged units come first,
// since those are what is left to do; a ✓ marks a unit that already owns a
// shape (tagging it again moves it to this one).
function PickPanel({ step, names, current, buildings, roads, taggedUnits, onTag, onRemove, onNewRoad, onClear }) {
  const chip =
    'rounded-full border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-bone/80 hover:border-ember hover:text-ember'
  return (
    <div role="region" aria-label="Tag the selected shape" className="mt-3 rounded-lg border border-ember/50 bg-ember/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-bone/80">
          <strong className="font-bold uppercase tracking-wide text-ember">
            {names.length} shape{names.length === 1 ? '' : 's'} picked
          </strong>{' '}
          — now tagged as: {current}. Choose what it is:
        </p>
        <span className="flex gap-2">
          {!/^Not tagged yet$/.test(current) && (
            <button type="button" onClick={onRemove} className="text-xs text-red-300 hover:text-red-200">
              {step === 'units' ? 'Remove unit tag' : 'Remove tag'}
            </button>
          )}
          <button type="button" onClick={onClear} className="text-xs text-bone-3 hover:text-ember">
            Cancel
          </button>
        </span>
      </div>

      {step === 'buildings' && buildings.filter((b) => b.building).length > 0 && (
        <div className="mt-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-bone-3">Whole building</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {buildings
              .filter((b) => b.building)
              .map((b) => (
                <button key={b.building} type="button" className={chip} onClick={() => onTag({ kind: 'building', buildingLabel: b.building })}>
                  {b.building}
                </button>
              ))}
          </div>
        </div>
      )}

      {step === 'units' && buildings.every((b) => !(b.unitList ?? []).some((u) => u.label)) && (
        <p className="mt-3 text-xs text-bone-3">This building has no units yet — add one beside the model, or in Prime Tracker if the building is synced.</p>
      )}
      {step === 'units' &&
        buildings
          .filter((b) => b.building && (b.unitList ?? []).some((u) => u.label))
          .map((b) => {
            const units = (b.unitList ?? []).filter((u) => u.label)
            const sorted = [...units].sort(
              (x, y) =>
                Number(taggedUnits.has(siteUnitKey(b.building, x.label))) -
                Number(taggedUnits.has(siteUnitKey(b.building, y.label))),
            )
            return (
              <div key={b.building} className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wide text-bone-3">{b.building} · units</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {sorted.map((u) => {
                    const tagged = taggedUnits.has(siteUnitKey(b.building, u.label))
                    return (
                      <button
                        key={u.label}
                        type="button"
                        className={`${chip} ${tagged ? 'opacity-60' : ''}`}
                        onClick={() => onTag({ kind: 'unit', buildingLabel: b.building, unitLabel: u.label })}
                      >
                        {tagged ? '✓ ' : ''}Unit {u.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

      {step === 'roads' && (
        <div className="mt-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-bone-3">Road</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {roads.map((r) => (
              <button key={r.name} type="button" className={chip} onClick={() => onTag({ kind: 'road', roadName: r.name })}>
                {r.name}
              </button>
            ))}
            <button type="button" className={`${chip} border-dashed`} onClick={onNewRoad}>
              + New road
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Beside the 3D view on step 2: pick a unit, click its shape, fill it in.
// Selecting a unit arms it, so the next click in the model tags it; a tagged
// unit has an Untag button. The form is the same UnitFields the rest of the
// admin uses, photographs included. Each unit says where its details come
// from: Prime Tracker once the sync has linked it, otherwise this CMS.
// `onAdd` is null for a tracker-linked building, whose units the tracker adds.
function UnitSidePanel({ building, units, taggedUnits, armedUnitLabel, onArm, onUntag, onChangeUnit, onAdd, folder }) {
  const tagged = units.filter((u) => taggedUnits.has(siteUnitKey(building.building, u.label))).length
  const selected = units.find((u) => u.label && u.label === armedUnitLabel)
  return (
    <aside aria-label={`${building.building} units`} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/15 p-3 xl:max-h-[40rem] xl:overflow-y-auto">
      <div>
        <p className="text-sm font-medium text-bone">{building.building}</p>
        <p className="text-xs tabular-nums text-bone-3">
          {tagged} of {units.length} units tagged · 1. pick a unit, 2. click its shape in the model
        </p>
        <p className="mt-1 text-xs text-bone-3">
          {onAdd
            ? 'Prime Tracker has no units for this building, so they are added and edited here.'
            : 'Units come from Prime Tracker. What the tracker holds follows it — each unit’s form shows which fields; anything it has no data for, photographs and descriptions included, is edited here.'}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {units.map((u) => {
          const isTagged = taggedUnits.has(siteUnitKey(building.building, u.label))
          const active = Boolean(u.label) && u.label === armedUnitLabel
          return (
            <li key={u.index} className="flex items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => onArm(u.label)}
                disabled={!u.label}
                aria-pressed={active}
                className={`flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm disabled:opacity-40 ${
                  active ? 'border-ember bg-ember/10 text-bone' : 'border-white/15 text-bone-2 hover:border-white/30'
                }`}
              >
                <span className="font-medium">Unit {u.label || '(no label)'}</span>
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                  <span
                    className="rounded border border-white/15 px-1 text-bone-3"
                    title={isTrackerUnit(u) ? 'Details from Prime Tracker' : 'Details entered in this CMS'}
                  >
                    {isTrackerUnit(u) ? 'Tracker' : 'CMS'}
                  </span>
                  <span className="text-bone-3">{(STATUS_WORDS[u.status] ?? STATUS_WORDS.available).short}</span>
                  <span className={isTagged ? 'text-accent-soft' : 'text-ember'}>{isTagged ? '✓ Tagged' : 'Not tagged'}</span>
                </span>
              </button>
              {isTagged && (
                <button
                  type="button"
                  onClick={() => onUntag(u.label)}
                  aria-label={`Untag unit ${u.label}`}
                  className="min-h-11 cursor-pointer rounded-xl border border-red-400/40 px-3 text-xs font-bold uppercase tracking-wide text-red-300 hover:bg-red-400/10"
                >
                  Untag
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="min-h-11 cursor-pointer rounded-xl border border-dashed border-white/25 px-3 text-xs font-bold uppercase tracking-wide text-bone-2 hover:border-ember hover:text-ember"
        >
          + Add unit
        </button>
      ) : (
        <p className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-xs text-bone-3">
          A unit missing here is added in Prime Tracker and appears after the next sync.
        </p>
      )}
      {selected ? (
        <div className="flex flex-col gap-3 border-t border-white/10 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ember">Editing unit {selected.label}</p>
          <UnitFields unit={selected} onChange={(next) => onChangeUnit(selected.index, next)} folder={folder} />
        </div>
      ) : (
        <p className="border-t border-white/10 pt-3 text-xs text-bone-3">
          Pick a unit above, or click a tagged shape in the model, to edit its name, details and photographs here.
        </p>
      )}
    </aside>
  )
}
