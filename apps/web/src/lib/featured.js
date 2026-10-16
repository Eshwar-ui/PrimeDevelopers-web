// The homepage featured carousel, as data — shared by the carousel and the
// admin's Featured section so a preview there is the card the homepage shows.
//
// Cards live in the `featured_home` content section (`cards[]`). On top of the
// copy and buttons they always had, each card now carries:
//   kind       'property' | 'cap' | 'unit' | 'custom' — what it advertises
//   capSlug    the CAP / NNN deal, for kind 'cap'
//   unitKey    "building-slug/unit-slug" within propertySlug, for kind 'unit'
//   visible    false hides it without deleting
//   startsAt / endsAt   'YYYY-MM-DD', inclusive, in the visitor's own date
//   badge      a label on the photo — "Just listed", "Price reduced"
//   photos     the photos it rotates through; empty means the defaults below

import { coverImage, propertyPhotos } from './covers'
import { findUnitBySlugs, formatUnitLabel, getUnitImages } from './units'

export const FEATURE_KINDS = [
  { value: 'property', label: 'A property', short: 'Property' },
  { value: 'cap', label: 'A CAP / NNN deal', short: 'CAP / NNN deal' },
  { value: 'unit', label: 'A unit', short: 'Unit' },
  { value: 'custom', label: 'Something else (upload a photo)', short: 'Custom' },
]

const MAX_PHOTOS = 6

/**
 * What a card advertises. Cards saved before `kind` existed are a property
 * card when they name one (or link to one), and a custom card otherwise.
 */
export const cardKind = (card) =>
  card?.kind || (card?.propertySlug || /^\/properties\/[^/?#]+/.test(card?.ctaHref ?? '') ? 'property' : 'custom')

/** The cards, with stable ids. A row saved before the list existed is one card. */
export function featuredCards(section) {
  const cards = section?.cards?.length ? section.cards : section?.heading ? [section] : []
  return cards.map((card, i) => ({ ...card, id: card.id ?? `card-${i}` }))
}

/** Today in the visitor's own calendar, as YYYY-MM-DD — what the date inputs store. */
export const todayISO = () => new Date().toLocaleDateString('en-CA')

/**
 * Where a card stands: 'showing', 'hidden' (switched off), 'scheduled' (its
 * start date is still ahead), 'ended' (its end date has passed) or 'draft'
 * (no heading — the carousel has always skipped those).
 */
export function cardStatus(card, today = todayISO()) {
  if (!card?.heading) return 'draft'
  if (card.visible === false) return 'hidden'
  if (card.startsAt && today < card.startsAt) return 'scheduled'
  if (card.endsAt && today > card.endsAt) return 'ended'
  return 'showing'
}

export const isCardShowing = (card, today) => cardStatus(card, today) === 'showing'

const dateLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** The status in words — "Showing until 3 Nov 2026", "Starts 1 Dec 2026". */
export function cardStatusText(card, today) {
  const status = cardStatus(card, today)
  if (status === 'showing') return card.endsAt ? `Showing until ${dateLabel(card.endsAt)}` : 'Showing'
  if (status === 'scheduled') return `Starts ${dateLabel(card.startsAt)}`
  if (status === 'ended') return `Ended ${dateLabel(card.endsAt)}`
  if (status === 'hidden') return 'Hidden'
  return 'Needs a heading'
}

/** The heading without its *emphasis* markers or line breaks. */
export const plainHeading = (heading) => String(heading ?? '').replace(/\*/g, '').replace(/\s*\n\s*/g, ' ').trim()

/** The property a property or unit card points at — by `propertySlug`, or by its primary link. */
export function linkedProperty(card, properties) {
  const slug = card?.propertySlug || card?.ctaHref?.match(/^\/properties\/([^/?#]+)/)?.[1]
  return slug ? (properties ?? []).find((p) => p.slug === slug) : undefined
}

/**
 * The photos a card rotates through, and the name they're described by.
 * The admin's own choice (`photos`) wins; otherwise each kind brings its own.
 */
export function featuredMedia(card, { properties, capListings }) {
  const kind = cardKind(card)
  const chosen = (card.photos ?? []).filter(Boolean)
  const pick = (defaults) => [...new Set(chosen.length ? chosen : defaults.filter(Boolean))].slice(0, MAX_PHOTOS)

  if (kind === 'cap') {
    const deal = (capListings ?? []).find((l) => l.slug === card.capSlug)
    return { images: pick([deal?.photo, ...(deal?.photos ?? [])]), name: deal?.tenant ?? card.imageAlt ?? 'Featured deal', deal }
  }
  if (kind === 'unit') {
    const property = linkedProperty(card, properties)
    const [b, u] = String(card.unitKey ?? '').split('/')
    const found = property && b && u ? findUnitBySlugs(property, b, u) : null
    const images = found ? getUnitImages(found.unit) : []
    return {
      images: pick(images.length ? images : [coverImage(property, 'unitFallback')]),
      name: found ? `Unit ${formatUnitLabel(found.unit.label)} at ${property.name}` : property?.name ?? 'Featured unit',
      property,
      found,
    }
  }
  if (kind === 'property') {
    const property = linkedProperty(card, properties)
    if (property) {
      return { images: pick([coverImage(property, 'featured'), property.image, ...(property.gallery ?? [])]), name: property.name, property }
    }
  }
  return { images: pick([card.image]), name: card.imageAlt || 'Featured' }
}

/** Every photo the admin could choose for a card — the picker's options. */
export function featuredPhotoOptions(card, { properties, capListings }) {
  const kind = cardKind(card)
  if (kind === 'cap') {
    const deal = (capListings ?? []).find((l) => l.slug === card.capSlug)
    return [...new Set([deal?.photo, ...(deal?.photos ?? [])].filter(Boolean))]
  }
  const property = linkedProperty(card, properties)
  const [b, u] = String(card.unitKey ?? '').split('/')
  const found = kind === 'unit' && property && b && u ? findUnitBySlugs(property, b, u) : null
  return [...new Set([...(found ? getUnitImages(found.unit) : []), ...propertyPhotos(property)].filter(Boolean))]
}

/** Where the primary button goes when the admin left its link blank. */
export function primaryHref(card) {
  if (card?.ctaHref) return card.ctaHref
  const kind = cardKind(card)
  if (kind === 'cap' && card.capSlug) return `/cap-properties/${card.capSlug}`
  if (kind === 'unit' && card.propertySlug && card.unitKey) return `/properties/${card.propertySlug}/units/${card.unitKey}`
  if (card?.propertySlug) return `/properties/${card.propertySlug}`
  return '/properties'
}
