import { ArrowSquareOut, Buildings, Plus } from '@phosphor-icons/react'
import { CheckboxField, Section, TextAreaField, TextField } from './Field'
import ImageUploader from './ImageUploader'
import RepeatableList from './RepeatableList'
import { Button, EmptyState } from './ui'
import { buildingKey, makeInfoBuilding, makeInfoImage } from '../../lib/propertyInfo'
import { countByStatus, getUnits } from '../../lib/units'
import { mergeFields } from '../adminUtils'

/**
 * The Info page tab of the property editor — everything on
 * /properties/:slug/info, stored on the property at `detail.info`.
 *
 * `info` is what the page currently shows: the property's own copy if it has
 * one, otherwise the set shipped in code for its slug. Editing either writes
 * `detail.info`, so a property on the shipped set takes a copy the first time
 * anything here changes — and nothing is written for an editor who only looks.
 */
export default function InfoPageEditor({ info, usingDefault, slug, property, floorBuildings, onChange, onCreate, section }) {
  if (!info) {
    return (
      <EmptyState
        icon={Buildings}
        title="No info page yet"
        action={
          <Button variant="primary" icon={Plus} onClick={onCreate}>
            Create info page
          </Button>
        }
      >
        An unlisted reference page for prospects — site plan, each building&apos;s photo and floor plan, photography and
        contacts. It starts unpublished.
      </EmptyState>
    )
  }

  // Updaters, not copies of `info`: an upload landing later must apply to the
  // page as it is then (see resolveNext in adminUtils).
  const patch = (partial) => onChange((current) => mergeFields(current, partial))
  const patchBand = (band, partial) => patch({ [band]: (current) => mergeFields(current, partial) })
  const folder = `projects/${slug}/info`
  const pageUrl = `/properties/${slug}/info`

  return (
    <>
      {usingDefault && (
        <p className="rounded-xl border border-accent-soft/30 bg-accent-soft/10 px-4 py-3 text-sm text-bone-2">
          This page is showing the set built into the site. Change anything here and save, and the property keeps its
          own copy from then on.
        </p>
      )}

      <Section {...section('info-page')} title="Page" description="The header of the page: what it is, where it is, and four headline figures.">
        <CheckboxField
          label="Published"
          value={info.published !== false}
          onChange={(published) => patch({ published })}
          hint="Shows the page, and the “View photos” button on this property's unit cards. The page is unlisted — reachable only by its link, and kept out of search results."
        />
        <Button variant="ghost" size="sm" href={pageUrl} target="_blank" rel="noreferrer" icon={ArrowSquareOut} className="-ml-3 w-fit">
          {pageUrl}
        </Button>
        <TextField label="Kicker" value={info.kicker} onChange={(kicker) => patch({ kicker })} placeholder="Mixed Development" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={info.name}
            onChange={(name) => patch({ name })}
            placeholder={property.name}
            hint="Leave empty to use the property's name."
          />
          <TextField
            label="Address"
            value={info.address}
            onChange={(address) => patch({ address })}
            placeholder={property.address}
            hint="Leave empty to use the property's address."
          />
        </div>
        <TextAreaField label="Summary" rows={3} value={info.summary} onChange={(summary) => patch({ summary })} />
        <ImageUploader label="Hero photograph" value={info.heroImage} onChange={(heroImage) => patch({ heroImage })} folder={`${folder}/hero`} />
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Headline figures</span>
          <p className="mt-1 text-xs text-bone-3">Up to four, shown in a row under the summary — e.g. &quot;10&quot; Buildings, &quot;NNN&quot; Lease type.</p>
          <div className="mt-3">
            <RepeatableList
              items={info.facts}
              onChange={(facts) => patch({ facts })}
              makeItem={() => ({ value: '', label: '' })}
              addLabel="Add figure"
              maxItems={4}
              renderItem={(item, set) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Figure" value={item.value} onChange={(value) => set({ ...item, value })} />
                  <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} />
                </div>
              )}
            />
          </div>
        </div>
      </Section>

      <ImageBandEditor
        sectionProps={section('info-site')}
        title="Site plan & sheets"
        description="The site plan, availability map and trade-area sheets. Shown whole, never cropped."
        band={info.site}
        onChange={(partial) => patchBand('site', partial)}
        folder={`${folder}/site`}
        addLabel="Add sheet"
      />

      <Section
        {...section('info-buildings')}
        title="Buildings"
        description="Each building with its photograph and its floor-plan sheet, shown side by side one building at a time."
      >
        <BandCopy band={info.buildings} onChange={(partial) => patchBand('buildings', partial)} />
        <BuildingList
          items={info.buildings.items ?? []}
          onChange={(items) => patchBand('buildings', { items })}
          floorBuildings={floorBuildings}
          folder={`${folder}/buildings`}
        />
      </Section>

      <ImageBandEditor
        sectionProps={section('info-gallery')}
        title="Photography"
        description="The development as built. Photographs sit in rows of matching height and may be trimmed to fit; the full frame opens on click."
        band={info.gallery}
        onChange={(partial) => patchBand('gallery', partial)}
        folder={`${folder}/gallery`}
        addLabel="Add photograph"
      />

      <ImageBandEditor
        sectionProps={section('info-investment')}
        title="Investment sheets"
        description="Summary sheets for tenanted units offered with the lease in place."
        band={info.investment}
        onChange={(partial) => patchBand('investment', partial)}
        folder={`${folder}/investment`}
        addLabel="Add sheet"
      />

      <Section {...section('info-contact')} title="Listings & contacts" description="The closing band: outside listings, the sales team and an email address.">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Listings & documents</span>
          <div className="mt-3">
            <RepeatableList
              items={info.links}
              onChange={(links) => patch({ links })}
              makeItem={() => ({ label: '', href: '' })}
              addLabel="Add link"
              renderItem={(item, set) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Label" value={item.label} onChange={(label) => set({ ...item, label })} placeholder="Crexi listing" />
                  <TextField label="URL" value={item.href} onChange={(href) => set({ ...item, href })} placeholder="https://" />
                </div>
              )}
            />
          </div>
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Sales contacts</span>
          <div className="mt-3">
            <RepeatableList
              items={info.contacts}
              onChange={(contacts) => patch({ contacts })}
              makeItem={() => ({ name: '', phone: '' })}
              addLabel="Add contact"
              renderItem={(item, set) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Name" value={item.name} onChange={(name) => set({ ...item, name })} />
                  <TextField label="Phone" type="tel" value={item.phone} onChange={(phone) => set({ ...item, phone })} placeholder="+1 (512) 000-0000" />
                </div>
              )}
            />
          </div>
        </div>
        <TextField label="Email" type="email" value={info.email} onChange={(email) => patch({ email })} />
      </Section>
    </>
  )
}

