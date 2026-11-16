import { useRef, useState } from 'react'
import { CheckboxField, SelectField, TextAreaField, TextField } from './Field'
import ImageUploader, { ImageFormatHint } from './ImageUploader'
import RepeatableList from './RepeatableList'
import { UNIT_STATUSES, unitStatusMeta } from '../../lib/unitStatus'
import { formatArea, formatLeasePrice, formatTotalPrice } from '../../lib/units'
import { STATUS_WORDS } from '../completeness'
import { resolveNext } from '../adminUtils'
import {
  TRACKED_FIELDS,
  TRACKER_MANAGED,
  followsTracker,
  isTrackerUnit,
  replaceWithTracker,
  turnTrackerOn,
  trackerValues,
  unitFed,
  withTrackerOverrides,
} from '../unitChecks'

// The dropdown says what an editor means — unsold, in lease, sold — while the
// stored values and the public site's wording stay as they are.
const ADMIN_STATUSES = UNIT_STATUSES.map((s) => ({ ...s, label: STATUS_WORDS[s.value]?.long ?? s.label }))

/** The names an editor knows the fed fields by, for "you've edited …". */
const FIELD_NAMES = {
  status: 'status',
  size: 'size',
  tenant: 'tenant',
  leasePrice: 'lease price',
  salePrice: 'sale price',
  soldPrice: 'sold price',
}

/** How a fed field's tracker value reads in a hint. */
const SHOW = {
  status: (v) => unitStatusMeta(v).label,
  size: (v) => formatArea(v) ?? v,
  leasePrice: (v) => formatLeasePrice(v) ?? v,
  salePrice: (v) => formatTotalPrice(v) ?? v,
  soldPrice: (v) => formatTotalPrice(v) ?? v,
}

const list = (words) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? ''))

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
 *
 * A unit linked to Prime Tracker has its status, size, tenant and prices fed by
 * the sync unless the editor takes over: switch the tracker off for the unit,
 * or just change a field — the edit is kept through every sync, and "replace my
 * edits" puts the tracker's data back. Which fields differ is worked out here
 * on every change (withTrackerOverrides) and saved on the unit as
 * `trackerOverrides`, which is what the API's sync reads. Only the label stays
 * the tracker's: it is how the unit is matched, so renumbering is done there.
 */
