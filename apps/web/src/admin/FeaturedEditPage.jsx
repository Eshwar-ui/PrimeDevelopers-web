import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Trash } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { FEATURE_KINDS, cardKind, cardStatus, cardStatusText, featuredCards, featuredMedia, featuredPhotoOptions, plainHeading, primaryHref } from '../lib/featured'
import { formatUnitLabel, labelSlug, listUnits } from '../lib/units'
import { FeaturedCard } from '../components/FeaturedProperty'
import { CheckboxField, Section, SelectField, TextAreaField, TextField } from './components/Field'
import ImageUploader from './components/ImageUploader'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { Alert, Button, ConfirmButton, EmptyState, focusRing } from './components/ui'
import { stable, useAdminTitle } from './adminUtils'
import { useCapSection } from './capStore'
import { useSaveSection, useStableSection } from './sectionStore'

const SECTION = 'featured_home'
// Enough to choose from at a glance; a property's every unit photo can run past a hundred.
const PHOTOS_AT_FIRST = 15
const emphasisHint = 'Wrap words in *asterisks* to set them in saffron; a line break starts a new line. A card with no heading is never shown.'

/**
 * One featured card. The preview at the top is the homepage card itself
 * (FeaturedCard), fed the same photos the carousel would pick — so what is
 * edited here is what visitors get.
 */
