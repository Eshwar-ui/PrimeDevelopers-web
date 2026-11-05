// Searching and filtering the collection — the one place that knows how a
// property or a unit is matched against what someone typed.
//
// Lives apart from the page because both halves of /properties read it and
// they have to agree: a search for "Leander" must return the same development
// whether the visitor is looking at properties or at the units inside them.
// The page owns the controls and the URL; this file owns the matching.

// Extensions spelled out, unlike most of the app: the matching rules are
// covered by `test/collectionSearch.test.js`, which runs under plain Node with
// no bundler to resolve a bare `./units` for it.
import { getBuildings, getUnits, formatArea, unitSF } from './units.js'
import { unitStatusMeta, UNIT_STATUSES } from './unitStatus.js'
import { tierNameFor, SIZE_TIERS } from './unitTiers.js'

/* ── text ──────────────────────────────────────────────────────────────── */

// Commas vanish rather than splitting: a size is typed "1,500" and an address
// "Leander, TX", so a comma is a thousands separator as often as it is a
// break. Removing it outright makes "1500" find the first and leaves the
// second split by its own space.
const clean = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/,/g, '')

export const tokenize = (value) => clean(value).split(/[^a-z0-9]+/).filter(Boolean)

/**
 * A haystack field: its tokens and how much a hit in it is worth.
 *
 * Weights are what keep a search for a tenant's name from being answered by
 * the one unit whose free-text description happens to mention them. Three
 * tiers only — the name of the thing, the facts about it, and the prose —
 * because a finer scale is unfalsifiable at this size.
 */
const field = (text, weight) => ({ tokens: tokenize(text), weight })

// Words people type for a status that the status itself doesn't contain. A
// tenant hunting space types "vacant" or "open"; the record says "available".
// Folded into the status field rather than handled as a special case, so they
// score and sort exactly like any other hit.
const STATUS_WORDS = {
  available: 'available vacant open free to let lease leasing',
  leased: 'leased let rented occupied taken',
  'coming-soon': 'coming soon upcoming soon pending',
  sold: 'sold gone',
}

/**
 * Every query token has to land somewhere, and the score is the sum of each
 * one's best hit. Returns 0 for "no match" so callers can filter on it.
 *
 * All tokens required, rather than any: typing a second word is how someone
 * narrows a list, and a scoring-only match would widen it instead — "centro
 * retail" would return every retail unit in the portfolio ranked below the
 * ones at Centro, which is not what the typing meant.
 */
export function score(fields, queryTokens) {
  let total = 0
  for (const query of queryTokens) {
    let best = 0
    for (const { tokens, weight } of fields) {
      for (const token of tokens) {
        // Exact, then prefix, then anywhere. Prefix is the one that matters in
        // practice — it is what makes a list narrow as someone types rather
        // than only once they finish the word.
        const hit = token === query ? 3 : token.startsWith(query) ? 2 : token.includes(query) ? 1 : 0
        if (hit * weight > best) best = hit * weight
      }
    }
    if (best === 0) return 0
    total += best
  }
  return total
}

/* ── haystacks ─────────────────────────────────────────────────────────── */

/** Every tenant and trade inside one property record, as one string. */
export const tenantText = (property) =>
  getBuildings(property)
    .flatMap((building) => getUnits(building))
    .map((unit) => `${unit.tenant ?? ''} ${unit.tenantCategory ?? ''}`)
    .join(' ')

/**
 * What a property can be found by — including the tenants trading inside it.
 *
 * The tenant list is the non-obvious half and the useful one: someone who
 * knows the plaza with the pharmacy in it does not know it is called Centro
 * Plaza. The tenants are weighted lowest so a property never outranks the
 * unit that actually holds the tenant searched for.
 *
 * `tenants` is overridable because a card in a list is not always one record:
 * a phased development is collapsed to its first phase (see collapsePhases),
 * which carries only that phase's units, so the caller passes the tenants of
 * every phase and the card stays findable by all of them.
 */
export function propertyFields(property, tenants = tenantText(property)) {
  return [
    field(property.name, 3),
    field(property.address, 2),
    field(property.category, 2),
    field((property.detail?.specs ?? []).join(' '), 1),
    field(tenants, 1),
  ]
}