export default function UnitFields({ unit, onChange, folder }) {
  const linked = isTrackerUnit(unit)
  const follows = followsTracker(unit)
  const values = trackerValues(unit)
  const overridden = follows ? (unit.trackerOverrides ?? []) : []

  // The one place a change leaves this form, so the override list can never
  // fall behind the fields it describes.
  const change = (updater) => onChange((u) => withTrackerOverrides(resolveNext(updater, u), u))
  const set = (key) => (value) => change((u) => ({ ...u, [key]: value }))

  // "Replace my edits" is a checkbox, not a button, so ticking it can be undone:
  // the edits are kept here until the form is left, and unticking puts them back.
  const stash = useRef(null)
  const [replaced, setReplaced] = useState(false)
  const showReplaced = follows && replaced && overridden.length === 0
  const replaceEdits = (on) => {
    if (on) {
      stash.current = unit
      onChange((u) => replaceWithTracker(u))
      setReplaced(true)
      return
    }
    const before = stash.current
    setReplaced(false)
    if (!before) return
    onChange((u) => {
      const restored = { ...u }
      for (const field of TRACKED_FIELDS) restored[field] = before[field]
      return withTrackerOverrides(restored, u)
    })
  }

  // The line under a fed field: that it follows the tracker, or that the
  // editor's value is being kept and what the tracker says instead.
  const fedHint = (field) => {
    if (!follows) return undefined
    if (overridden.includes(field)) {
      const says = values?.[field]
      return `Edited here — kept through every sync. The tracker says ${(says !== undefined && (SHOW[field]?.(says) ?? says)) || 'nothing'}.`
    }
    return unitFed(unit, field) ? 'Follows Prime Tracker. Change it to keep your own value.' : undefined
  }

  return (
    <>
      {linked && (
        <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <CheckboxField
            label="Get this unit's data from Prime Tracker"
            value={follows}
            // Ticking replaces this unit's edits with the tracker's data; unticking
            // only stops the sync, and every value stays as it is to be edited.
            onChange={(on) => (on ? change((u) => turnTrackerOn(u)) : change((u) => ({ ...u, trackerSync: false })))}
            hint={
              follows
                ? 'Status, size, tenant and prices come from the tracker on every sync. You can still change any of them here — your change is kept. Untick to type them in freely.'
                : "Off: the sync leaves this unit's status, size, tenant and prices exactly as they are here. Tick to replace them with the tracker's data. It stays linked to its tracker units, so a renumbering or split in the tracker still carries its photographs."
            }
          />
          {follows && overridden.length > 0 && (
            <p role="status" className="text-xs leading-relaxed text-ember">
              You've changed the {list(overridden.map((field) => FIELD_NAMES[field] ?? field))} here. The sync keeps{' '}
              {overridden.length > 1 ? 'those' : 'that'} and updates the rest.
            </p>
          )}
          {follows && (overridden.length > 0 || showReplaced) && (
            <CheckboxField
              label="Replace my edits with the tracker's data"
              value={showReplaced}
              onChange={replaceEdits}
              hint="Puts every field the tracker feeds back to what the tracker says, and has the sync keep it up to date again. Save to apply; untick to get your edits back."
            />
          )}
          {follows && !values && (
            <p className="text-xs leading-relaxed text-bone-3">
              The tracker's figures for this unit arrive with its next sync (at most an hour). Edits made until then are kept.
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Label"
          placeholder="Unit 101"
          value={unit.label}
          onChange={set('label')}
          disabled={linked}
          hint={linked ? `${TRACKER_MANAGED} — renumber it there` : undefined}
        />
        <SelectField
          label="Status"
          value={unit.status}
          onChange={set('status')}
          options={ADMIN_STATUSES}
          hint={fedHint('status')}
        />
        <TextField
          label="Tenant / use (if any)"
          placeholder="Kalyan Jewellers"
          value={unit.tenant}
          onChange={set('tenant')}
          hint={fedHint('tenant')}
        />
        <TextField label="Size (sq ft)" value={unit.size} onChange={set('size')} hint={fedHint('size')} />
        <TextField
          label="Clear height"
          placeholder="24 ft"
          value={unit.clearHeight}
          onChange={set('clearHeight')}
          hint="The ceiling height inside the unit, as a visitor should read it."
        />
        <TextField label="Frontage" placeholder="32 ft on Leora Ln" value={unit.frontage} onChange={set('frontage')} />
      </div>

      {/* Three prices, always asked for: which of them a visitor sees depends
          on the unit's status (the API decides — public-property.ts), and an
          editor filling in a unit about to go on the market needs the field in
          front of them before the status says so. */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Pricing</span>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="Lease price ($ / sq ft / yr)"
            placeholder="28"
            value={unit.leasePrice}
            onChange={set('leasePrice')}
            hint={fedHint('leasePrice')}
          />
          <TextField
            label="Sale price ($)"
            placeholder="650000"
            value={unit.salePrice}
            onChange={set('salePrice')}
            hint={fedHint('salePrice')}
          />
          <TextField
            label="Sold price ($)"
            placeholder="610000"
            value={unit.soldPrice}
            onChange={set('soldPrice')}
            hint={fedHint('soldPrice')}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-bone-3">
          A lease or sale price is shown while the unit is unsold or coming soon. A leased unit's lease price and a sold
          unit's sold price stay private unless you tick “Show the price on the website” below.
        </p>
      </div>
      {/* The older free-text rate, shown only where a unit still has one. */}
      {String(unit.rate ?? '').trim() && (
        <TextField
          label="Rate (older free-text field)"
          placeholder="$28 / SF / yr"
          value={unit.rate}
          onChange={set('rate')}
          hint="Shown where the unit has no lease price. Clear it once the lease price above is filled in."
        />
      )}

      {/* Stored as `hidden`, the other way round, so a unit written before
          this existed — which has no such field — reads as shown. The public
          API drops a hidden unit whole; the tracker sync leaves the flag be. */}
      <CheckboxField
        label="Show on website"
        value={!unit.hidden}
        onChange={(shown) => set('hidden')(!shown)}
        hint="Untick to keep this unit off the public site: its page, the unit lists and plans, homepage cards and rate-sheet rows. It stays here to edit, and the tracker sync leaves your choice alone."
      />
      {/* The public API leaves these out unless ticked — see
          apps/api/src/modules/properties/public-property.ts. Asked only
          where there is something to withhold. */}
      {unit.status === 'sold' && String(unit.tenant ?? '').trim() && (
        <CheckboxField
          label="Show the owner on the website"
          value={unit.publishTenant === true}
          onChange={set('publishTenant')}
          hint="A sold unit's owner, website and category are kept off the public site unless this is ticked. Tick it for a business that owns its unit, never for a private buyer."
        />
      )}
      {(unit.status === 'leased' || unit.status === 'sold') &&
        [unit.rate, unit.leasePrice, unit.soldPrice].some((value) => String(value ?? '').trim()) && (
          <CheckboxField
            label="Show the price on the website"
            value={unit.publishRate === true}
            onChange={set('publishRate')}
            hint="The price of a leased or sold unit — its lease price or sold price — is kept off the public site unless this is ticked. Ticked, it appears on the unit's page, the unit comparison and the building's rent roll."
          />
        )}
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
          onChange={(images) => change((u) => ({ ...u, images: resolveNext(images, u.images ?? []) }))}
          makeItem={() => ''}
          addLabel="Add photograph"
          layout="grid"
          renderItem={(url, setUrl) => (
            <ImageUploader value={url} onChange={setUrl} folder={`${folder}/unit-photos`} hint={false} />
          )}
        />
        <ImageFormatHint className="mt-2" />
      </div>
      <TextAreaField
        label="Unit description"
        rows={3}
        placeholder="Corner suite with dock access and 18ft clear height…"
        value={unit.description}
        onChange={set('description')}
        // Withholding the owner and price (the checkboxes above) covers their
        // own fields only; this one is always published as written.
        hint={
          unit.status === 'sold'
            ? 'Shown on the public site as written — leave out who bought the unit and what it sold for.'
            : unit.status === 'leased'
              ? 'Shown on the public site as written — leave out the rent.'
              : undefined
        }
      />
    </>
  )
}
