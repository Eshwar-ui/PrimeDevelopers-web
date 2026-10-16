import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash, Warning } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { useCapSection, useSaveCapSection } from './capStore'
import {
  CAP_STATUSES,
  capListingSlug,
  capRateMismatch,
  capStatus,
  formatPercent,
  formatPerSf,
  pricePerSf,
} from '../lib/capListings'
import { getBuildings, getUnits } from '../lib/units'
import { CheckboxField, NumberField, Section, SelectField, TextAreaField, TextField } from './components/Field'
import ImageUploader from './components/ImageUploader'
import RepeatableList from './components/RepeatableList'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { Alert, Button, ConfirmButton, EmptyState } from './components/ui'
import { stable, useAdminTitle } from './adminUtils'

export default function CapEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const section = useCapSection()
  const save = useSaveCapSection()
  const properties = useProperties()

  const original = useMemo(() => (section.items ?? []).find((l) => l.id === id), [section, id])
  const [form, setForm] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  useAdminTitle(form?.tenant || 'CAP deal')

  // Seeded once per deal, so the refetch that follows a save can't replace
  // what was typed while it was in flight (the same fix as the other editors).
  const loadedFor = useRef(null)
  useEffect(() => {
    if (!original || loadedFor.current === id) return
    loadedFor.current = id
    // A slug the editor hasn't touched follows the tenant and unit, so a new
    // deal named "Smoke Shop, 1108" gets "smoke-shop-unit-1108" without asking.
    const next = { ...original, _slugTouched: !(original.slug ?? '').startsWith('new-deal-') }
    setForm(next)
    setBaseline(next)
  }, [original, id])

  const linked = properties.find((p) => p.slug === form?.propertySlug)
  const unitOptions = useMemo(
    () =>
      getBuildings(linked).flatMap((b) =>
        getUnits(b).map((u) => ({ value: u.label, label: `${b.building} · ${u.label}${u.tenant ? ` — ${u.tenant}` : ''}` })),
      ),
    [linked],
  )

  if (!original) {
    return (
      <EmptyState
        title="Deal not found"
        action={
          <Button to="/admin/cap" icon={ArrowLeft}>
            All deals
          </Button>
        }
      >
        It may have been deleted.
      </EmptyState>
    )
  }
  if (!form) return null

  const dirty = stable(form) !== stable(baseline)
  const patch = (partial) =>
    setForm((f) => {
      const next = { ...f, ...partial }
      if (!next._slugTouched && ('tenant' in partial || 'units' in partial)) next.slug = capListingSlug(next)
      return next
    })

  const status = capStatus(form.status)
  const perSf = pricePerSf(form)
  const mismatch = capRateMismatch(form)
  const slugTaken = (section.items ?? []).some((l) => l.id !== id && l.slug === form.slug)

  /** Resolves true when the save landed — LeaveGuard's "Save and leave" relies on it. */
  const onSave = async () => {
    if (!form.slug || slugTaken) {
      setError(slugTaken ? 'Another deal already uses that URL — change the slug.' : 'The deal needs a URL slug.')
      return false
    }
    setSaving(true)
    setError(null)
    const snapshot = form
    const { _slugTouched, ...listing } = form
    try {
      let found = false
      await save((cur) => {
        const items = (cur.items ?? []).map((l) => {
          if (l.id !== id) return l
          found = true
          return listing
        })
        // Deleted in another tab while this one was open: put it back rather
        // than lose what was just typed.
        return { ...cur, items: found ? items : [listing, ...items] }
      })
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return false
    }
    setSaving(false)
    setSavedAt(Date.now())
    setBaseline(snapshot)
    return true
  }

  const remove = async () => {
    try {
      await save((cur) => ({ ...cur, items: (cur.items ?? []).filter((l) => l.id !== id) }))
      setBaseline(form) // nothing left to guard
      navigate('/admin/cap')
    } catch (err) {
      setError(`Couldn't delete — ${err.message}`)
    }
  }

  const folder = `cap/${form.slug || form.id}`

  return (
    <div className="pb-24">
      <EditorBar
        backTo="/admin/cap"
        backLabel="All deals"
        title={form.tenant || 'Untitled deal'}
        live={form.published !== false}
        viewHref={baseline.published !== false ? `/cap-properties/${baseline.slug}` : undefined}
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={onSave}
      />
      <LeaveGuard when={dirty} onSave={onSave} />

      <div className="mx-auto max-w-4xl">
        {error && (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-6">
          <Section title="The deal">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label="Status" value={form.status} onChange={(s) => patch({ status: s })} options={CAP_STATUSES} />
              <CheckboxField
                label="Published"
                value={form.published !== false}
                onChange={(published) => patch({ published })}
                hint="Shown on the site once saved. Untick to hide it without deleting."
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Tenant" value={form.tenant} onChange={(tenant) => patch({ tenant })} placeholder="Seven Oaks Coffee" />
              <TextField label="Tagline" value={form.tagline} onChange={(tagline) => patch({ tagline })} placeholder="South India wedding mall" hint="Optional line under the name." />
            </div>
            <TextField label="Address" value={form.address} onChange={(address) => patch({ address })} placeholder="15101 Ronald Reagan Blvd, Leander, TX" />
            <TextField
              label="Slug (URL)"
              value={form.slug}
              onChange={(slug) => patch({ slug, _slugTouched: true })}
              hint={slugTaken ? 'Another deal already uses this — it must be unique.' : `The address: /cap-properties/${form.slug || '…'}`}
            />
          </Section>

          <Section title="Unit & figures" description="As they appear on the sheet. Price per SF is worked out from price and size.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Unit number(s)" value={form.units} onChange={(units) => patch({ units })} placeholder="1101, 1102" />
              <NumberField label="Total size" value={form.sf} onChange={(sf) => patch({ sf })} suffix="SF" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField
                label={status.priceLabel}
                value={form.price}
                onChange={(price) => patch({ price })}
                prefix="$"
                hint={perSf != null ? `${formatPerSf(perSf)}` : 'Price and size give the price per SF.'}
              />
              <NumberField label="Cap rate" value={form.capRate} onChange={(capRate) => patch({ capRate })} suffix="%" />
              <NumberField label="Lease term" value={form.leaseTerm} onChange={(leaseTerm) => patch({ leaseTerm })} suffix="years" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField label="Yearly rental income" value={form.rent} onChange={(rent) => patch({ rent })} prefix="$" />
              <NumberField label="Yearly NNN expenses" value={form.nnn} onChange={(nnn) => patch({ nnn })} prefix="$" />
            </div>
            {mismatch != null && (
              <p className="flex items-start gap-2 rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember">
                <Warning weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
                Yearly rent ÷ price comes to {formatPercent(Math.round(mismatch * 100) / 100)}, but the cap rate says{' '}
                {formatPercent(form.capRate)}. Worth checking with whoever owns the deal — the site shows the cap rate as entered.
              </p>
            )}
          </Section>

          <Section title="Photos & logo" description="The photo leads the card and the deal page. The logo sits on a white panel, so dark artwork reads on both themes.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ImageUploader label="Photo" value={form.photo} onChange={(photo) => patch({ photo })} folder={folder} hint={false} />
              <ImageUploader label="Tenant logo" value={form.logo} onChange={(logo) => patch({ logo })} folder={folder} hint={false} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-bone-3">More photos</span>
              <p className="mt-1 text-xs text-bone-3">Shown on the deal page under &ldquo;The unit&rdquo;, with the linked unit&apos;s own photos.</p>
              <div className="mt-3">
                <RepeatableList
                  items={form.photos ?? []}
                  onChange={(photos) => patch({ photos })}
                  makeItem={() => ''}
                  addLabel="Add photo"
                  renderItem={(src, set) => <ImageUploader value={src} onChange={set} folder={folder} hint={false} />}
                />
              </div>
            </div>
          </Section>

          <Section title="Linked property" description="Optional. Links the deal to a property page, and shows the unit's own photos on the deal page.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label="Property"
                value={form.propertySlug}
                onChange={(propertySlug) => patch({ propertySlug, unitLabel: '' })}
                options={[{ value: '', label: 'Not linked' }, ...properties.map((p) => ({ value: p.slug, label: p.name }))]}
              />
              <SelectField
                label="Unit"
                value={form.unitLabel}
                onChange={(unitLabel) => patch({ unitLabel })}
                options={[{ value: '', label: unitOptions.length ? 'No specific unit' : 'No units on this property' }, ...unitOptions]}
              />
            </div>
          </Section>

          <Section title="Description" defaultOpen={Boolean(form.summary || form.highlights?.length || form.flyerUrl)}>
            <TextAreaField label="Summary" rows={4} value={form.summary} onChange={(summary) => patch({ summary })} />
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Highlights</span>
              <div className="mt-3">
                <RepeatableList
                  items={form.highlights ?? []}
                  onChange={(highlights) => patch({ highlights })}
                  makeItem={() => ''}
                  addLabel="Add highlight"
                  renderItem={(value, set) => <TextField value={value} onChange={set} placeholder="Drive-through end cap" />}
                />
              </div>
            </div>
            <TextField label="Flyer URL" value={form.flyerUrl} onChange={(flyerUrl) => patch({ flyerUrl })} placeholder="https://" hint="A PDF or listing page; shown as “Download the flyer”." />
          </Section>

          <div className="flex justify-end">
            <ConfirmButton icon={Trash} label="Delete this deal" prompt="Delete this deal permanently?" onConfirm={remove} />
          </div>
        </div>
      </div>
    </div>
  )
}
