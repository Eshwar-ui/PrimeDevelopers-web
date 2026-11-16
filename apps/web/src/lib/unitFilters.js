// Search and filters for a list of units — the public /properties?view=units
// and the admin Units page read the same rows through here, so the two cannot
// disagree about what "under 1,000 SF" or "lease under $25" means.
//
// It is a table, not a pile of ifs: a search is a list of readers (SEARCH_TEXT)
// and a filter is a facet with options (UNIT_FACETS). The next filter — clear
// height, tenant category, a property picker — is one more entry in the table;
// the bar draws whatever facets it is given, the URL carries whatever ids they
// declare, and the counts beside every option come for free from `facetCounts`.
//
// Rows are collectUnits()'s: `{ property, building, unit, sf }`.

import { SIZE_TIERS } from './unitTiers.js'
import { UNIT_STATUSES } from './unitStatus.js'
import { formatUnitLabel, parsePrice } from './units.js'

/* ── search ─────────────────────────────────────────────────────────── */

// What a visitor can type to find a unit, in two kinds. Each reader returns
// text or a list of it; add one and the search finds that too. The unit's
// tenant is only there for units the API sent one for, so nothing private is
// searchable.
//
// IDENTITY is what a number can name: the unit's own number, its building's,
// its measurements. PROSE is everything else, and its digits are noise — a
// street number, a ZIP code — which is why a typed number is matched against
// IDENTITY alone. "Building 7" once matched every unit in a property whose ZIP
// is 78641.
const IDENTITY = [
  ({ unit }) => [`unit ${formatUnitLabel(unit.label)}`, unit.label],
  ({ building }) => building?.building,
  ({ unit }) => [unit.clearHeight, unit.frontage],
]

const PROSE = [
  ({ property }) => [property.name, property.address, property.category],
  ({ unit }) => [unit.tenant, unit.tenantCategory],
  ({ unit }) => unit.description,
]

const textOf = (readers, row) =>
  readers
    .flatMap((read) => [read(row)].flat())
    .map((part) => String(part ?? '').toLowerCase())
    .join(' \n ')

const wordsOf = (text) => text.split(/[^a-z0-9]+/).filter(Boolean)

/**
 * Every word typed must be found — in any order, whatever the case. A word is
 * looked for anywhere in the unit's text, except a number, which has to begin
 * one of the unit's own numbers: "704" finds unit 703+704, "7" finds Building 7
 * and the 7xx units, and neither finds a street address.
 */
export function matchesQuery(row, query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const identity = textOf(IDENTITY, row)
  const everything = `${identity} \n ${textOf(PROSE, row)}`
  const numbers = wordsOf(identity)
  return words.every((word) => (/^\d+$/.test(word) ? numbers.some((n) => n.startsWith(word)) : everything.includes(word)))
}

/* ── facets ─────────────────────────────────────────────────────────── */

const lease = ({ unit }) => parsePrice(unit.leasePrice)
const sale = ({ unit }) => parsePrice(unit.salePrice)

// Bands are plain data so they are easy to retune once real prices are in. The
// edges are per sq ft per year for a lease and total dollars for a sale — the
// two units the site quotes them in. `unit.leasePrice` and `salePrice` are only
// whatever the API sent, so a price a visitor cannot see is never filtered on.
const band = (id, label, read, min, max) => ({
  id,
  label,
  test: (row) => {
    const n = read(row)
    return n !== null && n >= min && n < max
  },
})

const PRICE_OPTIONS = [
  band('lease-lt-25', 'Lease · under $25 / SF / yr', lease, 0, 25),
  band('lease-25-35', 'Lease · $25 – $35 / SF / yr', lease, 25, 35),
  band('lease-35', 'Lease · $35+ / SF / yr', lease, 35, Infinity),
  band('sale-lt-500k', 'Sale · under $500K', sale, 0, 500_000),
  band('sale-500k-1m', 'Sale · $500K – $1M', sale, 500_000, 1_000_000),
  band('sale-1m', 'Sale · $1M+', sale, 1_000_000, Infinity),
  // A unit with no price to show — the tracker has none, or the editor kept it
  // private — is not an error to hide but a question to ask the team.
  { id: 'on-request', label: 'Price on request', test: (row) => lease(row) === null && sale(row) === null },
]

/**
 * The filters, in the order the bar shows them. An option's `id` is what the
 * URL carries, so renaming an id breaks links people have sent.
 *
 * `test(row)` is whether a unit belongs under the option. The "any" choice is
 * implicit: an empty value, with `anyLabel` as its words.
 */
export const UNIT_FACETS = [
  {
    id: 'status',
    label: 'Availability',
    anyLabel: 'Any availability',
    options: UNIT_STATUSES.map((s) => ({
      id: s.value,
      label: s.label,
      test: ({ unit }) => (unit.status || 'available') === s.value,
    })),
  },
  {
    id: 'size',
    label: 'Size',
    anyLabel: 'Any size',
    // The same bands as the homepage's pills, so a link from one lands on the
    // other already filtered.
    options: SIZE_TIERS.filter((t) => t.id !== 'all').map((t) => ({ id: t.id, label: t.label, test: (row) => t.test(row.sf) })),
  },
  { id: 'price', label: 'Pricing', anyLabel: 'Any price', options: PRICE_OPTIONS },
]

export const EMPTY_FILTERS = Object.freeze({ q: '', ...Object.fromEntries(UNIT_FACETS.map((f) => [f.id, ''])) })

const optionOf = (facet, id) => facet.options.find((o) => o.id === id)

/** Filters as they sit in the URL (`?q=…&status=…`). An id no option has — an old or hand-typed link — reads as "any". */
export function readFilters(params) {
  const get = (key) => params?.get?.(key) ?? ''
  const filters = { ...EMPTY_FILTERS, q: get('q').slice(0, 80) }
  for (const facet of UNIT_FACETS) if (optionOf(facet, get(facet.id))) filters[facet.id] = get(facet.id)
  return filters
}

/** `params` with the filters written in and every empty one removed. A copy; `params` is not touched. */
export function writeFilters(params, filters) {
  const next = new URLSearchParams(params)
  for (const key of ['q', ...UNIT_FACETS.map((f) => f.id)]) {
    const value = String(filters[key] ?? '').trim()
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

export const activeFilterCount = (filters) =>
  (String(filters.q ?? '').trim() ? 1 : 0) + UNIT_FACETS.filter((f) => filters[f.id]).length

/** The rows that pass the search and every facet — except `skip`, which is how a facet counts its own options. */
export function filterUnits(rows, filters, { skip } = {}) {
  const tests = UNIT_FACETS.filter((f) => f.id !== skip && filters[f.id]).map((f) => optionOf(f, filters[f.id]).test)
  return rows.filter((row) => matchesQuery(row, filters.q) && tests.every((test) => test(row)))
}

/**
 * How many units each option would show, for the number beside it. A facet's
 * options are counted with every other filter applied but not its own, so
 * picking "Sold" does not make every other status read 0 — each option says
 * what choosing it instead would give.
 */
export function facetCounts(rows, filters) {
  const counts = {}
  for (const facet of UNIT_FACETS) {
    const scope = filterUnits(rows, filters, { skip: facet.id })
    counts[facet.id] = Object.fromEntries(facet.options.map((o) => [o.id, scope.filter(o.test).length]))
  }
  return counts
}
