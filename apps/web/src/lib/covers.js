// Which photo of a property shows where.
//
// A property's main image used to be the only lever: thirteen placements read
// `property.image`, so the first property's photo could appear five times on
// the homepage alone. Each placement can now name its own photo, stored on the
// property at `detail.covers[placement]` (no migration — `detail` is JSON), and
// falls back to the main image when it doesn't.
//
// Every component that shows a property's photo asks `coverImage(property,
// placement)` rather than reading `image` itself, so this list is the whole
// map of where a property appears.

export const COVER_PLACEMENTS = [
  { key: 'featured', group: 'Homepage', label: 'Featured carousel', where: 'The first photo of a featured card', aspect: 'aspect-[16/10]' },
  { key: 'homeTeaser', group: 'Homepage', label: 'Our properties teaser', where: 'The three property cards under the hero', aspect: 'aspect-[16/10]' },
  { key: 'mosaic', group: 'Homepage', label: 'Explore our properties', where: 'The four-photo mosaic', aspect: 'aspect-[4/5]' },
  { key: 'unitFallback', group: 'Homepage', label: 'Unit cards (no unit photo)', where: 'A unit card or unit page whose unit has no photo of its own', aspect: 'aspect-[4/3]' },
  { key: 'listingsHero', group: 'Properties page', label: 'Page hero band', where: 'Behind the /properties heading — the first property with one', aspect: 'aspect-[21/9]' },
  { key: 'listingCard', group: 'Properties page', label: 'Listing card', where: 'The first photo of its card on /properties', aspect: 'aspect-[16/10]' },
  { key: 'detailHero', group: 'Property page', label: 'Hero', where: 'Full screen at the top of the property’s own page', aspect: 'aspect-[16/9]' },
  { key: 'footerCard', group: 'Every page', label: 'Footer card', where: '“Properties worth a look” above the footer', aspect: 'aspect-[16/10]' },
  { key: 'thumbnail', group: 'Every page', label: 'Small thumbnail', where: 'Property pickers on the Franchise, Collab and Interiors pages', aspect: 'aspect-square' },
]

export const COVER_GROUPS = [...new Set(COVER_PLACEMENTS.map((p) => p.group))]

/** The photo a placement shows: its own choice, else the main image. */
export const coverImage = (property, placement) => property?.detail?.covers?.[placement] || property?.image || null

/**
 * Every photo the property already has, for the picker: main image, gallery,
 * exterior strip and each unit's own photos — de-duplicated, in that order.
 */
export function propertyPhotos(property) {
  const units = (property?.detail?.floorPlans?.buildings ?? []).flatMap((b) => (b.unitList ?? []).flatMap((u) => u.images ?? []))
  return [...new Set([property?.image, ...(property?.gallery ?? []), ...(property?.detail?.extFacade ?? []), ...units].filter(Boolean))]
}