/** What a unit can be found by. `row` is one entry from `collectUnits()`. */
export function unitFields({ property, building, unit, sf }) {
  return [
    field(unit.label, 3),
    field(unit.tenant, 3),
    field(unit.tenantCategory, 2),
    field(property.name, 2),
    field(property.address, 2),
    field(property.category, 2),
    field(building?.building, 1),
    field(`${unit.size ?? ''} ${formatArea(unit.size) ?? ''} ${tierNameFor(sf) ?? ''}`, 1),
    field(STATUS_WORDS[unit.status] ?? unitStatusMeta(unit.status).label, 1),
    field(`${unit.floor ?? ''} ${unit.frontage ?? ''} ${unit.facingRoad ?? ''}`, 1),
    field(unit.description, 0.5),
  ]
}

/**
 * Score a list against a query, keeping the hits and the order they were in
 * when the query is empty.
 *
 * `rank` rides along on each row rather than being sorted here, because
 * relevance is only one of the orders the page offers — see `SORTS`. A row
 * keeps its place in the incoming order until something asks for relevance.
 */
export function searchRows(rows, query, fieldsOf) {
  const tokens = tokenize(query)
  if (!tokens.length) return rows.map((row) => ({ row, rank: 0 }))
  const out = []
  for (const row of rows) {
    const rank = score(fieldsOf(row), tokens)
    if (rank > 0) out.push({ row, rank })
  }
  return out
}

/* ── facets ────────────────────────────────────────────────────────────── */

// The orders the collection can be read in, per view. `relevance` is not in
// either list: it is what a search sorts by on its own, and offering it as a
// choice when nothing has been typed would be an option that does nothing.
export const PROPERTY_SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'available', label: 'Most available' },
  { id: 'size', label: 'Most units' },
  { id: 'name', label: 'Name (A–Z)' },
]

export const UNIT_SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'size-desc', label: 'Largest first' },
  { id: 'size-asc', label: 'Smallest first' },
  { id: 'property', label: 'Property (A–Z)' },
]

const byName = (a, b) => String(a ?? '').localeCompare(String(b ?? ''))

/** Sorted properties. `featured` is the order the admin set, which is the
 *  order they arrive in — so it sorts by not sorting. */
export function sortProperties(entries, sort) {
  const rows = [...entries]
  if (sort === 'relevance') return rows.sort((a, b) => b.rank - a.rank)
  if (sort === 'available') return rows.sort((a, b) => (b.row.available ?? 0) - (a.row.available ?? 0))
  if (sort === 'size') return rows.sort((a, b) => (b.row.buildings ?? 0) - (a.row.buildings ?? 0))
  if (sort === 'name') return rows.sort((a, b) => byName(a.row.name, b.row.name))
  return rows
}

/** Sorted units. `recommended` is `collectUnits()`'s own order — available
 *  first, then smallest within each status — which is what the list arrives
 *  in, so like `featured` above it sorts by leaving well alone. */
export function sortUnits(entries, sort) {
  const rows = [...entries]
  if (sort === 'relevance') return rows.sort((a, b) => b.rank - a.rank)
  if (sort === 'size-desc') return rows.sort((a, b) => b.row.sf - a.row.sf)
  if (sort === 'size-asc') return rows.sort((a, b) => a.row.sf - b.row.sf)
  if (sort === 'property') {
    return rows.sort(
      (a, b) => byName(a.row.property.name, b.row.property.name) || a.row.sf - b.row.sf,
    )
  }
  return rows
}

/* ── the filter set ────────────────────────────────────────────────────── */

/**
 * Everything the controls can be set to, as one object. Held in the URL by
 * the page (see `readFilters`), so a filtered view is a link someone can send
 * — which is the whole reason a leasing agent would use these controls at all.
 */
export const EMPTY_FILTERS = {
  q: '',
  category: 'All',
  status: 'any',
  size: 'all',
  property: 'any',
  availableOnly: false,
  sort: '',
}

export const isDefault = (filters, key) => filters[key] === EMPTY_FILTERS[key]

