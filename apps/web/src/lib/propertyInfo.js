// The /properties/:slug/info page, as data.
//
// Stored on the property itself, at `detail.info`, so the admin edits it with
// the rest of the property and nothing needs a migration — `detail` is already
// a JSON column. A property that predates the field falls back to a set
// shipped in code (data/centroPlazaInfo.js), the same way ContentContext's
// DEFAULTS cover a content row that hasn't been seeded. The first save from
// the admin's Info page tab writes the set into the row, and from then on the
// row is the source.
//
// Deliberately free of React and of the default payload: `lib/infoSets.js`
// answers "does this property have a page" for the cards without importing
// either.

/** One image in a band. `alt` describes it; `caption` is shown under it. */
export const makeInfoImage = () => ({ src: '', alt: '', caption: '' })

/**
 * One building on the info page: its photograph and its floor-plan sheet.
 *
 * Its own pair rather than the Floor plans tab's `planImage`, because they are
 * different artwork doing different jobs. `planImage` is the clean base drawing
 * the property page lays its interactive units over; the info page shows the
 * sales sheet — unit numbers, square footage, SOLD and UNDER CONTRACT marked on
 * it. The `label` is what ties the two together: a building here whose label
 * matches one in Floor plans shows that building's live unit counts.
 */
export const makeInfoBuilding = (label = '') => ({ label, photo: '', photoAlt: '', plan: '', planAlt: '', note: '' })

const imageSet = (tag) => ({ tag, heading: '', body: '', images: [] })

/** A blank page, for a property that has never had one. Off until published. */
export const emptyInfo = () => ({
  published: false,
  kicker: '',
  name: '',
  address: '',
  summary: '',
  heroImage: '',
  facts: [],
  site: imageSet('The Site'),
  buildings: { tag: 'Floor Plans', heading: '', body: '', items: [] },
  gallery: imageSet('As Built'),
  investment: imageSet('Investment'),
  links: [],
  contacts: [],
  email: '',
})

/**
 * The page for a property: what is stored, else the shipped default for that
 * slug, else nothing. Stored wins whole rather than being merged key by key —
 * an editor who empties a band means it, and a merge would bring it back.
 */
export function resolveInfo(property, slug, defaults) {
  const stored = property?.detail?.info
  if (stored && typeof stored === 'object') return { ...emptyInfo(), ...stored }
  const fallback = defaults?.[slug ?? property?.slug]
  return fallback ? { ...emptyInfo(), ...fallback } : null
}

export const isInfoLive = (info) => Boolean(info && info.published !== false)

/** The bands that hold images, in page order. */
export const IMAGE_BANDS = ['site', 'gallery', 'investment']

/** Digits and a leading + only, for a tel: link. */
export const telHref = (phone) => `tel:${String(phone ?? '').replace(/[^\d+]/g, '')}`

/** Key for matching an info building to a Floor plans building: "Building 07" ≈ "building 7". */
export const buildingKey = (label) =>
  String(label ?? '')
    .toLowerCase()
    .replace(/\b0+(\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
