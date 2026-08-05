import { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react'
import { uploadImage, uploadModel } from '../../lib/uploads'
import { inspectGlb, triangleWarning, validateModelFile } from '../../lib/glbInspect'
import {
  diffModels,
  formatBytes,
  getUnits,
  makeUnit,
  meshUnitLabel,
  nextUnitLabel,
  pruneBindings,
  reconcile,
  unitFormId,
} from '../../lib/units'

const ModelViewer = lazy(() => import('../../components/floorplan/ModelViewer'))

// Upload alone does not make this feature self-service — reconciliation does.
// This panel is the difference between an admin publishing a building unaided
// and filing a ticket, so it deliberately speaks in "shapes" and "units" and
// never says mesh, node, glTF or Draco.
export default function ModelManager({ building, onChange, folder }) {
  const inputRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [armedIndex, setArmedIndex] = useState(null)
  // Off by default. Tapping creates records, and orbiting a model of hundreds
  // of polygons would otherwise strew junk units behind every stray click.
  const [tagMode, setTagMode] = useState(false)

  const model = building.model ?? null
  const units = useMemo(() => getUnits(building), [building])
  // Memoised, not inlined as `model.bindings ?? {}`. A fresh object identity
  // each render would recompute the viewer's mesh→unit map, which re-runs the
  // effect that reports camera frames, which sets state, which re-renders —
  // an infinite loop. It only holds today because commit() always writes a
  // bindings object; a record without one would hang the editor.
  const bindings = useMemo(() => model?.bindings ?? {}, [model])
  const report = useMemo(
    () => reconcile(model?.meshNames ?? [], units, bindings),
    [model, units, bindings],
  )
  const flagged = useMemo(() => new Set(report.unmatched), [report])

  const setModel = (next) => onChange({ ...building, model: next })

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
      // Parsed before upload, so a bad model is caught while the admin still
      // has the file in hand rather than after a slow upload.
      const inspected = await inspectGlb(file)
      setPending({ file, ...inspected, diff: diffModels(model?.meshNames ?? [], inspected.meshNames) })
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
      setModel({
        url,
        poster: model?.poster ?? '',
        uploadedAt: new Date().toISOString(),
        fileSize: pending.fileSize,
        triangles: pending.triangles,
        meshNames: pending.meshNames,
        // Bindings survive a re-upload wherever their shape still exists —
        // losing one should require the shape to actually be gone.
        bindings: pruneBindings(model?.bindings ?? {}, pending.meshNames),
      })
      setPending(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // The poster is the still visitors see before they tap into 3D. Capturing it
  // from the live view means there is no second image to source, shoot or keep
  // in step — orbit to a good angle and the poster *is* the model.
  const capture = useRef(null)
  const holdCapture = useCallback((fn) => {
    capture.current = fn
  }, [])

  const capturePoster = async () => {
    if (!capture.current) return
    setBusy(true)
    setError(null)
    try {
      const blob = await capture.current()
      if (!blob) throw new Error('Could not capture the current view.')
      const url = await uploadImage(new File([blob], 'poster.jpg', { type: 'image/jpeg' }), `${folder}/model`)
      setModel({ ...model, poster: url })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const bind = (meshName, unitLabel) => {
    const next = { ...(model?.bindings ?? {}) }
    if (unitLabel) next[meshName] = unitLabel
    else delete next[meshName]
    setModel({ ...model, bindings: next })
    setArmedIndex(null)
  }

  /** Arm-then-click binds the whole block too, so both routes to a binding
   *  produce the same result rather than one tagging a single wall panel. */
  const bindBlock = (meshNames, unitLabel) => {
    const next = { ...(model?.bindings ?? {}) }
    for (const name of meshNames) {
      if (unitLabel) next[name] = unitLabel
      else delete next[name]
    }
    setModel({ ...model, bindings: next })
    setArmedIndex(null)
  }

  // Armed by index, never by label. A label is user-entered and may be blank,
  // and a blank one is falsy — arming by label meant an unlabelled unit set the
  // armed state to "", which read as "nothing armed": the prompt never showed,
  // picking never switched on, and clicking the unit appeared to do nothing at
  // all. Index is the identity `units.js` already hands out for exactly this.
  const armedUnit = armedIndex === null ? null : (units.find((u) => u.index === armedIndex) ?? null)
  // Bindings persist a label, so a unit without one cannot be bound to a shape
  // however it is armed. Better to say so than to accept a click that silently
  // does nothing.
  const armedLabel = armedUnit?.label?.trim() || ''
  const canPick = armedUnit !== null && armedLabel !== ''

  /**
   * Tap-to-tag: create a unit straight from a shape.
   *
   * The reverse of arming a unit and hunting for its shape, and the better
   * order when the model is the thing you can actually recognise — converter
   * output has no names to go on, so the shape is the only handle an admin has.
   */
  const tagShape = (meshName, block) => {
    // Already spoken for? Take them to that unit rather than making a second
    // one for the same shape.
    const existing = bindings[meshName] ?? meshUnitLabel(meshName)
    if (existing) {
      const found = units.find(
        (u) => String(u.label ?? '').trim().toLowerCase() === String(existing).trim().toLowerCase(),
      )
      if (found) {
        focusUnitForm(found.index)
        return
      }
    }

    const label = nextUnitLabel(units)
    // Every panel of the block points at the one unit, which is what the
    // bindings map already expresses — so a whole shop lights up and responds
    // to a click, not the single wall the ray hit.
    const nextBindings = { ...bindings }
    for (const name of block?.length ? block : [meshName]) nextBindings[name] = label

    const unitList = [...(building.unitList ?? []), makeUnit(label)]
    onChange({
      ...building,
      unitList,
      model: { ...model, bindings: nextBindings },
    })
    focusUnitForm(unitList.length - 1)
  }

  /** Scrolls the unit's form into view and puts the cursor in its Label field,
   *  since the auto-assigned number is the first thing worth correcting. */
  const focusUnitForm = (index) => {
    // Deferred: the row for a just-created unit has not rendered yet.
    requestAnimationFrame(() => {
      const row = document.getElementById(unitFormId(folder, index))
      if (!row) return
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.querySelector('input')?.focus()
    })
  }

  const pendingReport = pending ? reconcile(pending.meshNames, units, model?.bindings ?? {}) : null

  return (
    <div className="rounded-lg border border-white/10 bg-void/40 p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-bone/45">
        Interactive 3D model — upload a .glb and bind its shapes to units
      </span>

      {/* ── current model ─────────────────────────────────────────── */}
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
            <span className="text-[11px] text-bone/40">
              {formatBytes(model.fileSize)} · {Number(model.triangles ?? 0).toLocaleString()} triangles ·{' '}
              {report.matched.length} of {units.length} units bound
            </span>
            <button
              type="button"
              onClick={() => {
                setTagMode((on) => !on)
                setArmedIndex(null) // the two picking modes would fight over a click
              }}
              aria-pressed={tagMode}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                tagMode
                  ? 'border-ember bg-ember text-void'
                  : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
              }`}
            >
              {tagMode ? 'Done tagging' : 'Tag units by tapping'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove the 3D model? The building falls back to its 2D floor plan.')) setModel(null)
              }}
              className="text-[11px] text-bone/40 hover:text-red-400"
            >
              Remove
            </button>
          </>
        )}
        <input ref={inputRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={onFile} />
      </div>

      {error && <p className="mt-3 text-xs leading-relaxed text-red-400">{error}</p>}

      {/* ── pending upload: report + diff shown BEFORE anything commits ── */}
      {pending && (
        <div className="mt-4 rounded-lg border border-ember/40 bg-ember/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ember">Review before saving</p>
          <p className="mt-2 text-xs leading-relaxed text-bone/70">
            {pendingReport.matched.length} of {units.length} units matched a shape in this model.
          </p>
          {pendingReport.unmatched.length > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-bone/55">
              {pendingReport.unmatched.length} shape{pendingReport.unmatched.length === 1 ? '' : 's'} did not match any
              unit: {pendingReport.unmatched.join(', ')} — you can bind these after saving.
            </p>
          )}
          {pendingReport.unmodelled.length > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-bone/55">
              {pendingReport.unmodelled.length} unit{pendingReport.unmodelled.length === 1 ? '' : 's'} have no shape:{' '}
              {pendingReport.unmodelled.map((u) => u.label || '(unnamed)').join(', ')} — they stay visible in the unit
              list and 2D plan.
            </p>
          )}
          {model?.url && (
            <p className="mt-2 text-xs leading-relaxed text-bone/55">
              Compared to the current model: {pending.diff.retained.length} shapes unchanged,{' '}
              {pending.diff.removed.length} removed{pending.diff.removed.length ? ` (${pending.diff.removed.join(', ')})` : ''},{' '}
              {pending.diff.added.length} new{pending.diff.added.length ? ` (${pending.diff.added.join(', ')})` : ''}.
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

      {/* ── reconciliation for the saved model ────────────────────── */}
      {model?.url && (
        <>
          {(report.unmatched.length > 0 || report.unmodelled.length > 0) && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/10 p-3">
              {report.unmatched.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ember">
                    {report.unmatched.length} shape{report.unmatched.length === 1 ? '' : 's'} not matched to a unit
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {report.unmatched.map((meshName) => (
                      <div key={meshName} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-bone/60">{meshName}</span>
                        <select
                          value={model.bindings?.[meshName] ?? ''}
                          onChange={(e) => bind(meshName, e.target.value)}
                          className="rounded-md border border-white/15 bg-void px-2 py-1 text-[11px] text-bone/80"
                        >
                          <option value="">Not a unit — leave as scenery</option>
                          {report.unmodelled.map((unit) => (
                            <option key={unit.index} value={unit.label}>
                              {unit.label || `Unit ${unit.index + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.unmodelled.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-bone/45">
                    {report.unmodelled.length} unit{report.unmodelled.length === 1 ? '' : 's'} with no shape in the model
                  </p>
                  <p className="mt-1 text-[11px] text-bone/35">
                    These still appear in the unit list and on the 2D plan — they just cannot be clicked in 3D.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {report.unmodelled.map((unit) => (
                      <button
                        key={unit.index}
                        type="button"
                        onClick={() => setArmedIndex(armedIndex === unit.index ? null : unit.index)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                          armedIndex === unit.index
                            ? 'border-ember bg-ember text-void'
                            : 'border-white/20 text-bone/70 hover:border-ember hover:text-ember'
                        }`}
                      >
                        {unit.label || `Unit ${unit.index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative mt-4">
            {(armedUnit || tagMode) && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-ember px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-void">
                {armedUnit
                  ? canPick
                    ? `Click the shape in the model that is unit ${armedLabel}`
                    : 'Give this unit a label before binding it to a shape'
                  : 'Tap a shape to create a unit for it'}
              </div>
            )}
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center rounded-lg border border-white/10 text-xs text-bone/40">
                  Loading preview…
                </div>
              }
            >
              <ModelViewer
                url={model.url}
                units={units}
                bindings={bindings}
                selectedIndex={null}
                onSelect={() => {}}
                statusFilter={null}
                flaggedMeshes={flagged}
                onMeshClick={
                  canPick
                    ? (meshName, block) => bindBlock(block ?? [meshName], armedLabel)
                    : tagMode
                      ? tagShape
                      : undefined
                }
                onCaptureReady={holdCapture}
                height="h-64 md:h-80"
              />
            </Suspense>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={capturePoster}
                disabled={busy}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-bone/70 hover:border-ember hover:text-ember disabled:opacity-40"
              >
                {model.poster ? 'Update preview image' : 'Use this view as preview image'}
              </button>
              <span className="text-[11px] text-bone/35">
                {model.poster
                  ? 'Visitors see this still before tapping into 3D.'
                  : 'Orbit to a good angle, then capture the still visitors see before tapping into 3D.'}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-bone/35">
              This is exactly what a visitor sees. Unbound shapes are highlighted in orange.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
