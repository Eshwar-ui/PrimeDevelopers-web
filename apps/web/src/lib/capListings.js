// CAP / NNN listings — one tenanted unit offered with its lease in place.
//
// A listing is deliberately not a property. What an investor buys is one
// suite and the lease running on it: a price, a cap rate, a term, the rent and
// the NNN expenses the tenant carries. The property it sits in is context, and
// a listing may point at one (and at a unit within it) without depending on
// it — seven of the client's first seventeen are at an address the CMS has no
// property for yet.
//
// Stored as the `cap_listings` content section, so adding one needs no
// database change. Shipped defaults live in data/capListings.js and stay out
// of the main bundle; see useCapListings in components/CapListings.jsx.

import { slugify } from './slugify'

export const CAP_STATUSES = [
  // `priceLabel` follows the client's own sheets: an open listing shows its
  // purchase price, one under contract the price it was listed at, a sold one
  // what it sold for.
  { value: 'listed', label: 'Just listed', priceLabel: 'Purchase price', tone: 'available' },
  { value: 'under-contract', label: 'Under contract', priceLabel: 'Listed at', tone: 'ember' },
  { value: 'sold', label: 'Sold', priceLabel: 'Sold at', tone: 'sold' },
]

export const capStatus = (value) => CAP_STATUSES.find((s) => s.value === value) ?? CAP_STATUSES[0]

export const makeCapListing = () => ({
  id: `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  slug: '',
  published: false,
  status: 'listed',
  tenant: '',
  tagline: '',
  logo: '',
  photo: '',
  photos: [],
  address: '',
  propertySlug: '',
  unitLabel: '',
  units: '',
  sf: null,
  price: null,
  capRate: null,
  leaseTerm: null,
  rent: null,
  nnn: null,
  summary: '',
  highlights: [],
  flyerUrl: '',
})

/** "seven-oaks-coffee-unit-702" — readable, and unique while units are. */
export const capListingSlug = (listing) =>
  slugify([listing.tenant, listing.units && `unit ${listing.units}`].filter(Boolean).join(' ')) || listing.id

const isNumber = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * Price per square foot, worked out rather than stored. It is a pure function
 * of two figures already on the listing, and a stored copy is one that can
 * disagree with them — the client's own Devi Liquor sheet prints $618.18/SF
 * against a price and size that come to $512.00.
 */
export const pricePerSf = (l) => (isNumber(l.price) && isNumber(l.sf) && l.sf > 0 ? l.price / l.sf : null)

/** Rent over price, as a percentage — what the cap rate should be on a triple-net lease. */
export const impliedCapRate = (l) =>
  isNumber(l.rent) && isNumber(l.price) && l.price > 0 ? (l.rent / l.price) * 100 : null

/**
 * The implied rate when it disagrees with the stated one by a tenth of a
 * point or more, else null. Three of the client's seventeen sheets do; the
 * admin flags them rather than silently "fixing" a figure on a sales sheet.
 */
export const capRateMismatch = (l) => {
  const implied = impliedCapRate(l)
  return implied != null && isNumber(l.capRate) && Math.abs(implied - l.capRate) >= 0.1 ? implied : null
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const moneyCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export const formatMoney = (n) => (isNumber(n) ? money.format(n) : null)
export const formatPerSf = (n) => (isNumber(n) ? `${moneyCents.format(n)}/SF` : null)
export const formatSf = (n) => (isNumber(n) ? `${plain.format(n)} SF` : null)
export const formatPercent = (n) => (isNumber(n) ? `${plain.format(n)}%` : null)
export const formatYears = (n) => (isNumber(n) ? `${plain.format(n)} ${n === 1 ? 'year' : 'years'}` : null)

/** "Unit 1101, 1102" — the label as the sheets write it. */
export const unitLine = (units) => (units ? `Unit ${units}` : null)

/** The figures a listing page shows, in the order the client's sheets set them. */
export function capFigures(l) {
  return [
    { key: 'price', label: capStatus(l.status).priceLabel, value: formatMoney(l.price) },
    { key: 'perSf', label: 'Price per SF', value: isNumber(pricePerSf(l)) ? moneyCents.format(pricePerSf(l)) : null },
    { key: 'capRate', label: 'Cap rate', value: formatPercent(l.capRate) },
    { key: 'leaseTerm', label: 'Lease term', value: formatYears(l.leaseTerm) },
    { key: 'rent', label: 'Yearly rental income', value: formatMoney(l.rent) },
    { key: 'nnn', label: 'Yearly NNN expenses', value: formatMoney(l.nnn) },
  ].filter((f) => f.value)
}