function BandCopy({ band, onChange }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Kicker" value={band.tag} onChange={(tag) => onChange({ tag })} />
        <TextField label="Heading" value={band.heading} onChange={(heading) => onChange({ heading })} />
      </div>
      <TextAreaField label="Intro" rows={2} value={band.body} onChange={(body) => onChange({ body })} />
    </>
  )
}

/** One band of images: its copy, then the images in order. An empty band is left off the page. */
function ImageBandEditor({ sectionProps, title, description, band, onChange, folder, addLabel }) {
  return (
    <Section {...sectionProps} title={title} description={description}>
      <BandCopy band={band} onChange={onChange} />
      <RepeatableList
        items={band.images}
        onChange={(images) => onChange({ images })}
        makeItem={makeInfoImage}
        addLabel={addLabel}
        renderItem={(image, set) => (
          <div className="flex flex-col gap-3">
            <ImageUploader value={image.src} onChange={(src) => set((it) => ({ ...it, src }))} folder={folder} hint={false} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Caption" value={image.caption} onChange={(caption) => set({ ...image, caption })} hint="Shown under the image." />
              <TextField label="Alt text" value={image.alt} onChange={(alt) => set({ ...image, alt })} hint="What it shows, for screen readers." />
            </div>
          </div>
        )}
      />
      {band.images?.length === 0 && <p className="text-xs text-bone-3">No images — this band is hidden on the page.</p>}
    </Section>
  )
}

/**
 * The buildings list. Each one's label is checked against Floor plans as it is
 * typed: a match is what gives the building its live availability on the page,
 * and a near-miss ("Bldg 7" for "Building 7") otherwise fails silently.
 */
function BuildingList({ items, onChange, floorBuildings, folder }) {
  const byKey = new Map((floorBuildings ?? []).map((b) => [buildingKey(b.building), b]))
  const missing = (floorBuildings ?? []).filter((b) => b.building && !items.some((item) => buildingKey(item.label) === buildingKey(b.building)))

  const linkStatus = (label) => {
    if (!label?.trim()) return null
    const match = byKey.get(buildingKey(label))
    if (!match) return { ok: false, text: `No building called “${label}” in Floor plans & 3D — availability won't show.` }
    const units = getUnits(match)
    const available = countByStatus(units).available ?? 0
    return {
      ok: true,
      text: units.length
        ? `Linked to Floor plans · ${available ? `${available} available` : 'none available'} right now`
        : 'Linked to Floor plans · no units listed there',
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <datalist id="info-building-labels">
        {(floorBuildings ?? []).map((b) => b.building && <option key={b.building} value={b.building} />)}
      </datalist>

      <RepeatableList
        items={items}
        onChange={onChange}
        makeItem={() => makeInfoBuilding()}
        addLabel="Add building"
        renderItem={(item, set) => {
          const status = linkStatus(item.label)
          return (
            <div className="flex flex-col gap-4">
              <div>
                <TextField label="Building" value={item.label} onChange={(label) => set({ ...item, label })} placeholder="Building 1" list="info-building-labels" />
                {status && <p className={`mt-1.5 text-xs ${status.ok ? 'text-status-available' : 'text-ember'}`}>{status.text}</p>}
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <ImageUploader label="Photograph" value={item.photo} onChange={(photo) => set((it) => ({ ...it, photo }))} folder={folder} hint={false} />
                  <TextField label="Photo alt text" value={item.photoAlt} onChange={(photoAlt) => set({ ...item, photoAlt })} />
                </div>
                <div className="flex flex-col gap-3">
                  <ImageUploader label="Floor-plan sheet" value={item.plan} onChange={(plan) => set((it) => ({ ...it, plan }))} folder={folder} hint={false} />
                  <TextField label="Plan alt text" value={item.planAlt} onChange={(planAlt) => set({ ...item, planAlt })} />
                </div>
              </div>
              <TextAreaField
                label="Note (optional)"
                rows={2}
                value={item.note}
                onChange={(note) => set({ ...item, note })}
                hint="A line under the building's name — e.g. drive-through end cap, delivery in Q2."
              />
              {!item.photo && !item.plan && <p className="text-xs text-bone-3">Needs a photograph or a floor plan to appear on the page.</p>}
            </div>
          )
        }}
      />

      {missing.length > 0 && (
        <Button
          size="sm"
          icon={Plus}
          className="w-fit"
          onClick={() => onChange((current) => [...(current ?? []), ...missing.map((b) => makeInfoBuilding(b.building))])}
        >
          Add {missing.length === 1 ? missing[0].building : `the ${missing.length} buildings`} from Floor plans
        </Button>
      )}
    </div>
  )
}
