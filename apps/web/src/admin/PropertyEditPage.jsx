import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { useCategories, useContentRefetch, useProperties } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'
import { CheckboxField, Section, TextField, TextAreaField } from './components/Field'
import { mergeFields, resolveNext, stable, useAdminTitle } from './adminUtils'
import { propertyPayload } from './propertyPayload'
import { unitLabelProblems } from './unitChecks'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { Alert, Button, EmptyState, focusRing } from './components/ui'
import ImageUploader from './components/ImageUploader'
import RepeatableList from './components/RepeatableList'
import BuildingBlock from './components/BuildingBlock'
import SiteModelManager from './components/SiteModelManager'
import InfoPageEditor from './components/InfoPageEditor'
import { DEFAULT_INFO } from '../data/centroPlazaInfo'
import { emptyInfo } from '../lib/propertyInfo'

const emptyDetail = () => ({
  tagline: '',
  offer: '',
  // The three free-text figures under the name on the /properties card
  // ("2.5 Acres", "Ready", "12 retail slots"). Empty means the card falls back
  // to the buildings / sold / available columns — see specsFor in
  // PropertiesPage.jsx. It had no field until now, so nobody could set it.
  specs: [],
  overview: { eyebrow: '', heading: '', body: '', flyer: '', stats: [] },
  tenants: [],
  highlights: { heading: '', body: '', bigStats: [], cards: [] },
  floorPlans: { heading: '', body: '', buildings: [] },
  // One whole-property GLB tagged building/unit/road-wise, replacing the
  // per-building models in `floorPlans.buildings[].model` when set — see
  // apps/web/src/lib/siteModel.js. null until an admin uploads one.
  siteModel: null,
  location: { eyebrow: '', heading: '', sub: '', body: '' },
  establishedSites: { heading: '' },
  neighborhoods: { mapQuery: '', items: [] },
  videos: [],
  socials: [],
  resourceLinks: [],
  extFacade: [],
})

const SPEC_SLOTS = 3
// Held as three slots while editing, so typing in the third box doesn't jump
// into the second. Empty slots are dropped on save.
const fixedSpecs = (specs) => {
  const source = Array.isArray(specs) ? specs.map(String).slice(0, SPEC_SLOTS) : []
  return [...source, ...Array(SPEC_SLOTS - source.length).fill('')]
}
// Which of the 16 sections start open. The rest still hold their data —
// collapsed just means "not the first thing an editor has to scroll past."
// Chosen from what actually gets touched most often on a property that
// already exists: the identity fields, its photos, the sales pitch, and the
// floor plans. Everything else is one click away, not gone.
//
// Only the *initial* state: what is open lives in `openSections` below from
// then on, so switching tabs does not reopen what an editor collapsed.
const OPEN_ON_LOAD = new Set(['basics', 'images', 'overview', 'highlights', 'floorplans', 'info-page', 'info-buildings'])

// One tab per cluster. `id` is the tab's own key (distinct from any
// individual Section's `id` below it) — used to build both the ARIA
// tab/tabpanel id pairs and the roving-tabindex keyboard order.
const TABS = [
  { id: 'basics', label: 'Basics & media' },
  { id: 'content', label: 'Marketing content' },
  { id: 'plans', label: 'Floor plans & 3D' },
  { id: 'location', label: 'Location & nearby' },
  { id: 'extras', label: 'Extras & links' },
  { id: 'info', label: 'Info page' },
]

