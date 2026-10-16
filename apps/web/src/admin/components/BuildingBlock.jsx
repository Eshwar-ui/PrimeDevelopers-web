import { useMemo, useState } from 'react'
import { TextField, TextAreaField, CheckboxField } from './Field'
import ImageUploader from './ImageUploader'
import RepeatableList from './RepeatableList'
import FloorPlanPositionPicker from './FloorPlanPositionPicker'
import ModelManager from './ModelManager'
import UnitFields from './UnitFields'
import { applyUnitChange, getUnits, makeUnit, reconcile, unitFormId } from '../../lib/units'
import { FIGURES, makeInvestment, hasInvestmentData } from '../../lib/investment'

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

  // A rename keeps the unit's 3D link — see applyUnitChange in lib/units.
  const setUnitAt = (index, next) => onChange(applyUnitChange(building, index, next))

  const handlePlace = (x, y) => {
    if (placingUnitIndex === null) return
    setUnits(units.map((u, idx) => (idx === placingUnitIndex ? { ...u, x, y } : u)))
    setPlacingUnitIndex(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <span className="text-xs font-bold uppercase tracking-wide text-bone-3">
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
            makeItem={() => makeUnit()}
            addLabel="Add unit"
            renderItem={(unit, _set, i) => {
              const set = (next) => setUnitAt(i, next)
              const isBound = boundLabels?.has(String(unit.label ?? '').trim().toLowerCase())
              return (
                // Addressable so tap-to-tag in the model panel above can scroll
                // a just-created unit into view and focus its Label field.
                <div id={unitFormId(folder, i)} className="flex flex-col gap-3">
                  <UnitFields unit={unit} onChange={set} folder={folder} />

                  {/* One placement indicator, not two. With a model uploaded,
                      where the unit sits is the model's business and pins are
                      never touched. */}
                  {hasModel ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          isBound ? 'bg-[var(--color-status-available)] text-void' : 'bg-ember text-void'
                        }`}
                      >
                        {isBound ? 'Linked to 3D model' : 'No shape in model'}
                      </span>
                      {!isBound && (
                        <span className="text-xs text-bone-3">
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
                        className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-bone/70 hover:border-ember hover:text-ember disabled:opacity-40"
                      >
                        {unit.x != null ? 'Reposition on map' : 'Place on map'}
                      </button>
                      <span className="text-xs text-bone-3">
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
        <span className="text-xs font-bold uppercase tracking-wide text-bone-3">
          2D floor plan image — fallback only
        </span>
        <p className="mt-1 text-xs leading-relaxed text-bone-3">
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

      {/* ── 4. The building as an asset ────────────────────────── */}
      <InvestmentFields building={building} onChange={onChange} />
    </div>
  )
}

/**
 * CAP-rate figures for this building, powering its investment page.
 *
 * Separate from everything above it because it answers to a different reader.
 * The unit list describes space to a tenant; this describes a yield to a
 * buyer, and the two are maintained by different people at different times.
 *
 * Nothing here is required. The page omits any figure left blank, so a
 * building with two of the nine filled in still reads as finished — which
 * matters, because these arrive one rate sheet at a time.
 */
function InvestmentFields({ building, onChange }) {
  const investment = building.investment ?? makeInvestment()
  const set = (patch) => onChange({ ...building, investment: { ...investment, ...patch } })
  const populated = hasInvestmentData({ ...building, investment })
  const highlights = investment.highlights ?? []

  return (
    <div className="rounded-lg border border-white/10 bg-void/40 p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-bone-3">
        Investment / CAP rate
      </span>
      <p className="mt-1 text-xs leading-relaxed text-bone-3">
        Powers this building&rsquo;s investment page. Leave anything you do not have blank — blank
        figures are left off the page rather than shown empty. The unit schedule on that page is
        read from the units above, so there is nothing to re-enter here.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {FIGURES.map(({ key, label, placeholder }) => (
          <TextField
            key={key}
            label={label}
            value={investment[key]}
            placeholder={placeholder}
            onChange={(v) => set({ [key]: v })}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <TextAreaField
          label="Summary"
          rows={3}
          placeholder="Single-tenant flex building fully let to…"
          value={investment.summary}
          onChange={(summary) => set({ summary })}
        />

        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Highlights</span>
          <p className="mb-3 mt-1 text-xs leading-relaxed text-bone-3">
            Short selling points — one per row, shown as a list beside the summary.
          </p>
          <RepeatableList
            items={highlights}
            onChange={(next) => set({ highlights: next })}
            makeItem={() => ''}
            addLabel="Add highlight"
            renderItem={(value, setValue) => (
              <TextField
                value={value}
                placeholder="NNN lease with 3% annual escalations"
                onChange={setValue}
              />
            )}
          />
        </div>

        <TextField
          label="CAP rate flyer URL"
          placeholder="https://…"
          value={investment.flyerUrl}
          onChange={(flyerUrl) => set({ flyerUrl })}
        />

        <CheckboxField
          label="Publish this investment page"
          hint={
            populated
              ? 'Links to it appear in the property\u2019s Resources section. The page is reachable by URL either way, so you can preview it first.'
              : 'Nothing is filled in yet — until something is, this stays unlinked even when ticked.'
          }
          value={investment.published}
          onChange={(published) => set({ published })}
        />
      </div>
    </div>
  )
}
