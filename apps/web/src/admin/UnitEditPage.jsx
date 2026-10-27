import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Trash } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { findUnitBySlugs, formatUnitLabel, getBuildings, makeUnit, unitPath } from '../lib/units'
import { Section, SelectField } from './components/Field'
import UnitFields from './components/UnitFields'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { Alert, Badge, Button, ConfirmButton, EmptyState } from './components/ui'
import { stable, useAdminTitle } from './adminUtils'
import { unitEditPath, useSaveUnit } from './unitsStore'
import { TRACKER_MANAGED, isTrackerUnit, unitPlacement } from './unitChecks'

/**
 * One unit, edited on its own — the same fields as the property editor's
 * building block (they share UnitFields), without scrolling past every other
 * unit in the building to reach it.
 *
 * `/admin/units/new` adds one: pick the property and building first.
 */
export default function UnitEditPage() {
  const { propertyId, building: buildingParam, unit: unitParam } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const properties = useProperties()
  const save = useSaveUnit()
  const isNew = !propertyId

  // Where a new unit goes. Pre-filled from the list's property filter.
  const [target, setTarget] = useState(() => ({ propertyId: search.get('property') ?? '', buildingIndex: 0 }))

  const property = properties.find((p) => p.id === (isNew ? target.propertyId : propertyId))
  const found = useMemo(
    () => (!isNew && property ? findUnitBySlugs(property, buildingParam, unitParam) : null),
    [isNew, property, buildingParam, unitParam],
  )
  const buildings = getBuildings(property)
  const building = isNew ? buildings[target.buildingIndex] : found?.building

  const [form, setForm] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  useAdminTitle(isNew ? 'New unit' : `Unit ${formatUnitLabel(form?.label) || ''}`)

  // Seeded once per unit, so the refetch after a save can't overwrite typing.
  const loadedFor = useRef(null)
  useEffect(() => {
    const key = isNew ? 'new' : `${propertyId}/${buildingParam}/${unitParam}`
    if (loadedFor.current === key) return
    if (!isNew && !found) return
    loadedFor.current = key
    // `index` is a runtime field getUnits adds; it must not be saved.
    const { index: _index, ...unit } = isNew ? makeUnit() : found.unit
    setForm(unit)
    setBaseline(unit)
  }, [isNew, found, propertyId, buildingParam, unitParam])

  if (!isNew && (!property || !found)) {
    return (
      <EmptyState
        title="Unit not found"
        action={
          <Button to="/admin/units" icon={ArrowLeft}>
            All units
          </Button>
        }
      >
        It may have been renamed or removed — open it again from the Units list.
      </EmptyState>
    )
  }
  if (!form) return null

  const dirty = stable(form) !== stable(baseline)
  const label = String(form.label ?? '').trim()

  /** Resolves true when the save landed — LeaveGuard's "Save and leave" relies on it. */
  const onSave = async () => {
    if (!property || !building) {
      setError('Choose the property and building this unit belongs to.')
      return false
    }
    if (!label) {
      setError('The unit needs a label — e.g. 101, or 203+204 for a combined suite.')
      return false
    }
    setSaving(true)
    setError(null)
    const snapshot = form
    try {
      await save({
        propertySlug: property.slug,
        buildingLabel: building.building,
        buildingIndex: isNew ? target.buildingIndex : found.buildingIndex,
        unitLabel: isNew ? null : baseline.label,
        unitIndex: isNew ? null : found.unitIndex,
        change: isNew ? { type: 'add', unit: snapshot } : { type: 'update', unit: snapshot },
      })
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return false
    }
    setSaving(false)
    setSavedAt(Date.now())
    setBaseline(snapshot)
    // A new unit, or a renamed one, lives at a new address now.
    if (isNew || String(snapshot.label) !== String(baseline.label)) {
      loadedFor.current = null
      navigate(unitEditPath(property, building.building, snapshot.label), { replace: true })
    }
    return true
  }

  const remove = async () => {
    try {
      await save({
        propertySlug: property.slug,
        buildingLabel: building.building,
        buildingIndex: found.buildingIndex,
        unitLabel: baseline.label,
        unitIndex: found.unitIndex,
        change: { type: 'remove' },
      })
      setBaseline(form)
      navigate('/admin/units')
    } catch (err) {
      setError(`Couldn't delete — ${err.message}`)
    }
  }

  // As stored, not as typed: 3D links and pins are keyed to the saved label.
  const placement = !isNew && building ? unitPlacement({ siteModel: property?.detail?.siteModel, building, unit: found.unit }) : null
  const trackerOwned = !isNew && isTrackerUnit(found.unit)

  const buildingIndex = isNew ? target.buildingIndex : found.buildingIndex
  const folder = property ? `projects/${property.slug}/building-${buildingIndex}` : 'projects/units'
  const title = isNew ? `New unit${label ? ` ${formatUnitLabel(label)}` : ''}` : `Unit ${formatUnitLabel(baseline.label) || '—'}`

  return (
    <div className="pb-24">
      <EditorBar
        backTo={property && !isNew ? `/admin/units?property=${property.id}` : '/admin/units'}
        backLabel="All units"
        title={title}
        live={property ? property.published !== false : undefined}
        viewHref={!isNew && property?.published ? unitPath(property.slug, building.building, baseline.label) : undefined}
        dirty={dirty || isNew}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={onSave}
      >
        {!isNew && (
          <p className="mt-2 text-sm text-bone-3">
            {building.building} · {property.name}
          </p>
        )}
      </EditorBar>
      <LeaveGuard when={dirty} onSave={onSave} />

      <div className="mx-auto max-w-4xl">
        {error && (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-6">
          {isNew && (
            <Section title="Where it is" description="The property and building this unit belongs to.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  label="Property"
                  value={target.propertyId}
                  onChange={(id) => setTarget({ propertyId: id, buildingIndex: 0 })}
                  options={[{ value: '', label: 'Choose a property…' }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <SelectField
                  label="Building"
                  value={String(target.buildingIndex)}
                  onChange={(i) => setTarget((t) => ({ ...t, buildingIndex: Number(i) }))}
                  options={
                    buildings.length
                      ? buildings.map((b, i) => ({ value: String(i), label: b.building || `Building ${i + 1}` }))
                      : [{ value: '0', label: property ? 'This property has no buildings yet' : 'Choose a property first' }]
                  }
                />
              </div>
              {property && !buildings.length && (
                <p className="text-sm text-bone-3">
                  Add a building first, under{' '}
                  <Link to={`/admin/properties/${property.id}`} className="text-accent-soft underline underline-offset-4">
                    {property.name} → Floor plans &amp; 3D
                  </Link>
                  .
                </p>
              )}
            </Section>
          )}

          <Section title="The unit">
            <UnitFields unit={form} onChange={setForm} folder={folder} />
          </Section>

          {property && !isNew && placement && (
            <Section title="Placement" description="Where this unit sits on the plan or in the 3D model.">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={placement.linked ? 'success' : 'ember'} dot>
                  {placement.text}
                </Badge>
                {placement.kind === 'site' && <span className="text-xs text-bone-3">Whole-site 3D model</span>}
              </div>
              <p className="text-sm text-bone-3">
                {placement.kind === 'pin' ? 'Placing the unit on the plan' : 'Linking the unit to its shape in the 3D model'} is
                done next to the plan in{' '}
                <Link to={`/admin/properties/${property.id}`} className="text-accent-soft underline underline-offset-4">
                  {property.name} → Floor plans &amp; 3D
                </Link>
                .
              </p>
            </Section>
          )}

          {!isNew && (
            <div className="flex flex-col items-end gap-1">
              {/* The next sync would only bring a tracker unit back. */}
              <ConfirmButton
                icon={Trash}
                label="Delete this unit"
                prompt="Delete this unit permanently?"
                onConfirm={remove}
                disabled={trackerOwned}
                title={trackerOwned ? TRACKER_MANAGED : undefined}
              />
              {trackerOwned && <span className="text-xs text-bone-3">{TRACKER_MANAGED} — remove it there.</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
