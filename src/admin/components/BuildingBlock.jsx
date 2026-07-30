import { useMemo, useState } from 'react'
import { TextField, TextAreaField, SelectField } from './Field'
import ImageUploader from './ImageUploader'
import RepeatableList from './RepeatableList'
import FloorPlanPositionPicker from './FloorPlanPositionPicker'
import ModelManager from './ModelManager'
import { UNIT_STATUSES } from '../../lib/unitStatus'
import { getUnits, meshUnitLabel, reconcile } from '../../lib/units'

// One building's full editor.
//
// The 3D model is the primary geometry source: when one is uploaded it is the
// only thing that decides where a unit sits, and the plan view visitors see is
// the top-down projection of that same model. The uploaded plan image is
// therefore demoted to a fallback for buildings that have no model — it is not
// a second thing to keep in step.
//
// Unit details are entered once, here, and feed the 3D view, the plan view,
// the unit list and the detail card without being re-entered anywhere.
export default function BuildingBlock({ building, onChange, folder }) {
  const [placingUnitIndex, setPlacingUnitIndex] = useState(null)
  const units = useMemo(() => building.unitList ?? [], [building.unitList])
  const model = building.model ?? null
  const hasModel = Boolean(model?.url)

  const boundLabels = useMemo(() => {
    if (!hasModel) return null
    const report = reconcile(model.meshNames ?? [], getUnits(building), model.bindings ?? {})
    return new Set(report.matched.map(({ unit }) => String(unit.label ?? '').trim().toLowerCase()))
  }, [hasModel, model, building])

  // Two units sharing a label is silently destructive: only the first can ever
  // bind to a shape, and the second disappears from 3D with no explanation.
  const duplicateLabels = useMemo(() => {
    const seen = new Set()
    const dupes = new Set()
    for (const unit of units) {
      const key = String(unit.label ?? '').trim().toLowerCase()
      if (!key) continue
      if (seen.has(key)) dupes.add(key)
      seen.add(key)
    }
    return dupes
  }, [units])

  const setUnits = (unitList) => onChange({ ...building, unitList })

  /**
   * Renaming a unit would otherwise break its link to the model: matching is
   * by label, so `301` → `301A` leaves whatever shape was linked to `301`
   * matching nothing.
   *
   * Two cases, both handled: a shape named `unit-301` was linked by *name*
   * (nothing stored — the match was implicit), or some other shape had been
   * *manually* bound to `301` from the reconciliation panel (an explicit
   * `bindings` entry, because its name didn't match). Either way, whatever
   * mesh currently resolves to the old label is re-pointed at the new one, so
   * the link survives the rename instead of silently going stale.
   */
  const setUnitAt = (index, next) => {
    const previous = units[index]
    const unitList = units.map((unit, i) => (i === index ? next : unit))

    const wasLabel = String(previous?.label ?? '').trim().toLowerCase()
    const nowLabel = String(next?.label ?? '').trim()
    if (!hasModel || !wasLabel || !nowLabel || wasLabel === nowLabel.toLowerCase()) {
      onChange({ ...building, unitList })
      return
    }

    const bindings = model.bindings ?? {}
    const explicitMatch = Object.entries(bindings).find(([, label]) => String(label ?? '').trim().toLowerCase() === wasLabel)
    const meshName =
      explicitMatch?.[0] ??
      (model.meshNames ?? []).find((name) => (meshUnitLabel(name) ?? '').toLowerCase() === wasLabel)

    onChange({
      ...building,
      unitList,
      model: meshName ? { ...model, bindings: { ...bindings, [meshName]: nowLabel } } : model,
    })
  }

  const handlePlace = (x, y) => {
    if (placingUnitIndex === null) return
    setUnits(units.map((u, idx) => (idx === placingUnitIndex ? { ...u, x, y } : u)))
    setPlacingUnitIndex(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Building" value={building.building} onChange={(v) => onChange({ ...building, building: v })} />
        <TextField label="Area (sq ft)" value={building.area} onChange={(v) => onChange({ ...building, area: v })} />
        <TextField label="Number" value={building.number} onChange={(v) => onChange({ ...building, number: v })} />
        <TextField label="Units" value={building.units} onChange={(v) => onChange({ ...building, units: v })} />
        <TextField label="Available" value={building.available} onChange={(v) => onChange({ ...building, available: v })} />
        <TextField label="Parking" value={building.parking} onChange={(v) => onChange({ ...building, parking: v })} />
      </div>

      {/* ── 1. Geometry: the 3D model ──────────────────────────── */}
      <ModelManager building={building} onChange={onChange} folder={folder} />

      {/* ── 2. Details: entered once, used everywhere ──────────── */}
      <div className="rounded-lg border border-white/10 bg-void/40 p-3">
        <span className="text-xs font-bold uppercase tracking-wide text-bone/45">
          Units — these details drive the 3D model, the plan view, the unit list and the detail card
        </span>

        {duplicateLabels.size > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-red-400">
            Two units share the same label ({[...duplicateLabels].join(', ')}). Only the first can be linked to a shape
            in the 3D model — give each unit a unique label.
          </p>
        )}

        <div className="mt-4">
          <RepeatableList
            items={units}
            onChange={setUnits}
            makeItem={() => ({
              label: '',
              status: 'available',
              tenant: '',
              size: '',
              floor: '',
              rate: '',
              frontage: '',
              description: '',
              x: null,
              y: null,
            })}
            addLabel="Add unit"
            renderItem={(unit, _set, i) => {
              const set = (next) => setUnitAt(i, next)
              const isBound = boundLabels?.has(String(unit.label ?? '').trim().toLowerCase())
              return (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Label" placeholder="Unit 101" value={unit.label} onChange={(label) => set({ ...unit, label })} />
                    <SelectField label="Status" value={unit.status} onChange={(status) => set({ ...unit, status })} options={UNIT_STATUSES} />
                    <TextField
                      label="Tenant / use (if any)"
                      placeholder="Kalyan Jewellers"
                      value={unit.tenant}
                      onChange={(tenant) => set({ ...unit, tenant })}
                    />
                    <TextField label="Size (sq ft)" value={unit.size} onChange={(size) => set({ ...unit, size })} />
                    <TextField label="Floor / level" placeholder="Ground" value={unit.floor} onChange={(floor) => set({ ...unit, floor })} />
                    <TextField
                      label="Lease rate / price"
                      placeholder="$28 / SF / yr"
                      value={unit.rate}
                      onChange={(rate) => set({ ...unit, rate })}
                    />
                    <TextField
                      label="Frontage"
                      placeholder="32 ft on Leora Ln"
                      value={unit.frontage}
                      onChange={(frontage) => set({ ...unit, frontage })}
                    />
                  </div>
                  {/* Everything below is what a prospect actually reads when
                      they tap the unit — each field is optional and simply
                      omitted from the card when left blank. */}
                  <TextAreaField
                    label="Unit description"
                    rows={3}
                    placeholder="Corner suite with dock access and 18ft clear height…"
                    value={unit.description}
                    onChange={(description) => set({ ...unit, description })}
                  />

                  {/* One placement indicator, not two. With a model uploaded,
                      where the unit sits is the model's business and pins are
                      never touched. */}
                  {hasModel ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                          isBound ? 'bg-[var(--color-status-available)] text-void' : 'bg-ember text-void'
                        }`}
                      >
                        {isBound ? 'Linked to 3D model' : 'No shape in model'}
                      </span>
                      {!isBound && (
                        <span className="text-[11px] text-bone/35">
                          Still shown in the unit list — link it in the 3D model panel above.
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPlacingUnitIndex(i)}
                        disabled={!building.planImage}
                        className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-bone/70 hover:border-ember hover:text-ember disabled:opacity-40"
                      >
                        {unit.x != null ? 'Reposition on map' : 'Place on map'}
                      </button>
                      <span className="text-[11px] text-bone/35">
                        {unit.x != null ? `Placed at ${unit.x.toFixed(0)}%, ${unit.y.toFixed(0)}%` : 'Not placed yet'}
                      </span>
                    </div>
                  )}
                </div>
              )
            }}
          />
        </div>
      </div>

      {/* ── 3. Fallback only ───────────────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-void/40 p-3">
        <span className="text-xs font-bold uppercase tracking-wide text-bone/45">
          2D floor plan image — fallback only
        </span>
        <p className="mt-1 text-[11px] leading-relaxed text-bone/40">
          {hasModel
            ? 'Not needed for this building. Visitors get the 3D model, and its plan view is generated from the same model — this image is only used if the model fails to load on an old device.'
            : 'Used when a building has no 3D model. Upload the plan, then place each unit on it.'}
        </p>

        <div className="mt-3">
          <ImageUploader
            label="Floor plan image"
            value={building.planImage}
            onChange={(planImage) => onChange({ ...building, planImage })}
            folder={`${folder}/floor-plan`}
          />
        </div>

        {!hasModel && (
          <div className="mt-3">
            <FloorPlanPositionPicker
              image={building.planImage}
              units={units}
              placingIndex={placingUnitIndex}
              onClickImage={handlePlace}
            />
          </div>
        )}
      </div>
    </div>
  )
}
