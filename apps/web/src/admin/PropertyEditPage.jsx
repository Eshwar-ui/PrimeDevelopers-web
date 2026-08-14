import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCategories, useContentRefetch, useProperties } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'
import { Section, TextField, TextAreaField } from './components/Field'
import ImageUploader from './components/ImageUploader'
import RepeatableList from './components/RepeatableList'
import BuildingBlock from './components/BuildingBlock'

const emptyDetail = () => ({
  tagline: '',
  offer: '',
  overview: { eyebrow: '', heading: '', body: '', flyer: '', stats: [] },
  tenants: [],
  highlights: { heading: '', body: '', bigStats: [], cards: [] },
  floorPlans: { heading: '', body: '', buildings: [] },
  location: { eyebrow: '', heading: '', sub: '', body: '' },
  establishedSites: { heading: '' },
  neighborhoods: { mapQuery: '', items: [] },
  videos: [],
  socials: [],
  resourceLinks: [],
  extFacade: [],
})

export default function PropertyEditPage() {
  const { id } = useParams()
  const properties = useProperties()
  const categories = useCategories()
  const refetch = useContentRefetch()

  const original = useMemo(() => properties.find((p) => p.id === id), [properties, id])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (original) {
      setForm({
        ...original,
        gallery: original.gallery ?? [],
        detail: { ...emptyDetail(), ...(original.detail ?? {}) },
      })
    }
  }, [original])

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
    refetch()
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/properties" className="text-xs font-bold uppercase tracking-wide text-bone/40 hover:text-bone/70">
            ← All properties
          </Link>
          <h1 className="mt-2 font-display text-2xl font-medium">{form.name || 'Untitled property'}</h1>
        </div>
        <div className="flex items-center gap-4">
          {savedAt && <span className="text-xs text-bone/40">Saved</span>}
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

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex flex-col gap-6">
        <Section title="Basics">
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
              <p className="mt-1 text-[11px] text-bone/35">Existing: {categories.filter((c) => c !== 'All').join(', ')}</p>
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

        <Section title="Images">
          <ImageUploader label="Main image" value={form.image} onChange={(image) => patch({ image })} folder={`projects/${form.slug}`} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone/45">Gallery</span>
            <div className="mt-3">
              <RepeatableList
                items={form.gallery}
                onChange={(gallery) => patch({ gallery })}
                makeItem={() => ''}
                addLabel="Add gallery image"
                renderItem={(url, set) => (
                  <ImageUploader value={url} onChange={set} folder={`projects/${form.slug}/gallery`} />
                )}
              />
            </div>
          </div>
        </Section>

        <Section title="Detail page — tagline">
          <TextField
            label="Tagline"
            value={form.detail.tagline}
            onChange={(tagline) => setForm((f) => ({ ...f, detail: { ...f.detail, tagline } }))}
          />
        </Section>

        <Section title="Promotion">
          <TextField
            label="Offer message (leave blank to hide)"
            value={form.detail.offer}
            onChange={(offer) => setForm((f) => ({ ...f, detail: { ...f.detail, offer } }))}
          />
        </Section>
        <Section title="Overview">
          <TextField label="Eyebrow" value={form.detail.overview.eyebrow} onChange={(eyebrow) => patchDetail('overview', { eyebrow })} />
          <TextField label="Heading" value={form.detail.overview.heading} onChange={(heading) => patchDetail('overview', { heading })} />
          <TextAreaField label="Body" value={form.detail.overview.body} onChange={(body) => patchDetail('overview', { body })} />
          <TextField label="Flyer URL" value={form.detail.overview.flyer} onChange={(flyer) => patchDetail('overview', { flyer })} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone/45">Stats</span>
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

        <Section title="Tenant logos">
          <RepeatableList
            items={form.detail.tenants}
            onChange={(tenants) => setForm((f) => ({ ...f, detail: { ...f.detail, tenants } }))}
            makeItem={() => ''}
            addLabel="Add tenant logo"
            renderItem={(url, set) => <ImageUploader value={url} onChange={set} folder={`projects/${form.slug}/tenants`} />}
          />
        </Section>

        <Section title="Highlights">
          <TextField label="Heading" value={form.detail.highlights.heading} onChange={(heading) => patchDetail('highlights', { heading })} />
          <TextAreaField label="Body" value={form.detail.highlights.body} onChange={(body) => patchDetail('highlights', { body })} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone/45">Big stats</span>
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
            <span className="text-xs font-bold uppercase tracking-wide text-bone/45">Cards</span>
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

        <Section title="Floor plans">
          <TextField label="Heading" value={form.detail.floorPlans.heading} onChange={(heading) => patchDetail('floorPlans', { heading })} />
          <TextAreaField label="Body" value={form.detail.floorPlans.body} onChange={(body) => patchDetail('floorPlans', { body })} />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone/45">Buildings</span>
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

        <Section title="Location">
          <TextField label="Eyebrow" value={form.detail.location.eyebrow} onChange={(eyebrow) => patchDetail('location', { eyebrow })} />
          <TextField label="Heading" value={form.detail.location.heading} onChange={(heading) => patchDetail('location', { heading })} />
          <TextField label="Subheading" value={form.detail.location.sub} onChange={(sub) => patchDetail('location', { sub })} />
          <TextAreaField label="Body" value={form.detail.location.body} onChange={(body) => patchDetail('location', { body })} />
        </Section>

        <Section title="Established sites">
          <TextField
            label="Heading"
            value={form.detail.establishedSites.heading}
            onChange={(heading) => patchDetail('establishedSites', { heading })}
          />
        </Section>

        <Section title="Neighborhoods" description="Map pin is driven by the address text below (used as a Google Maps search query).">
          <TextField
            label="Map address / query"
            value={form.detail.neighborhoods.mapQuery}
            onChange={(mapQuery) => patchDetail('neighborhoods', { mapQuery })}
          />
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-bone/45">Nearby places</span>
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

        <Section title="Videos" description="YouTube links shown on the property's detail page.">
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

        <Section title="Ext. Facade" description="Exterior photo strip shown on the property's detail page.">
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

        <Section title="Resource links" description="Buttons linking out to flyers, listings (Crexi, Loopnet), floor plan PDFs, etc.">
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

        <Section title="Social links" description="Social icons shown on the property's detail page.">
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
      </div>
    </div>
  )
}
