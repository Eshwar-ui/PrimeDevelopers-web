import { useEffect, useMemo, useRef, useState } from 'react'
import { TextField, TextAreaField, CheckboxField } from './Field'
import ImageUploader from './ImageUploader'
import RepeatableList from './RepeatableList'
import ChipTabs from './ChipTabs'
import { ConfirmButton, IconButton } from './ui'
import { ArrowLeft, ArrowRight, Cube, X } from '@phosphor-icons/react'
import { STATUS_WORDS, unitHas3D, unitMissing } from '../completeness'
import FloorPlanPositionPicker from './FloorPlanPositionPicker'
import ModelManager from './ModelManager'
import UnitFields from './UnitFields'
import { applyUnitChange, getUnits, makeUnit, nextUnitLabel, reconcile, unitFormId } from '../../lib/units'
import { FIGURES, makeInvestment, hasInvestmentData } from '../../lib/investment'
import { mergeFields, resolveNext } from '../adminUtils'
import { TRACKER_MANAGED, isTrackerUnit, siteLinkedUnits, unitLabelProblems, unitPlacement } from '../unitChecks'

// One building's full editor.
//
// The 3D model is the primary geometry source: when one is uploaded it is the
// only thing that decides where a unit sits, and the plan view visitors see is
// the top-down projection of that same model. The uploaded plan image is
// therefore demoted to a fallback for buildings that have no model — it is not
// a second thing to keep in step.
//
// That model is either the building's own (`building.model`) or, on a property
// like Centro Plaza, one model of the whole site (`siteModel`, passed in from
// the property). Either way a unit's place is a 3D link, and the 2D pins below
// are only for buildings with neither.
//
// Unit details are entered once, here, and feed the 3D view, the plan view,
// the unit list and the detail card without being re-entered anywhere.
//
// Every change goes up as an updater of the building (see resolveNext in
// adminUtils), never as a copy of `building` — a photo upload that lands
// later would otherwise put back the whole buildings list as it was.
export default function BuildingBlock({ building, onChange, folder, siteModel = null }) {
  const [placingUnitIndex, setPlacingUnitIndex] = useState(null)
  const [selectedUnit, setSelectedUnit] = useState(0)
  const units = useMemo(() => building.unitList ?? [], [building.unitList])
  const model = building.model ?? null
  const hasModel = Boolean(model?.url)
  const siteLinked = useMemo(() => siteLinkedUnits(siteModel), [siteModel])
  // Pins are for buildings with no 3D geometry at all.
  const placedIn3D = Boolean(siteLinked) || hasModel

  const boundLabels = useMemo(() => {
    if (!hasModel) return null
    const report = reconcile(model.meshNames ?? [], getUnits(building), model.bindings ?? {})
    return new Set(report.matched.map(({ unit }) => String(unit.label ?? '').trim().toLowerCase()))
  }, [hasModel, model, building])

  // Empty and duplicated labels block the property's save (PropertyEditPage
  // runs the same check); overlaps only warn. Shown here, next to the units.
  const labelProblems = useMemo(() => unitLabelProblems([{ ...building, unitList: units }]), [building, units])

  const setField = (key) => (value) => onChange((b) => ({ ...b, [key]: value }))
  const setUnits = (unitList) => onChange((b) => ({ ...b, unitList: resolveNext(unitList, b.unitList ?? []) }))

  // A rename keeps the unit's 3D link — see applyUnitChange in lib/units.
  const setUnitAt = (index, next) =>
    onChange((b) => applyUnitChange(b, index, resolveNext(next, (b.unitList ?? [])[index])))

  const handlePlace = (x, y) => {
    if (placingUnitIndex === null) return
    const index = placingUnitIndex
    setUnits((list) => list.map((u, idx) => (idx === index ? { ...u, x, y } : u)))
    setPlacingUnitIndex(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Building" value={building.building} onChange={setField('building')} />
        <TextField label="Area (sq ft)" value={building.area} onChange={setField('area')} />
        <TextField label="Number" value={building.number} onChange={setField('number')} />
        <TextField label="Units" value={building.units} onChange={setField('units')} />
        <TextField label="Available" value={building.available} onChange={setField('available')} />
        <TextField label="Parking" value={building.parking} onChange={setField('parking')} />
      </div>

      {/* ── 1. Geometry: the 3D model ──────────────────────────── */}
      <ModelManager building={building} onChange={onChange} folder={folder} />

      {/* ── 2. Details: entered once, used everywhere ──────────── */}
      <div className="rounded-lg border border-white/10 bg-void/40 p-3">
        <span className="text-xs font-bold uppercase tracking-wide text-bone-3">
          Units — these details drive the 3D model, the plan view, the unit list and the detail card
        </span>

        {labelProblems.errors.length > 0 && (
          <div role="alert" className="mt-2 text-xs leading-relaxed text-red-400">
            {labelProblems.errors.map((problem) => (
              <p key={problem.text}>{problem.text}</p>
            ))}
            <p>
              The property can&apos;t be saved until every unit has a label of its own — a unit with none can&apos;t be
              opened, and of two that share one only the first can be linked to a shape in 3D.
            </p>
          </div>
        )}
        {labelProblems.warnings.length > 0 && (
          <div className="mt-2 text-xs leading-relaxed text-ember">
            {labelProblems.warnings.map((problem) => (
              <p key={problem.text}>{problem.text}</p>
            ))}
          </div>
        )}

        <div className="mt-4">
          <UnitsWorkspace
            units={units}
            siteModel={siteModel}
            building={building}
            selected={selectedUnit}
            onSelect={setSelectedUnit}
            onAdd={() => setUnits((list) => [...list, makeUnit(nextUnitLabel(list))])}
            onMove={(i, by) =>
              setUnits((list) => {
                const next = [...list]
                const j = i + by
                if (j < 0 || j >= next.length) return list
                ;[next[i], next[j]] = [next[j], next[i]]
                return next
              })
            }
            onRemove={(i) => setUnits((list) => list.filter((_, idx) => idx !== i))}
            renderUnit={(unit, i) => {
              const set = (next) => setUnitAt(i, next)
              const isBound = boundLabels?.has(String(unit.label ?? '').trim().toLowerCase())
              const placement = siteLinked ? unitPlacement({ siteLinked, building, unit }) : null
              return (
                // Addressable so tap-to-tag in the model panel above can scroll
                // a just-created unit into view and focus its Label field.
                <div id={unitFormId(folder, i)} className="flex flex-col gap-3">
                  <UnitFields unit={unit} onChange={set} folder={folder} />

                  {/* One placement indicator, not two. With a model uploaded —
                      the whole site's or this building's — where the unit sits
                      is the model's business and pins are never touched. */}
                  {placement ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          placement.linked ? 'bg-[var(--color-status-available)] text-void' : 'bg-ember text-void'
                        }`}
                      >
                        {placement.text}
                      </span>
                      {!placement.linked && (
                        <span className="text-xs text-bone-3">
                          Still shown in the unit list — tag its shape under Site model (3D) below.
                        </span>
                      )}
                    </div>
                  ) : hasModel ? (
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
          {placedIn3D
            ? 'Not needed for this building. Visitors get the 3D model, and its plan view is generated from the same model — this image is only used if the model fails to load on an old device.'
            : 'Used when a building has no 3D model. Upload the plan, then place each unit on it.'}
        </p>

        <div className="mt-3">
          <ImageUploader
            label="Floor plan image"
            value={building.planImage}
            onChange={setField('planImage')}
            folder={`${folder}/floor-plan`}
          />
        </div>

        {!placedIn3D && (
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
  const set = (patch) => onChange((b) => ({ ...b, investment: mergeFields(b.investment ?? makeInvestment(), patch) }))
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

// One chip per unit — status, 3D link and what is still missing, readable
// without opening it — and only the chosen unit's form below.
function UnitsWorkspace({ units, building, siteModel, selected, onSelect, onAdd, onMove, onRemove, renderUnit }) {
  const index = Math.min(selected, Math.max(units.length - 1, 0))
  const unit = units[index]

  // A unit added from the 3D model's tap-to-tag (or the button) is the one to edit next.
  const previousCount = useRef(units.length)
  useEffect(() => {
    if (units.length > previousCount.current) onSelect(units.length - 1)
    previousCount.current = units.length
  }, [units.length, onSelect])

  const items = units.map((u, i) => {
    const missing = unitMissing(u)
    const words = STATUS_WORDS[u.status] ?? STATUS_WORDS.available
    const tags = [{ text: words.short, tone: `status-${u.status in STATUS_WORDS ? u.status : 'available'}` }]
    tags.push(unitHas3D(building, u, siteModel) ? { text: '3D', tone: 'three-d' } : { text: 'No 3D', tone: 'no-three-d' })
    if (missing.length) tags.push({ text: 'Need to fill details', tone: 'warn' })
    return { title: String(u.label ?? '').trim() ? `Unit ${String(u.label).trim()}` : `Unit ${i + 1}`, tags }
  })

  const missing = unit ? unitMissing(unit) : []
  const name = items[index]?.title ?? ''

  return (
    <div className="flex flex-col gap-3">
      <ChipTabs
        label="Units"
        idPrefix="unit"
        items={items}
        selected={index}
        onSelect={onSelect}
        onAdd={onAdd}
        addLabel="Add unit"
      />
      {unit ? (
        <div
          role="tabpanel"
          id="unit-panel"
          aria-labelledby={`unit-tab-${index}`}
          className="rounded-xl border border-white/10 bg-black/15"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-1 pl-4 pr-1.5">
            <span className="flex items-center gap-2 text-xs font-bold tabular-nums text-bone-3">
              {index + 1}
              <span className="font-normal"> of {units.length}</span>
              {unitHas3D(building, unit, siteModel) && (
                <span className="flex items-center gap-1 text-accent-soft">
                  <Cube weight="bold" className="size-3.5" aria-hidden /> 3D
                </span>
              )}
            </span>
            <span className="flex flex-wrap items-center justify-end">
              {units.length > 1 && (
                <>
                  <IconButton
                    icon={ArrowLeft}
                    label={`Move ${name} earlier`}
                    size="sm"
                    disabled={index === 0}
                    onClick={() => {
                      onMove(index, -1)
                      onSelect(index - 1)
                    }}
                  />
                  <IconButton
                    icon={ArrowRight}
                    label={`Move ${name} later`}
                    size="sm"
                    disabled={index === units.length - 1}
                    onClick={() => {
                      onMove(index, 1)
                      onSelect(index + 1)
                    }}
                  />
                </>
              )}
              {isTrackerUnit(unit) ? (
                <IconButton
                  icon={X}
                  label={`Can't remove ${name}: ${TRACKER_MANAGED} — remove it there`}
                  size="sm"
                  disabled
                />
              ) : (
                <ConfirmButton
                  icon={X}
                  label="Remove"
                  ariaLabel={`Remove ${name}`}
                  prompt={`Remove ${name}?`}
                  confirmLabel="Yes, remove"
                  busyLabel="Removing…"
                  onConfirm={() => onRemove(index)}
                />
              )}
            </span>
          </div>
          {missing.length > 0 && (
            <p role="status" className="border-b border-white/5 bg-ember/10 px-4 py-2 text-xs text-ember">
              <strong className="font-bold uppercase tracking-wide">Need to fill details:</strong> {missing.join(' · ')}
            </p>
          )}
          <div className="p-4">{renderUnit(unit, index)}</div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-bone-3">
          No units in this building yet. Add one, or tap a shape in the 3D model to create it.
        </p>
      )}
    </div>
  )
}
