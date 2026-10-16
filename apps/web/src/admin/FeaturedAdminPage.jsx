import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Eye, EyeSlash, Megaphone, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { cardKind, cardStatus, cardStatusText, featuredCards, featuredMedia, FEATURE_KINDS, plainHeading } from '../lib/featured'
import { useCapSection } from './capStore'
import { useSaveSection, useStableSection } from './sectionStore'
import { Alert, Badge, Button, Card, ConfirmButton, EmptyState, IconButton, PageHeader, focusRing } from './components/ui'
import { useAdminTitle } from './adminUtils'

const SECTION = 'featured_home'
const STATUS_TONES = { showing: 'success', scheduled: 'accent', ended: 'neutral', hidden: 'neutral', draft: 'ember' }

/** The status in words, with the tone it deserves. */
const statusBadge = (card) => ({ tone: STATUS_TONES[cardStatus(card)], text: cardStatusText(card) })

export default function FeaturedAdminPage() {
  useAdminTitle('Featured')
  const section = useStableSection(SECTION)
  const save = useSaveSection(SECTION)
  const properties = useProperties()
  const capListings = useCapSection().items ?? []
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const cards = featuredCards(section)
  const showing = cards.filter((c) => cardStatus(c) === 'showing').length

  // Every change rewrites the list with ids, and blanks the pre-list
  // single-feature heading so an emptied list hides the panel rather than
  // falling back to it.
  const run = async (change) => {
    setError(null)
    setBusy(true)
    try {
      return await save((cur) => ({ ...cur, heading: '', cards: change(featuredCards(cur)) }))
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    const card = {
      id: `card-${Date.now().toString(36)}`,
      kind: 'property',
      // Hidden until it's ready — a new card can't go live half-written.
      visible: false,
      badge: '',
      eyebrow: 'Featured Property',
      heading: '',
      subheading: '',
      paragraph: '',
      ctaLabel: 'Explore Property',
      ctaHref: '',
      secondaryLabel: 'Schedule a Visit',
      secondaryHref: '/contact',
      propertySlug: '',
      capSlug: '',
      unitKey: '',
      photos: [],
      startsAt: '',
      endsAt: '',
      image: '',
      imageAlt: '',
    }
    if (await run((list) => [...list, card])) navigate(`/admin/featured/${card.id}`)
  }

  const move = (id, by) =>
    run((list) => {
      const next = [...list]
      const i = next.findIndex((c) => c.id === id)
      const j = i + by
      if (i < 0 || j < 0 || j >= next.length) return list
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const toggle = (id) => run((list) => list.map((c) => (c.id === id ? { ...c, visible: c.visible === false } : c)))
  const remove = (id) => run((list) => list.filter((c) => c.id !== id))

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Featured"
        description={`The carousel under the homepage hero — advertise a property, a CAP / NNN deal or a unit. ${showing} of ${cards.length} showing; they rotate in this order.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={create} disabled={busy}>
            New card
          </Button>
        }
      />

      {error && (
        <div className="mt-6">
          <Alert>Couldn&apos;t save — {error}</Alert>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {cards.length === 0 && (
          <EmptyState icon={Megaphone} title="Nothing featured" action={<Button variant="primary" icon={Plus} onClick={create} disabled={busy}>New card</Button>}>
            With no cards showing, the homepage simply skips this panel.
          </EmptyState>
        )}

        {cards.map((card, i) => {
          const media = featuredMedia(card, { properties, capListings })
          const badge = statusBadge(card)
          const kind = FEATURE_KINDS.find((k) => k.value === cardKind(card))
          const hidden = card.visible === false
          return (
            <Card key={card.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:flex-nowrap sm:p-4">
              <Link to={`/admin/featured/${card.id}`} className={`flex min-w-0 flex-1 items-center gap-4 rounded-xl ${focusRing}`}>
                <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black/20">
                  {media.images[0] && <img src={media.images[0]} alt="" className={`size-full object-cover ${hidden ? 'opacity-40' : ''}`} />}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[16px] font-medium text-bone">{plainHeading(card.heading) || 'Untitled card'}</span>
                    <Badge tone={badge.tone} dot>
                      {badge.text}
                    </Badge>
                    {card.badge && <Badge tone="ember">{card.badge}</Badge>}
                  </span>
                  <span className="block truncate text-xs text-bone-3">
                    {kind?.short} · {media.name} · {media.images.length} photo{media.images.length === 1 ? '' : 's'}
                  </span>
                </span>
              </Link>
              <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                <IconButton icon={hidden ? EyeSlash : Eye} label={hidden ? 'Show on the homepage' : 'Hide from the homepage'} size="sm" disabled={busy} onClick={() => toggle(card.id)} />
                <IconButton icon={ArrowUp} label="Move up" size="sm" disabled={busy || i === 0} onClick={() => move(card.id, -1)} />
                <IconButton icon={ArrowDown} label="Move down" size="sm" disabled={busy || i === cards.length - 1} onClick={() => move(card.id, 1)} />
                <Button size="sm" to={`/admin/featured/${card.id}`} icon={PencilSimple}>
                  Edit
                </Button>
                <ConfirmButton icon={Trash} onConfirm={() => remove(card.id)} />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
