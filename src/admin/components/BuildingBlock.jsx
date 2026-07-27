import { useState } from 'react'
import { TextField, SelectField } from './Field'
import ImageUploader from './ImageUploader'
import RepeatableList from './RepeatableList'
import FloorPlanPositionPicker from './FloorPlanPositionPicker'
import { UNIT_STATUSES } from '../../lib/unitStatus'

// One building's full editor: basics, the uploaded floor plan image, and its
// units — each placeable directly on that image via click-to-place. Pulled
// out to its own component (rather than an inline RepeatableList renderItem)
// specifically so it can hold its own `placingUnitIndex` state.
export default function BuildingBlock({ building, onChange, folder }) {
  const [placingUnitIndex, setPlacingUnitIndex] = useState(null)
  const units = building.unitList ?? []

  const setUnits = (unitList) => onChange({ ...building, unitList })

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

      <div className="rounded-lg border border-white/10 bg-void/40 p-3">
        <span className="text-xs font-bold uppercase tracking-wide text-bone/45">
          Interactive floor plan — upload the real floor plan, then place each unit on it
        </span>

        <div className="mt-3">
          <ImageUploader
            label="Floor plan image"
            value={building.planImage}
            onChange={(planImage) => onChange({ ...building, planImage })}
            folder={`${folder}/floor-plan`}
          />
        </div>

        <div className="mt-3">
          <FloorPlanPositionPicker
            image={building.planImage}
            units={units}
            placingIndex={placingUnitIndex}
            onClickImage={handlePlace}
          />
        </div>

        <div className="mt-4">
          <RepeatableList
            items={units}
            onChange={setUnits}
            makeItem={() => ({ label: '', status: 'available', tenant: '', size: '', x: null, y: null })}
            addLabel="Add unit"
            renderItem={(unit, set, i) => (
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
                </div>
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
              </div>
            )}
          />
        </div>
      </div>
    </div>
  )
}
