import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { uploadModel } from '../../lib/uploads'
import { inspectGlb, triangleWarning, validateModelFile } from '../../lib/glbInspect'
import { formatBytes, getUnits, makeUnit, nextUnitLabel } from '../../lib/units'
import {
  bindSiteMeshes,
  diffSiteModel,
  findBuildingByLabel,
  makeRoad,
  pruneSiteBindings,
  reconcileSite,
  toViewerEntries,
} from '../../lib/siteModel'

const ModelViewer = lazy(() => import('../../components/floorplan/ModelViewer'))

const TABS = [
  { key: 'buildings', label: 'Buildings' },
  { key: 'units', label: 'Units' },
  { key: 'roads', label: 'Roads' },
]

/**
 * The whole-property counterpart to ModelManager.jsx — one GLB covering every
 * building on the site, tagged building/unit/road-wise instead of one GLB per
 * building.
 *
 * Building creation stays in the Floor Plans section above (it already has a
 * full form for area/units/parking); this panel only *tags* buildings that
 * already exist there. Units and roads, which have no other creation UI, can
 * be created straight from a tap — the same "arm-then-click, or tap-to-create"
 * pattern ModelManager already uses for units.
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

  const model = siteModel ?? null
  // Memoised rather than `model?.meshNames ?? []`: a fresh array identity
  // every render (whenever there is no model yet) would recompute `report`
  // and `entries` continuously, which ModelViewer's own memoisation keys on —
  // same reason ModelManager.jsx memoises `bindings`.
  const meshNames = useMemo(() => model?.meshNames ?? [], [model])
  const roads = model?.roads ?? []

  const report = useMemo(() => reconcileSite(meshNames, buildings, model), [meshNames, buildings, model])
  const entries = useMemo(() => toViewerEntries(report), [report])
  const flagged = useMemo(() => (showUnbound ? new Set(report.unbound) : new Set()), [showUnbound, report])

  const armedBuilding = findBuildingByLabel(buildings, armedBuildingLabel)
  const armedBuildingUnits = armedBuilding ? getUnits(armedBuilding) : []

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

  /** Tap-to-create a unit, mirroring ModelManager's tagShape(): only offered
   *  once a building is armed on the Units tab, since a unit has to belong to
   *  one. */
  const createUnitFromTap = (names) => {
    if (!armedBuilding) return
    const label = nextUnitLabel(armedBuildingUnits)
    const unitList = [...(armedBuilding.unitList ?? []), makeUnit(label)]
    const nextBuildings = buildings.map((b) => (b === armedBuilding ? { ...b, unitList } : b))
    onBuildingsChange(nextBuildings)
    setModel(bindSiteMeshes(model, names, { kind: 'unit', buildingLabel: armedBuildingLabel, unitLabel: label }))
  }

  const onMeshClick = (meshName, block) => {
    const names = block?.length ? block : [meshName]

    if (multiSelect) {
      setPendingMeshNames((prev) => Array.from(new Set([...prev, ...names])))
      return
    }

    const target = armedTarget()
    if (target) {
      bindNames(names, target)
      return
    }
    if (tab === 'units' && tagUnitMode && armedBuilding) {
      createUnitFromTap(names)
    }
  }

  const commitPendingSelection = () => {
    const target = armedTarget()
    if (!target || !pendingMeshNames.length) return
    bindNames(pendingMeshNames, target)
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
            <span className="text-[11px] text-bone-3">
              {formatBytes(model.fileSize)} · {Number(model.triangles ?? 0).toLocaleString()} triangles ·{' '}
              {report.resolved.length} of {meshNames.length} shapes tagged
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove the whole-site model? The public page falls back to per-building floor plans.')) setModel(null)
              }}
              className="text-[11px] text-bone-3 hover:text-red-400"
            >
              Remove
            </button>
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
                }}
                aria-pressed={tab === t.key}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  tab === t.key ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                }`}
              >
                Tag {t.label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-white/15" />
            <label className="flex items-center gap-1.5 text-[11px] text-bone/70">
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
            <label className="flex items-center gap-1.5 text-[11px] text-bone/70">
              <input type="checkbox" checked={showUnbound} onChange={(e) => setShowUnbound(e.target.checked)} />
              Highlight untagged shapes ({report.unbound.length})
            </label>
          </div>

          {/* Buildings tab: arm one that already exists in Floor Plans above. */}
          {tab === 'buildings' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {buildings.length === 0 && (
                <p className="text-[11px] text-bone-3">Add a building in Floor Plans above first — this panel only tags buildings that already exist.</p>
              )}
              {buildings.map((b) => (
                <button
                  key={b.building || Math.random()}
                  type="button"
                  onClick={() => setArmedBuildingLabel(armedBuildingLabel === b.building ? '' : b.building)}
                  disabled={!b.building}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40 ${
                    armedBuildingLabel === b.building ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                  }`}
                >
                  {b.building || '(unnamed — set a name above first)'}
                </button>
              ))}
            </div>
          )}

          {/* Units tab: pick a building first (scopes which unit list), then a unit, or tap-to-create. */}
          {tab === 'units' && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-bone-3">Building:</span>
                {buildings.map((b) => (
                  <button
                    key={b.building || Math.random()}
                    type="button"
                    onClick={() => {
                      setArmedBuildingLabel(armedBuildingLabel === b.building ? '' : b.building)
                      setArmedUnitLabel('')
                    }}
                    disabled={!b.building}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40 ${
                      armedBuildingLabel === b.building ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                    }`}
                  >
                    {b.building || '(unnamed)'}
                  </button>
                ))}
              </div>
              {armedBuilding && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-bone-3">Unit:</span>
                  {armedBuildingUnits.map((u) => (
                    <button
                      key={u.index}
                      type="button"
                      onClick={() => setArmedUnitLabel(armedUnitLabel === u.label ? '' : u.label)}
                      disabled={!u.label}
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40 ${
                        armedUnitLabel === u.label ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                      }`}
                    >
                      {u.label || '(unlabelled)'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTagUnitMode((on) => !on)
                      setArmedUnitLabel('')
                    }}
                    aria-pressed={tagUnitMode}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      tagUnitMode ? 'border-ember bg-ember text-void' : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                    }`}
                  >
                    {tagUnitMode ? 'Done — stop creating new units' : '+ New unit by tapping'}
                  </button>
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
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
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
                  className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-bone/70 hover:border-ember hover:text-ember"
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
              <span className="text-[11px] text-bone/80">
                {pendingMeshNames.length} shape{pendingMeshNames.length === 1 ? '' : 's'} selected — use this for shapes
                that won't group together on their own.
              </span>
              <button
                type="button"
                onClick={commitPendingSelection}
                disabled={!pendingMeshNames.length || !armedTarget()}
                className="rounded-full bg-ember px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-void disabled:opacity-40"
              >
                Bind selected as one
              </button>
              <button
                type="button"
                onClick={() => setPendingMeshNames([])}
                disabled={!pendingMeshNames.length}
                className="text-[11px] text-bone-3 hover:text-ember disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          )}

          {/* ── coverage summary ─────────────────────────────────── */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-[11px] text-bone-3">
            <span>{report.unmodelledBuildings.length} building{report.unmodelledBuildings.length === 1 ? '' : 's'} not yet tagged</span>
            <span>{report.unmodelledUnits.length} unit{report.unmodelledUnits.length === 1 ? '' : 's'} not yet tagged</span>
            <span>{report.unmodelledRoads.length} road{report.unmodelledRoads.length === 1 ? '' : 's'} not yet tagged</span>
          </div>
          {report.staleBindings.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-ember">
              {report.staleBindings.length} shape{report.staleBindings.length === 1 ? ' points' : 's point'} at a
              building/unit/road that no longer exists — will be dropped on the next upload.
            </p>
          )}

          {/* ── viewer ───────────────────────────────────────────── */}
          <div className="relative mt-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-ember px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-void">
              {armedTarget()
                ? multiSelect
                  ? `Click shapes to add them to the selection`
                  : `Click the shape${tab === 'buildings' ? ' — or shapes — that make up' : ' that is'} ${
                      tab === 'buildings' ? armedBuildingLabel : tab === 'units' ? armedUnitLabel : armedRoadName
                    }`
                : tab === 'units' && tagUnitMode
                  ? 'Tap a shape to create a new unit for it'
                  : `Arm a ${tab === 'buildings' ? 'building' : tab === 'units' ? 'unit' : 'road'} above, then click its shape in the model`}
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
                defaultMode="3d"
                darkGround
                orientation={Number.isFinite(model.orientation) ? model.orientation : null}
                onSelect={() => {}}
                statusFilter={null}
                flaggedMeshes={flagged}
                onMeshClick={onMeshClick}
                height="h-64 md:h-80"
              />
            </Suspense>
            <p className="mt-2 text-[11px] text-bone-3">This is exactly what a visitor sees. Untagged shapes are highlighted in orange when the toggle above is on.</p>
          </div>
        </>
      )}
    </div>
  )
}