export default function PropertyEditPage() {
  const { id } = useParams()
  const properties = useProperties()
  const categories = useCategories()
  const refetch = useContentRefetch()

  const original = useMemo(() => properties.find((p) => p.id === id), [properties, id])
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  // Lives here rather than in each <details>, because `TabPanel` unmounts the
  // inactive panels: state held in the element itself dies with it, and every
  // section an editor had collapsed sprang back open on the next tab switch.
  const [openSections, setOpenSections] = useState(() => new Set(OPEN_ON_LOAD))
  const [form, setForm] = useState(null)
  // The as-loaded (or as-last-saved) snapshot, diffed against `form` to know
  // whether there is anything to save — see `isDirty` below.
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  // Set when the property was saved somewhere else after this form loaded.
  const [conflict, setConflict] = useState(false)
  useAdminTitle(form?.name || 'Property')

  // Seeded once per property, not on every change of `original`'s identity.
  // `save` ends in `refetch()`, which rebuilds the properties list and so hands
  // back a new `original` object — and re-seeding from that threw away anything
  // typed while the PATCH was in flight, silently, with the header reading
  // "Saved". Any other refetch in the app did the same to an untouched draft.
  // The form owns its state from mount until the route points somewhere else.
  const loadedFor = useRef(null)

  useEffect(() => {
    if (!original || loadedFor.current === id) return
    loadedFor.current = id
    const detail = { ...emptyDetail(), ...(original.detail ?? {}) }
    const next = {
      ...original,
      gallery: Array.isArray(original.gallery) ? original.gallery : [],
      detail: { ...detail, specs: fixedSpecs(detail.specs) },
    }
    setForm(next)
    setBaseline(next)
  }, [original, id])

  // JSON-diffed rather than tracked field-by-field: the form is a deeply
  // nested, admin-editor-shaped blob (see emptyDetail above), and a
  // dirty-flag per field would have to be threaded through every one of the
  // ~16 sections below for a payoff that a single comparison already gives.
  const isDirty = Boolean(form && baseline && stable(form) !== stable(baseline))

  if (!original) {
    return (
      <EmptyState
        title="Property not found"
        action={
          <Button to="/admin/properties" icon={ArrowLeft}>
            All properties
          </Button>
        }
      >
        It may have been deleted.
      </EmptyState>
    )
  }
  if (!form) return null

  // WAI-ARIA Tabs pattern: arrow keys move both focus and selection among
  // tabs (this list is short enough that "activate on arrow" reads better
  // than a separate activation key), Home/End jump to the ends.
  const onTabKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.id === activeTab)
    let next = null
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length]
    else if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length]
    else if (e.key === 'Home') next = TABS[0]
    else if (e.key === 'End') next = TABS[TABS.length - 1]
    if (!next) return
    e.preventDefault()
    setActiveTab(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  // Spread onto every <Section>: its id, whether it is open, and how to record
  // the editor toggling it. One call site instead of three props repeated
  // sixteen times, and no section can be wired to the wrong key.
  const section = (key) => ({
    id: key,
    open: openSections.has(key),
    onToggle: (isOpen) =>
      setOpenSections((prev) => {
        if (prev.has(key) === isOpen) return prev
        const next = new Set(prev)
        if (isOpen) next.add(key)
        else next.delete(key)
        return next
      }),
  })

  // Every value handed to these may be an updater of that field (resolveNext
  // in adminUtils) — the lists below all send one, so an upload finishing late
  // applies to the form as it is then, not as it was when the file was picked.
  const patch = (partial) => setForm((f) => mergeFields(f, partial))
  const patchDetail = (section, partial) =>
    setForm((f) => ({ ...f, detail: { ...f.detail, [section]: mergeFields(f.detail[section], partial) } }))
  const setDetailKey = (key) => (value) =>
    setForm((f) => ({ ...f, detail: { ...f.detail, [key]: resolveNext(value, f.detail[key]) } }))

  /**
   * Resolves true when the save landed — LeaveGuard's "Save and leave" relies on it.
   *
   * This form sends the whole property, `detail` and all, so saving a copy
   * loaded before someone else's change would quietly undo it — a unit edited
   * in the Units section, this property open in a second tab, or a Prime
   * Tracker sync. So the save carries the `updatedAt` this form started from,
   * and the API refuses it with 409 if the stored property has moved on since
   * — checked under a row lock, so two saves can't both slip through. The form
   * then stops and asks rather than overwriting.
   *
   * `force` is "Save anyway": a deliberate overwrite of what is stored *now*.
   * It reads the current version and sends that as the one it replaces, so a
   * third change landing while the editor decided is still caught.
   *
   * Only the fields the API accepts are sent — see propertyPayload.js for why
   * that is a whitelist and not the record minus a few keys.
   */
  const save = async ({ force = false } = {}) => {
    // An empty or duplicated unit label makes a unit that can't be opened or
    // linked in 3D. BuildingBlock shows each next to its building.
    const { errors: labelErrors } = unitLabelProblems(form.detail.floorPlans?.buildings)
    if (labelErrors.length) {
      setError(
        `${labelErrors[0].text}${labelErrors.length > 1 ? ` And ${labelErrors.length - 1} more.` : ''} Every unit needs a label of its own — see Floor plans & 3D.`,
      )
      return false
    }
    setSaving(true)
    setError(null)
    setConflict(false)
    const snapshot = form
    let saved
    try {
      let expectedUpdatedAt = baseline.updatedAt
      if (force) {
        const fresh = await api.get(`/admin/properties/${encodeURIComponent(baseline.slug)}`)
        expectedUpdatedAt = fresh?.updatedAt
      }
      saved = await api.patch(`/admin/properties/${id}`, propertyPayload(snapshot, { expectedUpdatedAt }))
    } catch (err) {
      setSaving(false)
      if (err?.status === 409) setConflict(true)
      else setError(err.message)
      return false
    }
    // Carry the server's timestamp forward, so the next save compares
    // against this one rather than against the version this form opened.
    const updatedAt = saved?.updatedAt ?? snapshot.updatedAt
    setSaving(false)
    setSavedAt(Date.now())
    setBaseline({ ...snapshot, updatedAt })
    setForm((f) => ({ ...f, updatedAt }))
    refetch()
    return true
  }

  // What the Info page tab edits: the property's own copy, or — until it has
  // one — the set shipped for its slug. Looked up by the slug as loaded, so
  // retyping the slug field doesn't make the shipped set vanish mid-edit.
  const storedInfo = form.detail.info
  const shippedInfo = DEFAULT_INFO[original.slug]
  const infoOf = (detail) =>
    detail.info ? { ...emptyInfo(), ...detail.info } : shippedInfo ? { ...emptyInfo(), ...shippedInfo } : null
  const info = infoOf(form.detail)
  const setInfo = (next) => setForm((f) => ({ ...f, detail: { ...f.detail, info: resolveNext(next, infoOf(f.detail)) } }))

  const setSpec = (i, value) =>
    setForm((f) => ({ ...f, detail: { ...f.detail, specs: f.detail.specs.map((v, idx) => (idx === i ? value : v)) } }))

  return (
    <div className="pb-24">
      <EditorBar
        backTo="/admin/properties"
        backLabel="All properties"
        title={form.name || 'Untitled property'}
        live={form.published}
        viewHref={baseline.published ? `/properties/${baseline.slug}` : undefined}
        dirty={isDirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={save}
        maxWidth="max-w-5xl"
      >
        {/* Real tabs, not a jump rail: only the active cluster's sections are
            in the DOM at all, so the heavy ones — the 3D site model chief
            among them — mount only when an editor actually opens that tab. */}
        <div role="tablist" aria-label="Property sections" className="-mb-1 mt-4 flex gap-1.5 overflow-x-auto pb-1" onKeyDown={onTabKeyDown}>
          {TABS.map((t) => {
            const selected = activeTab === t.id
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full border px-3.5 text-xs font-medium transition-colors ${focusRing} ${
                  selected
                    ? 'border-accent-soft bg-accent-soft/15 text-bone'
                    : 'border-white/15 text-bone-2 hover:border-white/30 hover:text-bone'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </EditorBar>

      <LeaveGuard when={isDirty} onSave={save} />

      <div className="mx-auto max-w-5xl">
      {conflict && (
        <div className="mt-6">
          <Alert
            action={
              <span className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => window.location.reload()}>
                  Reload latest
                </Button>
                <Button size="sm" variant="danger-ghost" onClick={() => save({ force: true })}>
                  Save anyway
                </Button>
              </span>
            }
          >
            This property was changed somewhere else after you opened it — perhaps a unit in Units, another tab, or the
            Prime Tracker sync. Saving now would undo that. Reload to start from the latest (your changes here will be
            lost), or save anyway.
          </Alert>
        </div>
      )}

      {error && (
        <div className="mt-6">
          <Alert>Couldn&apos;t save — {error}</Alert>
        </div>
      )}

      <TabPanel id="basics" activeTab={activeTab}>
        <Section {...section('basics')} title="Basics">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label="Name"
              value={form.name}
              onChange={(name) => patch({ name, slug: form._slugTouched ? form.slug : slugify(name) })}
            />
            <TextField
              label="Slug (URL)"
              value={form.slug}
              onChange={(slug) => patch({ slug, _slugTouched: true })}
              hint={`The address: /properties/${form.slug || '…'}`}
            />
            <TextField label="Address" value={form.address} onChange={(address) => patch({ address })} />
            {/* A datalist rather than a select: the existing categories are
                offered as you type, and a new one can still be entered. */}
            <TextField
              label="Category"
              value={form.category}
              onChange={(category) => patch({ category })}
              list="property-categories"
              hint={`Existing: ${categories.filter((c) => c !== 'All').join(', ')}`}
            />
            <datalist id="property-categories">
              {categories
                .filter((c) => c !== 'All')
                .map((c) => (
                  <option key={c} value={c} />
                ))}
            </datalist>
            {/* The columns are named buildings / sold / available, but they
                count units — and "sold" is every unit that is no longer
                available, leased ones included. Labelled for what they hold,
                and worded the way the public pages show them. */}
            <TextField
              label="Units in total"
              type="number"
              value={form.buildings}
              onChange={(buildings) => patch({ buildings })}
              hint="Every unit on the property, available or not."
            />
            <TextField
              label="Reserved (leased or sold)"
              type="number"
              value={form.sold}
              onChange={(sold) => patch({ sold })}
              hint="Units no longer available. Shown as “reserved”."
            />
            <TextField
              label="Available"
              type="number"
              value={form.available}
              onChange={(available) => patch({ available })}
            />
            <TextField
              label="Sort order"
              type="number"
              value={form.sortOrder}
              onChange={(sortOrder) => patch({ sortOrder })}
              hint="Lower numbers show first."
            />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Listing card figures</span>
            <p className="mt-1 text-xs leading-relaxed text-bone-3">
              The three short facts under the name on the Properties page — e.g. &quot;2.5 Acres&quot;, &quot;Ready&quot;,
              &quot;12 retail slots&quot;. Leave all three empty to show the unit, reserved and available counts instead.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {form.detail.specs.map((value, i) => (
                <TextField
                  key={i}
                  value={value}
                  onChange={(v) => setSpec(i, v)}
                  placeholder={[`${form.buildings} units`, `${form.sold} reserved`, `${form.available} available`][i]}
                />
              ))}
            </div>
          </div>
          <CheckboxField
            label="Published"
            value={form.published}
            onChange={(published) => patch({ published })}
            hint="Visible on the public site once saved. Untick to take it down without deleting it."
          />
        </Section>

        <Section {...section('images')} title="Images">
          <ImageUploader label="Main image" value={form.image} onChange={(image) => patch({ image })} folder={`projects/${form.slug}`} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Gallery</span>
            <p className="mt-1 text-xs leading-relaxed text-bone-3">
              Order matters: the first three fill the property page&apos;s overview. To choose which photo shows on the
              homepage, the listing card and everywhere else, use{' '}
              <Link to="/admin/covers" className="text-accent-soft underline underline-offset-4">
                Cover images
              </Link>
              .
            </p>
            <div className="mt-3">
              <RepeatableList
                items={form.gallery}
                onChange={(gallery) => patch({ gallery })}
                makeItem={() => ''}
                addLabel="Add photo"
                renderItem={(url, set) => (
                  <ImageUploader value={url} onChange={set} folder={`projects/${form.slug}/gallery`} />
                )}
              />
            </div>
          </div>
        </Section>
      </TabPanel>

      <TabPanel id="content" activeTab={activeTab}>
        <Section {...section('tagline')} title="Detail page — tagline">
          <TextField
            label="Tagline"
            value={form.detail.tagline}
            onChange={setDetailKey('tagline')}
          />
        </Section>

        <Section {...section('promotion')} title="Promotion">
          <TextField
            label="Offer message (leave blank to hide)"
            value={form.detail.offer}
            onChange={setDetailKey('offer')}
          />
        </Section>
        <Section {...section('overview')} title="Overview">
          <TextField label="Eyebrow" value={form.detail.overview.eyebrow} onChange={(eyebrow) => patchDetail('overview', { eyebrow })} />
          <TextField label="Heading" value={form.detail.overview.heading} onChange={(heading) => patchDetail('overview', { heading })} />
          <TextAreaField label="Body" value={form.detail.overview.body} onChange={(body) => patchDetail('overview', { body })} />
          <TextField label="Flyer URL" value={form.detail.overview.flyer} onChange={(flyer) => patchDetail('overview', { flyer })} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Stats</span>
            <div className="mt-3">
              <RepeatableList
                items={form.detail.overview.stats}
                onChange={(stats) => patchDetail('overview', { stats })}
                makeItem={() => ({ value: '', label: '' })}
                addLabel="Add stat"
                renderItem={(item, set) => (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField label="Value" value={item.value} onChange={(value) => set({ ...item, value })} />
                    <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
                  </div>
                )}
              />
            </div>
          </div>
        </Section>

        <Section {...section('tenants')} title="Tenant logos">
          <RepeatableList
            items={form.detail.tenants}
            onChange={setDetailKey('tenants')}
            makeItem={() => ''}
            addLabel="Add tenant logo"
            renderItem={(url, set) => <ImageUploader value={url} onChange={set} folder={`projects/${form.slug}/tenants`} />}
          />
        </Section>

        <Section {...section('highlights')} title="Highlights">
          <TextField label="Heading" value={form.detail.highlights.heading} onChange={(heading) => patchDetail('highlights', { heading })} />
          <TextAreaField label="Body" value={form.detail.highlights.body} onChange={(body) => patchDetail('highlights', { body })} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Big stats</span>
            <div className="mt-3">
              <RepeatableList
                items={form.detail.highlights.bigStats}
                onChange={(bigStats) => patchDetail('highlights', { bigStats })}
                makeItem={() => ({ value: '', label: '' })}
                addLabel="Add stat"
                renderItem={(item, set) => (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField label="Value" value={item.value} onChange={(value) => set({ ...item, value })} />
                    <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
                  </div>
                )}
              />
            </div>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Cards</span>
            <div className="mt-3">
              <RepeatableList
                items={form.detail.highlights.cards}
                onChange={(cards) => patchDetail('highlights', { cards })}
                makeItem={() => ({ title: '', body: '' })}
                addLabel="Add card"
                renderItem={(item, set) => (
                  <div className="flex flex-col gap-3">
                    <TextField label="Title" value={item.title} onChange={(title) => set({ ...item, title })} />
                    <TextAreaField label="Body" rows={2} value={item.body} onChange={(body) => set({ ...item, body })} />
                  </div>
                )}
              />
            </div>
          </div>
        </Section>
      </TabPanel>

      <TabPanel id="plans" activeTab={activeTab}>
        <Section {...section('floorplans')} title="Floor plans">
          <TextField label="Heading" value={form.detail.floorPlans.heading} onChange={(heading) => patchDetail('floorPlans', { heading })} />
          <TextAreaField label="Body" value={form.detail.floorPlans.body} onChange={(body) => patchDetail('floorPlans', { body })} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Buildings</span>
            <div className="mt-3">
              <RepeatableList
                items={form.detail.floorPlans.buildings}
                onChange={(buildings) => patchDetail('floorPlans', { buildings })}
                makeItem={() => ({
                  building: '',
                  area: '',
                  number: '',
                  units: '',
                  available: '',
                  parking: 'Yes',
                  planImage: '',
                  unitList: [],
                  // Named road this building fronts, or '' for none/interior.
                  // Units inherit this unless they set their own facingRoad.
                  facingRoad: '',
                })}
                addLabel="Add building"
                // One click used to take a building, every unit in it and their
                // photos off the form — easy to miss before pressing Save.
                confirmRemove={(b) => {
                  const count = (b.unitList ?? []).length
                  const name = String(b.building ?? '').trim() || 'this building'
                  return count ? `Remove ${name} and its ${count} unit${count === 1 ? '' : 's'}?` : `Remove ${name}?`
                }}
                renderItem={(item, set, i) => (
                  <BuildingBlock
                    building={item}
                    onChange={set}
                    folder={`projects/${form.slug}/building-${i}`}
                    siteModel={form.detail.siteModel?.url ? form.detail.siteModel : null}
                  />
                )}
              />
            </div>
          </div>
        </Section>

        {/* The Site Plan section was removed from the public page — the 3D
            model's own plan view replaces it — so its editor is gone too
            rather than left as controls that change nothing. Existing
            `detail.sitePlan` data is left untouched in the database. */}

        <Section
          {...section('sitemodel')}
          title="Site model (3D)"
          description="One 3D model for the whole property, tagged building/unit/road-wise. When set, this replaces the per-building models above on the public page."
        >
          <SiteModelManager
            buildings={form.detail.floorPlans.buildings}
            onBuildingsChange={(buildingsList) => patchDetail('floorPlans', { buildings: buildingsList })}
            siteModel={form.detail.siteModel}
            onSiteModelChange={setDetailKey('siteModel')}
            folder={`properties/${form.slug}/site-model`}
          />
        </Section>
      </TabPanel>

      <TabPanel id="location" activeTab={activeTab}>
        <Section {...section('location')} title="Location">
          <TextField label="Eyebrow" value={form.detail.location.eyebrow} onChange={(eyebrow) => patchDetail('location', { eyebrow })} />
          <TextField label="Heading" value={form.detail.location.heading} onChange={(heading) => patchDetail('location', { heading })} />
          <TextField label="Subheading" value={form.detail.location.sub} onChange={(sub) => patchDetail('location', { sub })} />
          <TextAreaField label="Body" value={form.detail.location.body} onChange={(body) => patchDetail('location', { body })} />
        </Section>

        <Section {...section('established')} title="Established sites">
          <TextField
            label="Heading"
            value={form.detail.establishedSites.heading}
            onChange={(heading) => patchDetail('establishedSites', { heading })}
          />
        </Section>

        <Section
          {...section('neighborhoods')}
          title="Neighborhoods"
          description="Map pin is driven by the address text below (used as a Google Maps search query)."
        >
          <TextField
            label="Map address / query"
            value={form.detail.neighborhoods.mapQuery}
            onChange={(mapQuery) => patchDetail('neighborhoods', { mapQuery })}
          />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Nearby places</span>
            <div className="mt-3">
              <RepeatableList
                items={form.detail.neighborhoods.items}
                onChange={(items) => patchDetail('neighborhoods', { items })}
                makeItem={() => ({ name: '', note: '' })}
                addLabel="Add place"
                renderItem={(item, set) => (
                  <div className="flex flex-col gap-3">
                    <TextField label="Name" value={item.name} onChange={(name) => set({ ...item, name })} />
                    <TextAreaField label="Note" rows={2} value={item.note} onChange={(note) => set({ ...item, note })} />
                  </div>
                )}
              />
            </div>
          </div>
        </Section>
      </TabPanel>

      <TabPanel id="extras" activeTab={activeTab}>
        <Section
          {...section('videos')}
          title="Videos"
          description="YouTube links shown on the property's detail page."
        >
          <RepeatableList
            items={form.detail.videos}
            onChange={setDetailKey('videos')}
            makeItem={() => ({ url: '' })}
            addLabel="Add video"
            renderItem={(item, set) => (
              <TextField label="YouTube URL" value={item.url} onChange={(url) => set({ ...item, url })} />
            )}
          />
        </Section>

        <Section
          {...section('facade')}
          title="Ext. Facade"
          description="Exterior photo strip shown on the property's detail page."
        >
          <RepeatableList
            items={form.detail.extFacade}
            onChange={setDetailKey('extFacade')}
            makeItem={() => ''}
            addLabel="Add photo"
            renderItem={(url, set) => (
              <ImageUploader value={url} onChange={set} folder={`projects/${form.slug}/facade`} />
            )}
          />
        </Section>

        <Section
          {...section('resources')}
          title="Resource links"
          description="Buttons linking out to flyers, listings (Crexi, Loopnet), floor plan PDFs, etc."
        >
          <RepeatableList
            items={form.detail.resourceLinks}
            onChange={setDetailKey('resourceLinks')}
            makeItem={() => ({ label: '', url: '', thumbnail: '' })}
            addLabel="Add link"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader label="Thumbnail (optional)" value={item.thumbnail} onChange={(thumbnail) => set((it) => ({ ...it, thumbnail }))} folder={`projects/${form.slug}/links`} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
                  <TextField label="URL" value={item.url} onChange={(url) => set({ ...item, url })} />
                </div>
              </div>
            )}
          />
        </Section>

        <Section
          {...section('socials')}
          title="Social links"
          description="Social icons shown on the property's detail page."
        >
          <RepeatableList
            items={form.detail.socials}
            onChange={setDetailKey('socials')}
            makeItem={() => ({ platform: 'instagram', url: '' })}
            addLabel="Add social"
            renderItem={(item, set) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Platform" value={item.platform} onChange={(platform) => set({ ...item, platform })} />
                <TextField label="URL" value={item.url} onChange={(url) => set({ ...item, url })} />
              </div>
            )}
          />
        </Section>
      </TabPanel>

      <TabPanel id="info" activeTab={activeTab}>
        <InfoPageEditor
          info={info}
          usingDefault={!storedInfo && Boolean(shippedInfo)}
          slug={form.slug}
          property={{ name: form.name, address: form.address }}
          floorBuildings={form.detail.floorPlans.buildings}
          onChange={setInfo}
          onCreate={() => setInfo(emptyInfo())}
          section={section}
        />
      </TabPanel>
      </div>
    </div>
  )
}

// Unmounts rather than CSS-hides the inactive tabs. That's what makes this a
// real tab pattern instead of the anchor-jump rail it replaced, and it means
// the expensive stuff in the "plans" tab — the 3D site model viewer above
// all — never mounts until an editor actually opens that tab.
function TabPanel({ id, activeTab, children }) {
  if (id !== activeTab) return null
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="mt-8 flex flex-col gap-6">
      {children}
    </div>
  )
}
