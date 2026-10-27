import { SelectField, TextAreaField, TextField } from './Field'
import ImageUploader from './ImageUploader'
import RepeatableList from './RepeatableList'
import { UNIT_STATUSES } from '../../lib/unitStatus'
import { STATUS_WORDS } from '../completeness'
import { resolveNext } from '../adminUtils'
import { TRACKER_MANAGED, isTrackerUnit } from '../unitChecks'

// The dropdown says what an editor means — unsold, in lease, sold — while the
// stored values and the public site's wording stay as they are.
const ADMIN_STATUSES = UNIT_STATUSES.map((s) => ({ ...s, label: STATUS_WORDS[s.value]?.long ?? s.label }))

/**
 * Everything about one unit that a visitor reads — shared by the property
 * editor's building block and the Units section, so a field added here shows
 * up in both and the two can never disagree about what a unit is.
 *
 * Placement (the 2D pin or the 3D link) is not here: it only makes sense next
 * to the building's plan or model, which the Units section doesn't show.
 *
 * Every change goes up as an updater — `(unit) => ({ ...unit, field })` — not
 * as a copy of `unit`. A photo upload finishes seconds after it starts, and a
 * copy taken then would put back every field as it was, wiping anything typed
 * in the meantime. `onChange` must accept one (resolveNext in adminUtils).
 */
export default function UnitFields({ unit, onChange, folder }) {
  // Its label, status and size are the tracker's, and so is the tenant unless
  // the unit is sold — editing them here would only be undone by the next
  // sync, which reads to an editor as the site losing their work.
  const synced = isTrackerUnit(unit)
  const tenantSynced = synced && unit.status !== 'sold'
  const set = (key) => (value) => onChange((u) => ({ ...u, [key]: value }))
  return (
    <>
      {synced && (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-bone-3">
          Synced from Prime Tracker. {tenantSynced ? 'Label, status, tenant and size' : 'Label, status and size'} update
          automatically — change them in the tracker. Photographs, description and the rest are edited here.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Label"
          placeholder="Unit 101"
          value={unit.label}
          onChange={set('label')}
          disabled={synced}
          hint={synced ? TRACKER_MANAGED : undefined}
        />
        <SelectField
          label="Status"
          value={unit.status}
          onChange={set('status')}
          options={ADMIN_STATUSES}
          disabled={synced}
          hint={synced ? TRACKER_MANAGED : undefined}
        />
        <TextField
          label="Tenant / use (if any)"
          placeholder="Kalyan Jewellers"
          value={unit.tenant}
          onChange={set('tenant')}
          disabled={tenantSynced}
          hint={tenantSynced ? TRACKER_MANAGED : undefined}
        />
        <TextField
          label="Size (sq ft)"
          value={unit.size}
          onChange={set('size')}
          disabled={synced}
          hint={synced ? TRACKER_MANAGED : undefined}
        />
        <TextField label="Floor / level" placeholder="Ground" value={unit.floor} onChange={set('floor')} />
        <TextField label="Lease rate / price" placeholder="$28 / SF / yr" value={unit.rate} onChange={set('rate')} />
        <TextField label="Frontage" placeholder="32 ft on Leora Ln" value={unit.frontage} onChange={set('frontage')} />
      </div>
      {/* Everything below is what a prospect actually reads when
          they tap the unit — each field is optional and simply
          omitted from the card when left blank. */}

      {/* Only asked for once there is a tenant to describe. On an
          empty unit these two would be two more blank boxes in an
          already long form, and neither has anywhere to appear. */}
      {String(unit.tenant ?? '').trim() && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Tenant website" placeholder="https://…" value={unit.tenantUrl} onChange={set('tenantUrl')} />
          <TextField
            label="Tenant category"
            placeholder="Coffee · Dental · Fitness"
            value={unit.tenantCategory}
            onChange={set('tenantCategory')}
          />
        </div>
      )}

      <ImageUploader label="Tenant logo" value={unit.logo} onChange={set('logo')} folder={`${folder}/unit-logos`} />
      <p className="-mt-2 text-xs text-bone-3">
        Shown on this unit in the 3D model instead of its number — for a unit that is
        leased or sold and you want the tenant's mark on the plan.
      </p>

      {/* Its own repeater rather than a multi-file uploader: the
          order is what picks the thumbnail, and a list the admin
          can remove a row from is the only way to control it. */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wide text-bone-3">
          Unit photographs
        </span>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-bone-3">
          Photographs of this space specifically, not of the property. The first one is
          used as the unit's card image on the homepage; the rest appear on the detail
          card when a visitor taps the unit. Worth filling in for leased and sold units
          too — that is what makes them worth showing.
        </p>
        <RepeatableList
          items={unit.images ?? []}
          onChange={(images) => onChange((u) => ({ ...u, images: resolveNext(images, u.images ?? []) }))}
          makeItem={() => ''}
          addLabel="Add photograph"
          renderItem={(url, setUrl) => (
            <ImageUploader value={url} onChange={setUrl} folder={`${folder}/unit-photos`} />
          )}
        />
      </div>
      <TextAreaField
        label="Unit description"
        rows={3}
        placeholder="Corner suite with dock access and 18ft clear height…"
        value={unit.description}
        onChange={set('description')}
      />
    </>
  )
}
