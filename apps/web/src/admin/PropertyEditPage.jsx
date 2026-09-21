import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCategories, useContentRefetch, useProperties } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'
import { Section, TextField, TextAreaField } from './components/Field'
import ImageUploader from './components/ImageUploader'
import RepeatableList from './components/RepeatableList'
import BuildingBlock from './components/BuildingBlock'
import SiteModelManager from './components/SiteModelManager'

const emptyDetail = () => ({
  tagline: '',
  offer: '',
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

const PROPERTY_GALLERY_SLOTS = 3
const fixedGallery = (gallery) => {
  const source = Array.isArray(gallery) ? gallery : []
  return source.length >= PROPERTY_GALLERY_SLOTS
    ? source
    : [...source, ...Array(PROPERTY_GALLERY_SLOTS - source.length).fill('')]
}
// Which of the 16 sections start open. The rest still hold their data —
// collapsed just means "not the first thing an editor has to scroll past."
// Chosen from what actually gets touched most often on a property that
// already exists: the identity fields, its photos, the sales pitch, and the
// floor plans. Everything else is one click away, not gone.
//
// Only the *initial* state: what is open lives in `openSections` below from
// then on, so switching tabs does not reopen what an editor collapsed.
const OPEN_ON_LOAD = new Set(['basics', 'images', 'overview', 'highlights', 'floorplans'])

// One tab per cluster. `id` is the tab's own key (distinct from any
// individual Section's `id` below it) — used to build both the ARIA
// tab/tabpanel id pairs and the roving-tabindex keyboard order.
const TABS = [
  { id: 'basics', label: 'Basics & media' },
  { id: 'content', label: 'Marketing content' },
  { id: 'plans', label: 'Floor plans & 3D' },
  { id: 'location', label: 'Location & nearby' },
  { id: 'extras', label: 'Extras & links' },
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
    const next = {
      ...original,
      gallery: fixedGallery(original.gallery),
      detail: { ...emptyDetail(), ...(original.detail ?? {}) },
    }
    setForm(next)
    setBaseline(next)
  }, [original, id])

  // JSON-diffed rather than tracked field-by-field: the form is a deeply
  // nested, admin-editor-shaped blob (see emptyDetail above), and a
  // dirty-flag per field would have to be threaded through every one of the
  // ~16 sections below for a payoff that a single comparison already gives.
  const isDirty = Boolean(form && baseline && JSON.stringify(form) !== JSON.stringify(baseline))

  if (!original) {
    return (
      <div>
        <p className="text-bone/60">Property not found.</p>
        <Link to="/admin/properties" className="text-ember">
          ← Back to properties
        </Link>
      </div>
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

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }))
  const patchDetail = (section, partial) =>
    setForm((f) => ({ ...f, detail: { ...f.detail, [section]: { ...f.detail[section], ...partial } } }))

  const save = async () => {
    setSaving(true)
    setError(null)
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, _slugTouched, ...payload } = form
    try {
      await api.patch(`/admin/properties/${id}`, payload)
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return
    }
    setSaving(false)
    setSavedAt(Date.now())
    setBaseline(form)
    refetch()
  }

  return (
    <div className="pb-24">
      {/* Negative-margined to run full-bleed under <main>'s own padding, then
          re-adds it — the standard trick for a sticky bar inside a padded
          scroll container. Sticks to <main>'s scroll, not the window: Save
          and the tab list need to stay reachable without a round trip to
          the top. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-white/10 bg-carbon/95 px-4 pb-4 pt-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link to="/admin/properties" className="text-xs font-bold uppercase tracking-wide text-bone-3 hover:text-bone/70">
              ← All properties
            </Link>
            <h1 className="mt-2 truncate font-display text-2xl font-medium">{form.name || 'Untitled property'}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-xs text-bone-3">
              {saving ? 'Saving…' : isDirty ? 'Unsaved changes' : savedAt ? 'Saved' : null}
            </span>
            {form.published && (
              <a
                href={`/properties/${form.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold uppercase tracking-wide text-bone/50 hover:text-bone"
              >
                View live ↗
              </a>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-void disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Real tabs, not a jump rail: only the active cluster's sections are
            in the DOM at all, so the heavy ones — the 3D site model chief
            among them — mount only when an editor actually opens that tab. */}
        <div role="tablist" aria-label="Property sections" className="mt-4 flex flex-wrap gap-2" onKeyDown={onTabKeyDown}>
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
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'border-accent bg-accent/10 text-bone'
                    : 'border-white/15 text-bone/70 hover:border-white/30 hover:text-bone'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <TabPanel id="basics" activeTab={activeTab}>
        <Section {...section('basics')} title="Basics">
          <div className="grid grid-cols-2 gap-5">
            <TextField
              label="Name"
              value={form.name}
              onChange={(name) => patch({ name, slug: form._slugTouched ? form.slug : slugify(name) })}
            />
            <TextField
              label="Slug (URL)"
              value={form.slug}
              onChange={(slug) => patch({ slug, _slugTouched: true })}
            />
            <TextField label="Address" value={form.address} onChange={(address) => patch({ address })} />
            <div>
              <TextField label="Category" value={form.category} onChange={(category) => patch({ category })} />
              <p className="mt-1 text-[11px] text-bone-3">Existing: {categories.filter((c) => c !== 'All').join(', ')}</p>
            </div>
            <TextField
              label="Buildings"
              type="number"
              value={form.buildings}
              onChange={(buildings) => patch({ buildings })}
            />
            <TextField label="Sold" type="number" value={form.sold} onChange={(sold) => patch({ sold })} />
            <TextField
              label="Available"
              type="number"
              value={form.available}
              onChange={(available) => patch({ available })}
            />
            <TextField
              label="Sort order (lower shows first)"
              type="number"
              value={form.sortOrder}
              onChange={(sortOrder) => patch({ sortOrder })}
            />
          </div>
          <label className="flex w-fit items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => patch({ published: e.target.checked })}
              className="size-4 accent-ember"
            />
            <span className="text-sm text-bone/70">Published (visible on the public site)</span>
          </label>
        </Section>

        <Section {...section('images')} title="Images">
          <ImageUploader label="Main image" value={form.image} onChange={(image) => patch({ image })} folder={`projects/${form.slug}`} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Gallery</span>
            <div className="mt-3">
              <RepeatableList
                items={form.gallery}
                onChange={(gallery) => patch({ gallery })}
                makeItem={() => ''}
                allowAdd={false}
                allowRemove={false}
                maxItems={PROPERTY_GALLERY_SLOTS}
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
            onChange={(tagline) => setForm((f) => ({ ...f, detail: { ...f.detail, tagline } }))}
          />
        </Section>

        <Section {...section('promotion')} title="Promotion">
          <TextField
            label="Offer message (leave blank to hide)"
            value={form.detail.offer}
            onChange={(offer) => setForm((f) => ({ ...f, detail: { ...f.detail, offer } }))}
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
                  <div className="grid grid-cols-2 gap-3">
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
            onChange={(tenants) => setForm((f) => ({ ...f, detail: { ...f.detail, tenants } }))}
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
                  <div className="grid grid-cols-2 gap-3">
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
                renderItem={(item, set, i) => (
                  <BuildingBlock building={item} onChange={set} folder={`projects/${form.slug}/building-${i}`} />
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
            onSiteModelChange={(siteModel) => patch({ detail: { ...form.detail, siteModel } })}
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
            onChange={(videos) => setForm((f) => ({ ...f, detail: { ...f.detail, videos } }))}
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
            onChange={(extFacade) => setForm((f) => ({ ...f, detail: { ...f.detail, extFacade } }))}
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
            onChange={(resourceLinks) => setForm((f) => ({ ...f, detail: { ...f.detail, resourceLinks } }))}
            makeItem={() => ({ label: '', url: '', thumbnail: '' })}
            addLabel="Add link"
            renderItem={(item, set) => (
              <div className="flex flex-col gap-3">
                <ImageUploader label="Thumbnail (optional)" value={item.thumbnail} onChange={(thumbnail) => set({ ...item, thumbnail })} folder={`projects/${form.slug}/links`} />
                <div className="grid grid-cols-2 gap-3">
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
            onChange={(socials) => setForm((f) => ({ ...f, detail: { ...f.detail, socials } }))}
            makeItem={() => ({ platform: 'instagram', url: '' })}
            addLabel="Add social"
            renderItem={(item, set) => (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Platform" value={item.platform} onChange={(platform) => set({ ...item, platform })} />
                <TextField label="URL" value={item.url} onChange={(url) => set({ ...item, url })} />
              </div>
            )}
          />
        </Section>
      </TabPanel>
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
