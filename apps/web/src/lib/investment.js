// Per-building investment (CAP rate) detail.
//
// A building on this site has always described *space* — units, sizes, who is
// in them. This describes the same building as an **asset**: what it earns,
// what it costs, and on what terms. The two are deliberately separate objects
// on the same building rather than more fields on the unit list, because they
// answer to different readers and only one of them is ever published.
//
// Until the client supplies figures the whole block is empty, and every
// consumer here is built to read empty as "omit this", never as "0" or "—".
// A half-filled investment page has to look deliberate, because that is the
// state it will be in for a while.

import { getUnits } from './units'

/**
 * Every field the editor writes, in one place.
 *
 * Strings, not numbers, for the same reason `size` on a unit is a string: the
 * client types "$2,602,800" and "7.10%", and the moment this parses them it
 * owns currency formatting, locale and rounding for figures it only ever
 * echoes back. Nothing computes with these.
 */
export const makeInvestment = () => ({
  // Gates the *links* into the page, not the page itself — see
  // `isInvestmentLinkable`. An unpublished building is still reachable by URL
  // so the client can preview it before it goes in front of anyone.
  published: false,
  askingPrice: '',
  noi: '',
  capRate: '',
  pricePerSf: '',
  buildingSize: '',
  occupancy: '',
  yearBuilt: '',
  leaseTerm: '',
  tenantCovenant: '',
  summary: '',
  highlights: [],
  // The existing external flyer, kept alongside rather than replaced. The PDF
  // is what a broker forwards; this page is what a visitor reads.
  flyerUrl: '',
})

export const getInvestment = (building) => building?.investment ?? null

/** Has the client put anything in it at all? */
export const hasInvestmentData = (building) => {
  const inv = getInvestment(building)
  if (!inv) return false
  return FIGURES.some(({ key }) => String(inv[key] ?? '').trim()) ||
    Boolean(String(inv.summary ?? '').trim()) ||
    (inv.highlights ?? []).some((h) => String(h ?? '').trim())
}

/** Should anything on the site link to it? Published *and* not blank. */
export const isInvestmentLinkable = (building) =>
  Boolean(getInvestment(building)?.published) && hasInvestmentData(building)

/**
 * The headline figures, in reading order.
 *
 * Order is the design: price and yield are what an investor looks for first,
 * so they lead; the descriptive figures follow. Exported as data rather than
 * hard-coded in the page so the admin form and the page cannot drift.
 */
export const FIGURES = [
  { key: 'askingPrice', label: 'Asking price', placeholder: '$2,602,800' },
  { key: 'capRate', label: 'CAP rate', placeholder: '7.10%' },
  { key: 'noi', label: 'NOI', placeholder: '$184,798' },
  { key: 'pricePerSf', label: 'Price / SF', placeholder: '$450' },
  { key: 'buildingSize', label: 'Building size', placeholder: '5,784 SF' },
  { key: 'occupancy', label: 'Occupancy', placeholder: '100%' },
  { key: 'leaseTerm', label: 'Lease term', placeholder: '10 yr NNN, 3% annual' },
  { key: 'tenantCovenant', label: 'Tenant covenant', placeholder: 'Corporate guarantee' },
  { key: 'yearBuilt', label: 'Year built', placeholder: '2024' },
]

/** Only the figures actually filled in — the page renders nothing else. */
export const filledFigures = (investment) =>
  FIGURES.map(({ key, label }) => ({ key, label, value: String(investment?.[key] ?? '').trim() }))
    .filter(({ value }) => value)

/**
 * A building's rent roll, derived from the unit list rather than re-entered.
 *
 * The tenants, sizes and statuses are already maintained in one place and kept
 * in step with Prime Tracker; asking the client to type them again into an
 * investment form would guarantee the two disagree within a month.
 */
export const rentRoll = (building) =>
  getUnits(building)
    .map((unit) => ({
      label: unit.label,
      tenant: String(unit.tenant ?? '').trim(),
      size: String(unit.size ?? '').trim(),
      rate: String(unit.rate ?? '').trim(),
      status: unit.status || 'available',
    }))
    .filter((row) => String(row.label ?? '').trim())

/**
 * URL-safe form of a building label — "Building 10" → "building-10".
 *
 * Slugged rather than indexed for the reason PropertyDetailPage gives about
 * `?building=`: an index breaks the moment the client reorders buildings in
 * the admin, and these are links people send each other.
 */
export const buildingSlug = (label) =>
  String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const findBuildingBySlug = (buildings, slug) =>
  (buildings ?? []).find((b) => buildingSlug(b?.building) === String(slug ?? '').toLowerCase()) ?? null

/**
 * Match a resource link like "CAP Rate flyer B9 · Lava Leander" to its building.
 *
 * The client writes these labels by hand and has used "B1", "B-01" and "B 6",
 * so the number is the only part worth trusting. Returns null rather than
 * guessing when there is no building with that number — a link that cannot be
 * resolved stays an ordinary external link, which is what it was before.
 */
export const buildingFromResourceLabel = (label, buildings) => {
  if (!/cap\s*rate/i.test(String(label ?? ''))) return null
  const match = String(label).match(/\bB[\s-]*0*(\d+)\b/i)
  if (!match) return null
  const number = Number(match[1])
  return (
    (buildings ?? []).find((b) => Number(b?.number) === number) ??
    (buildings ?? []).find((b) => buildingSlug(b?.building) === `building-${number}`) ??
    null
  )
}