/**
 * How many controls are set — what the "Clear" button counts, and what tells
 * an empty result apart from an empty portfolio.
 *
 * Per view, because the two do not share every axis. `availableOnly` is the
 * properties view's own: a development "has space left". A unit's availability
 * is its `status`, which the units view already filters on — counting both
 * there would have made one axis worth two.
 */
export const activeCount = (filters, view) =>
  (view === 'units'
    ? ['q', 'category', 'status', 'size', 'property']
    : ['q', 'category', 'availableOnly']
  ).filter((key) => !isDefault(filters, key)).length

// Each non-text control as a predicate, keyed so facet counts can leave one
// out — see `countBy`. A count that included its own control would read
// "Retail 12" on a list already narrowed to retail, which says nothing.
const UNIT_TESTS = {
  category: (f) => (row) => f.category === 'All' || row.property.category === f.category,
  status: (f) => (row) => f.status === 'any' || row.unit.status === f.status,
  size: (f) => {
    const test = SIZE_TIERS.find((t) => t.id === f.size)?.test ?? (() => true)
    return (row) => test(row.sf)
  },
  property: (f) => (row) => f.property === 'any' || row.property.slug === f.property,
  // No `availableOnly` here. It tested `status === 'available'`, which `status`
  // above already does — two keys for one axis, and two controls on the bar
  // that could be set to contradict each other. The switch on the units view
  // writes `status` instead, so the shortcut and the full menu are one state.
}

const PROPERTY_TESTS = {
  category: (f) => (row) => f.category === 'All' || row.category === f.category,
  availableOnly: (f) => (row) => !f.availableOnly || (row.available ?? 0) > 0,
}

const applyTests = (rows, tests, filters, except) =>
  rows.filter((row) =>
    Object.entries(tests).every(([key, make]) => key === except || make(filters)(row)),
  )

export const filterUnits = (rows, filters, except) => applyTests(rows, UNIT_TESTS, filters, except)
export const filterProperties = (rows, filters, except) =>
  applyTests(rows, PROPERTY_TESTS, filters, except)

/**
 * How many rows each option of one control would return, with every *other*
 * control (and the search) still applied.
 *
 * This is what makes the controls honest. Without it a visitor picks "Office"
 * on a list already narrowed to one plaza, gets nothing, and has no way to
 * tell whether the portfolio has no offices or whether they simply chose two
 * things that don't overlap. With it, the empty options say so before they
 * are clicked.
 */
export function countBy(rows, keyOf) {
  const counts = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    if (key == null) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Status options that exist anywhere in the portfolio, in the legend's own
 *  order — a status nothing uses is never offered. */
export const statusOptions = (rows) => {
  const present = new Set(rows.map((row) => row.unit.status || 'available'))
  return UNIT_STATUSES.filter((s) => present.has(s.value))
}

/* ── URL ───────────────────────────────────────────────────────────────── */

// Short keys, because these end up in links people paste. `q` and `cat` read
// as what they are; the rest are already the word the control uses.
const PARAM = {
  q: 'q',
  category: 'cat',
  status: 'status',
  size: 'size',
  property: 'at',
  availableOnly: 'avail',
  sort: 'sort',
}

/** Filters as the URL currently holds them, defaults filled in. */
export function readFilters(params) {
  const out = { ...EMPTY_FILTERS }
  for (const [key, param] of Object.entries(PARAM)) {
    const raw = params.get(param)
    if (raw == null) continue
    out[key] = key === 'availableOnly' ? raw === '1' : raw
  }
  return out
}

/**
 * The same params with the filters written back — defaults deleted rather
 * than written, so an untouched page keeps a clean `/properties` and a link
 * carries only what was actually chosen.
 */
export function writeFilters(params, filters) {
  const next = new URLSearchParams(params)
  for (const [key, param] of Object.entries(PARAM)) {
    const value = filters[key]
    if (value === EMPTY_FILTERS[key] || value === '' || value === false) next.delete(param)
    else next.set(param, value === true ? '1' : String(value))
  }
  return next
}

/** Square feet as the summary line writes it — "1,200" , not "1200 sq ft". */
export const totalSF = (rows) =>
  rows.reduce((sum, row) => sum + (row.sf || unitSF(row.unit?.size)), 0)