export default function FeaturedEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const section = useStableSection(SECTION)
  const save = useSaveSection(SECTION)
  const properties = useProperties()
  const capListings = useCapSection().items ?? []

  const original = useMemo(() => featuredCards(section).find((c) => c.id === id), [section, id])
  const [form, setForm] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  const [previewImage, setPreviewImage] = useState(0)
  const [allPhotos, setAllPhotos] = useState(false)
  useAdminTitle(plainHeading(form?.heading) || 'Featured card')

  const loadedFor = useRef(null)
  useEffect(() => {
    if (!original || loadedFor.current === id) return
    loadedFor.current = id
    const next = { photos: [], visible: true, startsAt: '', endsAt: '', badge: '', capSlug: '', unitKey: '', ...original, kind: cardKind(original) }
    setForm(next)
    setBaseline(next)
  }, [original, id])

  if (!original) {
    return (
      <EmptyState
        title="Card not found"
        action={
          <Button to="/admin/featured" icon={ArrowLeft}>
            All featured cards
          </Button>
        }
      >
        It may have been deleted.
      </EmptyState>
    )
  }
  if (!form) return null

  const ctx = { properties, capListings }
  const media = featuredMedia(form, ctx)
  const options = featuredPhotoOptions(form, ctx)
  const dirty = stable(form) !== stable(baseline)
  const patch = (partial) => setForm((f) => ({ ...f, ...partial }))
  const statusText = cardStatusText(form)
  const chosen = form.photos ?? []
  const shownOptions = allPhotos ? options : options.filter((src, i) => i < PHOTOS_AT_FIRST || chosen.includes(src))

  const unitOptions = properties.flatMap((p) =>
    listUnits(p).map(({ building, unit }) => ({
      value: `${p.slug}::${labelSlug(building.building)}/${labelSlug(unit.label)}`,
      label: `${p.name} · ${building.building} · Unit ${formatUnitLabel(unit.label)}`,
    })),
  )

  const onSave = async () => {
    setSaving(true)
    setError(null)
    const snapshot = form
    try {
      let found = false
      await save((cur) => {
        const cards = featuredCards(cur).map((c) => {
          if (c.id !== id) return c
          found = true
          return snapshot
        })
        return { ...cur, heading: '', cards: found ? cards : [...cards, snapshot] }
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
      await save((cur) => ({ ...cur, heading: '', cards: featuredCards(cur).filter((c) => c.id !== id) }))
      setBaseline(form)
      navigate('/admin/featured')
    } catch (err) {
      setError(`Couldn't delete — ${err.message}`)
    }
  }

  const togglePhoto = (src) => patch({ photos: chosen.includes(src) ? chosen.filter((p) => p !== src) : [...chosen, src] })

  return (
    <div className="pb-24">
      <EditorBar
        backTo="/admin/featured"
        backLabel="All featured cards"
        title={plainHeading(form.heading) || 'Untitled card'}
        live={cardStatus(form) === 'showing'}
        viewHref="/"
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={onSave}
        maxWidth="max-w-5xl"
      >
        <p className="mt-2 text-sm text-bone-3">{statusText}</p>
      </EditorBar>
      <LeaveGuard when={dirty} onSave={onSave} />

      <div className="mx-auto max-w-5xl">
        {error && (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-wide text-bone-3">Preview</p>
          {/* The real homepage card, on the site's own ground. */}
          <div className="mt-3 overflow-hidden rounded-2xl bg-base p-3 text-content sm:p-4">
            {form.heading ? (
              <FeaturedCard card={form} media={media} active activeImage={previewImage} onImage={setPreviewImage} />
            ) : (
              <p className="px-4 py-10 text-center font-body text-sm text-content/60">Add a heading to see the card — without one it isn&apos;t shown.</p>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6">
          <Section title="What it advertises" description="Its photos come from what it points at, unless you choose them below.">
            <SelectField label="Advertise" value={form.kind} onChange={(kind) => patch({ kind })} options={FEATURE_KINDS} />
            {form.kind === 'property' && (
              <SelectField
                label="Property"
                value={form.propertySlug}
                onChange={(propertySlug) => patch({ propertySlug })}
                options={[{ value: '', label: 'Choose a property…' }, ...properties.map((p) => ({ value: p.slug, label: p.name }))]}
              />
            )}
            {form.kind === 'cap' && (
              <SelectField
                label="CAP / NNN deal"
                value={form.capSlug}
                onChange={(capSlug) => patch({ capSlug })}
                options={[
                  { value: '', label: 'Choose a deal…' },
                  ...capListings.map((l) => ({ value: l.slug, label: `${l.tenant}${l.units ? ` — Unit ${l.units}` : ''}` })),
                ]}
              />
            )}
            {form.kind === 'unit' && (
              <SelectField
                label="Unit"
                value={form.propertySlug && form.unitKey ? `${form.propertySlug}::${form.unitKey}` : ''}
                onChange={(v) => {
                  const [propertySlug, unitKey] = v.split('::')
                  patch({ propertySlug: propertySlug ?? '', unitKey: unitKey ?? '' })
                }}
                options={[{ value: '', label: 'Choose a unit…' }, ...unitOptions]}
              />
            )}
          </Section>

          <Section title="On the homepage" description="Switch it off to keep it without showing it, or give it dates to run a promotion that starts and stops on its own.">
            <CheckboxField label="Show this card" value={form.visible !== false} onChange={(visible) => patch({ visible })} hint={statusText} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Starts" type="date" value={form.startsAt} onChange={(startsAt) => patch({ startsAt })} hint="Leave empty to start straight away." />
              <TextField label="Ends" type="date" value={form.endsAt} onChange={(endsAt) => patch({ endsAt })} hint="Leave empty to run until you hide it." />
            </div>
            {form.startsAt && form.endsAt && form.endsAt < form.startsAt && <p className="text-sm text-ember">The end date is before the start date, so this card will never show.</p>}
          </Section>

          <Section title="Badge & words">
            <TextField label="Badge" value={form.badge} onChange={(badge) => patch({ badge })} placeholder="Just listed" hint="A short label on the photo. Leave empty for none." />
            <TextField label="Kicker" value={form.eyebrow} onChange={(eyebrow) => patch({ eyebrow })} />
            <TextAreaField label="Heading" rows={2} value={form.heading} onChange={(heading) => patch({ heading })} hint={emphasisHint} />
            <TextField label="Subheading" value={form.subheading} onChange={(subheading) => patch({ subheading })} />
            <TextAreaField label="Paragraph" rows={3} value={form.paragraph} onChange={(paragraph) => patch({ paragraph })} />
          </Section>

          <Section title="Buttons" description="Leave a label empty to hide that button.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Primary label" value={form.ctaLabel} onChange={(ctaLabel) => patch({ ctaLabel })} />
              <TextField
                label="Primary link"
                value={form.ctaHref}
                onChange={(ctaHref) => patch({ ctaHref })}
                placeholder={primaryHref({ ...form, ctaHref: '' })}
                hint="Empty goes to what the card advertises."
              />
              <TextField label="Secondary label" value={form.secondaryLabel} onChange={(secondaryLabel) => patch({ secondaryLabel })} />
              <TextField label="Secondary link" value={form.secondaryHref} onChange={(secondaryHref) => patch({ secondaryHref })} placeholder="/contact" />
            </div>
          </Section>

          <Section
            title="Rotating photos"
            description={
              chosen.length
                ? `${chosen.length} chosen — the card cycles through them in the order picked.`
                : 'None chosen: the card uses the photos of what it advertises. Pick some to choose exactly which, and in what order.'
            }
          >
            {options.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {shownOptions.map((src) => {
                  const n = chosen.indexOf(src)
                  return (
                    <button
                      key={src}
                      type="button"
                      aria-pressed={n >= 0}
                      onClick={() => togglePhoto(src)}
                      className={`relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${focusRing} ${
                        n >= 0 ? 'border-accent-soft' : 'border-transparent hover:border-white/30'
                      }`}
                    >
                      <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                      {n >= 0 && (
                        <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-void">
                          {n + 1}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {shownOptions.length < options.length && (
              <Button size="sm" onClick={() => setAllPhotos(true)} className="w-fit">
                Show all {options.length} photos
              </Button>
            )}
            {options.length === 0 && (
              <p className="text-sm text-bone-3">Choose what the card advertises to see its photos here, or upload one below.</p>
            )}
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Add a photo</span>
              <div className="mt-2">
                <ImageUploader
                  value=""
                  onChange={(url) => url && patch({ photos: [...chosen, url] })}
                  folder="site/featured"
                  hint={false}
                />
              </div>
            </div>
            {chosen.length > 0 && (
              <Button size="sm" variant="ghost" icon={Check} onClick={() => patch({ photos: [] })} className="-ml-3 w-fit">
                Use the default photos instead
              </Button>
            )}
            <TextField label="Photo description (alt text)" value={form.imageAlt} onChange={(imageAlt) => patch({ imageAlt })} hint="What the photos show, for screen readers." />
          </Section>

          <div className="flex justify-end">
            <ConfirmButton icon={Trash} label="Delete this card" prompt="Delete this card permanently?" onConfirm={remove} />
          </div>
        </div>
      </div>
    </div>
  )
}
