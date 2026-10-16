import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ImageSquare, PencilSimple } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { COVER_GROUPS, COVER_PLACEMENTS, coverImage, propertyPhotos } from '../lib/covers'
import ImageUploader from './components/ImageUploader'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, StatusPill, focusRing } from './components/ui'
import { useAdminTitle } from './adminUtils'
import { useSaveCover } from './coversStore'

/**
 * Choose a photo for one placement: any the property already has, or a new
 * upload. A native <dialog> — the browser handles focus, Escape and the
 * inert page behind it.
 */
function CoverPicker({ target, onClose }) {
  const ref = useRef(null)
  const save = useSaveCover()
  const { property, placement } = target ?? {}
  const current = property?.detail?.covers?.[placement?.key] ?? ''
  const [draft, setDraft] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setDraft(current)
    setError(null)
    const d = ref.current
    if (target && d && !d.open) d.showModal()
    if (!target && d?.open) d.close()
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return <dialog ref={ref} />

  const photos = propertyPhotos(property)
  const apply = async (url) => {
    setBusy(true)
    setError(null)
    try {
      await save(property, placement.key, url)
      ref.current?.close()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      aria-labelledby="cover-picker-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-overlay p-6 text-bone shadow-2xl backdrop:bg-void/80"
    >
      <h2 id="cover-picker-title" className="font-display text-lg font-medium">
        {placement.label} — {property.name}
      </h2>
      <p className="mt-1 text-sm text-bone-3">{placement.where}</p>

      {error && (
        <div className="mt-4">
          <Alert>Couldn&apos;t save — {error}</Alert>
        </div>
      )}

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-bone-3">This property&apos;s photos</p>
      {photos.length === 0 ? (
        <p className="mt-2 text-sm text-bone-3">No photos yet — upload one below.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((src) => {
            const selected = (draft || property.image) === src
            return (
              <button
                key={src}
                type="button"
                onClick={() => setDraft(src === property.image ? '' : src)}
                aria-pressed={selected}
                className={`relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${focusRing} ${
                  selected ? 'border-accent-soft' : 'border-transparent hover:border-white/30'
                }`}
              >
                <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                {src === property.image && (
                  <span className="absolute bottom-1 left-1 rounded bg-void/80 px-1.5 py-0.5 text-[11px] font-bold text-bone">Main</span>
                )}
                {selected && (
                  <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-accent-soft text-void">
                    <Check weight="bold" className="size-3.5" aria-hidden />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-bone-3">Or upload a new one</p>
      <div className="mt-3">
        <ImageUploader
          value={draft && !photos.includes(draft) ? draft : ''}
          onChange={(url) => setDraft(url)}
          folder={`projects/${property.slug}/covers`}
        />
      </div>

      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={() => apply('')} disabled={busy || !current} className="max-sm:w-full">
          Use the main image
        </Button>
        <span className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={busy} className="max-sm:w-full">
            Cancel
          </Button>
          <Button variant="primary" onClick={() => apply(draft)} disabled={busy || draft === current} className="max-sm:w-full">
            {busy ? 'Saving…' : 'Use this photo'}
          </Button>
        </span>
      </div>
    </dialog>
  )
}

/**
 * Every place a property's photo appears, per property, with the photo each
 * one shows. A placement left alone shows the main image; choosing one is
 * saved at once — there is nothing else on this page to save it with.
 */
export default function CoversAdminPage() {
  useAdminTitle('Cover images')
  const properties = useProperties()
  const [target, setTarget] = useState(null)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Cover images"
        description="Each place a property appears on the site can show a different photo — so the same picture isn't repeated down the homepage. Anything left on “Main image” uses the property's main image."
      />

      <div className="mt-8 flex flex-col gap-8">
        {properties.length === 0 && <EmptyState icon={ImageSquare} title="No properties yet" />}
        {properties.map((property) => {
          const custom = Object.keys(property.detail?.covers ?? {}).length
          return (
            <Card key={property.id} as="section" aria-label={property.name} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="font-display text-[16px] font-medium text-bone">{property.name}</h2>
                  <StatusPill live={property.published !== false} />
                  {custom > 0 && <Badge tone="accent">{custom} chosen</Badge>}
                </div>
                <Button size="sm" variant="ghost" to={`/admin/properties/${property.id}`} icon={PencilSimple}>
                  Edit property
                </Button>
              </div>

              {!property.image && custom === 0 && (
                <p className="mt-3 text-sm text-ember">
                  No main image yet — add one under{' '}
                  <Link to={`/admin/properties/${property.id}`} className="underline underline-offset-4">
                    Basics &amp; media
                  </Link>
                  , or choose a photo per placement below.
                </p>
              )}

              <div className="mt-5 flex flex-col gap-5">
                {COVER_GROUPS.map((group) => (
                  <div key={group}>
                    <p className="text-xs font-bold uppercase tracking-wide text-bone-3">{group}</p>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {COVER_PLACEMENTS.filter((p) => p.group === group).map((placement) => {
                        const src = coverImage(property, placement.key)
                        const isCustom = Boolean(property.detail?.covers?.[placement.key])
                        return (
                          <button
                            key={placement.key}
                            type="button"
                            onClick={() => setTarget({ property, placement })}
                            className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left transition-colors hover:border-white/30 ${focusRing}`}
                          >
                            <span className="relative block aspect-[16/10] overflow-hidden bg-black/30">
                              {src ? (
                                <img src={src} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                              ) : (
                                <span className="grid size-full place-items-center text-bone-3">
                                  <ImageSquare className="size-6" aria-hidden />
                                </span>
                              )}
                              {/* Solid, not the translucent badge tones: these sit on
                                  photographs, and a sky behind them washed the label out. */}
                              <span
                                className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide shadow ${
                                  isCustom ? 'bg-accent-soft text-void' : 'bg-void/85 text-bone'
                                }`}
                              >
                                {isCustom ? 'Chosen' : 'Main image'}
                              </span>
                            </span>
                            <span className="px-3 py-2.5">
                              <span className="block text-sm font-medium text-bone">{placement.label}</span>
                              <span className="mt-0.5 block text-xs leading-snug text-bone-3">{placement.where}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <CoverPicker target={target} onClose={() => setTarget(null)} />
    </div>
  )
}
