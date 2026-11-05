import test from 'node:test'
import assert from 'node:assert/strict'

import {
  EMPTY_FILTERS,
  activeCount,
  countBy,
  filterProperties,
  filterUnits,
  propertyFields,
  readFilters,
  searchRows,
  sortUnits,
  statusOptions,
  tokenize,
  unitFields,
  writeFilters,
} from '../src/lib/collectionSearch.js'
import { collectUnits } from '../src/lib/units.js'

// Two developments, five units between them: enough to tell a property hit
// from a unit hit and to put a tenant in one place and its name nowhere else.
const unit = (over) => ({ label: '', status: 'available', tenant: '', size: '', ...over })

const centro = {
  name: 'Centro Plaza',
  slug: 'centro-plaza',
  address: '14300 Ronald Reagan Blvd, Leander, TX 78641',
  category: 'Retail',
  buildings: 85,
  sold: 63,
  available: 22,
  detail: {
    floorPlans: {
      buildings: [
        {
          building: 'Building 1',
          unitList: [
            unit({ label: '101', size: '1,200', tenant: 'Sangam Grocers', status: 'leased', tenantCategory: 'Grocery' }),
            unit({ label: '102', size: '850' }),
            unit({ label: '103', size: '2,400', status: 'coming-soon' }),
          ],
        },
      ],
    },
  },
}

const lewisville = {
  name: 'POW Lewisville',
  slug: 'pow-lewisville',
  address: '2601 State Hwy 121, Lewisville, TX 75067',
  category: 'Flex',
  buildings: 154,
  sold: 126,
  available: 28,
  detail: {
    floorPlans: {
      buildings: [
        {
          building: 'Building A',
          unitList: [
            unit({ label: '201', size: '5,000' }),
            unit({ label: '202', size: '600', status: 'sold' }),
          ],
        },
      ],
    },
  },
}

const properties = [centro, lewisville]
const units = collectUnits(properties)
const hits = (rows, q, fieldsOf) => searchRows(rows, q, fieldsOf).map((h) => h.row)
const filters = (over) => ({ ...EMPTY_FILTERS, ...over })

/* ── text ──────────────────────────────────────────────────────────────── */

test('a comma inside a number is not a word break', () => {
  // "1,200" has to be findable as 1200 — the admin types the separator and the
  // visitor does not.
  assert.deepEqual(tokenize('1,200 sq ft'), ['1200', 'sq', 'ft'])
  // A comma between words still is one.
  assert.deepEqual(tokenize('Leander, TX'), ['leander', 'tx'])
})

test('accents fold', () => {
  assert.deepEqual(tokenize('Café'), ['cafe'])
})

/* ── matching ──────────────────────────────────────────────────────────── */

test('a prefix finds the row, so the list narrows while it is typed', () => {
  assert.deepEqual(
    hits(properties, 'lean', propertyFields).map((p) => p.slug),
    ['centro-plaza'],
  )
})

test('every word has to land — a second word narrows rather than widens', () => {
  const both = hits(units, 'centro 103', unitFields)
  assert.equal(both.length, 1)
  assert.equal(both[0].unit.label, '103')

  // "centro" alone matches three; adding a word that nothing at Centro carries
  // must return none, not fall back to the three.
  assert.equal(hits(units, 'centro', unitFields).length, 3)
  assert.equal(hits(units, 'centro warehouse', unitFields).length, 0)
})

test('a property is findable by a tenant trading inside it', () => {
  assert.deepEqual(
    hits(properties, 'sangam', propertyFields).map((p) => p.slug),
    ['centro-plaza'],
  )
})

test('the unit holding the tenant outranks the property that holds the unit', () => {
  const unitRank = searchRows(units, 'sangam', unitFields)[0].rank
  const propertyRank = searchRows(properties, 'sangam', propertyFields)[0].rank
  assert.ok(unitRank > propertyRank, `${unitRank} should beat ${propertyRank}`)
})

test('a size is findable with or without its separator', () => {
  for (const query of ['1200', '1,200']) {
    assert.deepEqual(
      hits(units, query, unitFields).map((r) => r.unit.label),
      ['101'],
      query,
    )
  }
})

test('the word a visitor types for a status finds it', () => {
  // Nothing in the record says "vacant"; two of the five are `available`.
  assert.equal(hits(units, 'vacant', unitFields).length, 2)
  assert.deepEqual(
    hits(units, 'leased centro', unitFields).map((r) => r.unit.label),
    ['101'],
  )
})

test('an empty query keeps the list and its order intact', () => {
  assert.deepEqual(hits(units, '   ', unitFields), units)
})

/* ── filters ───────────────────────────────────────────────────────────── */

test('category filters both halves of the collection', () => {
  assert.equal(filterProperties(properties, filters({ category: 'Flex' })).length, 1)
  assert.equal(filterUnits(units, filters({ category: 'Flex' })).length, 2)
})

test('available-only is the properties view’s own axis — "has space left"', () => {
  const soldOut = { ...lewisville, available: 0 }
  assert.deepEqual(
    filterProperties([centro, soldOut], filters({ availableOnly: true })).map((p) => p.slug),
    ['centro-plaza'],
  )
})

test('a unit’s availability is its status, and only its status', () => {
  // One axis, so the switch on the units view writes `status` and cannot
  // disagree with the status select beside it.
  assert.ok(filterUnits(units, filters({ status: 'available' })).every((r) => r.unit.status === 'available'))
  // `availableOnly` is inert here rather than a second, invisible status
  // filter — a link carrying it must not quietly narrow the unit grid.
  assert.deepEqual(filterUnits(units, filters({ availableOnly: true })), units)
})

test('size and property narrow together', () => {
  const rows = filterUnits(units, filters({ size: 'md', property: 'centro-plaza' }))
  assert.deepEqual(rows.map((r) => r.unit.label), ['101'])
})

/* ── facet counts ──────────────────────────────────────────────────────── */

test('a facet count leaves its own control out, so it never reads back the current choice', () => {
  // Already narrowed to Retail. The use counts must still see Flex, or the
  // pills would say "Flex 0" on a portfolio that has two Flex units and the
  // visitor could not tell a bad combination from an empty portfolio.
  const counts = countBy(
    filterUnits(units, filters({ category: 'Retail' }), 'category'),
    (row) => row.property.category,
  )
  assert.equal(counts.get('Retail'), 3)
  assert.equal(counts.get('Flex'), 2)
})

test('a facet count does respect every other control', () => {
  const counts = countBy(
    filterUnits(units, filters({ category: 'Retail', status: 'available' }), 'category'),
    (row) => row.property.category,
  )
  // Centro has one available unit of its three; Lewisville one of its two.
  assert.equal(counts.get('Retail'), 1)
  assert.equal(counts.get('Flex'), 1)
})

test('only statuses the portfolio actually uses are offered', () => {
  assert.deepEqual(
    statusOptions(units).map((s) => s.value),
    ['available', 'leased', 'coming-soon', 'sold'],
  )
  const justOne = units.filter((r) => r.unit.status === 'available')
  assert.deepEqual(statusOptions(justOne).map((s) => s.value), ['available'])
})

/* ── sorting ───────────────────────────────────────────────────────────── */

test('sorts', () => {
  const entries = units.map((row) => ({ row, rank: 0 }))
  assert.deepEqual(
    sortUnits(entries, 'size-desc').map((e) => e.row.sf),
    [5000, 2400, 1200, 850, 600],
  )
  assert.deepEqual(
    sortUnits(entries, 'size-asc').map((e) => e.row.sf),
    [600, 850, 1200, 2400, 5000],
  )
  // `recommended` is collectUnits' own order and must not be re-sorted.
  assert.deepEqual(sortUnits(entries, 'recommended').map((e) => e.row), units)
})

test('relevance sorts by rank', () => {
  const entries = [
    { row: 'a', rank: 1 },
    { row: 'b', rank: 9 },
  ]
  assert.deepEqual(sortUnits(entries, 'relevance').map((e) => e.row), ['b', 'a'])
})

/* ── the URL ───────────────────────────────────────────────────────────── */

test('defaults are deleted rather than written, so an untouched page stays clean', () => {
  const written = writeFilters(new URLSearchParams('view=units'), EMPTY_FILTERS)
  assert.equal(written.toString(), 'view=units')
})

test('a filtered view round-trips through the URL', () => {
  const set = filters({ q: 'suite 101', category: 'Retail', size: 'md', availableOnly: true })
  const written = writeFilters(new URLSearchParams(), set)
  assert.deepEqual(readFilters(written), set)
})

test('params the bar does not own are left alone', () => {
  const written = writeFilters(new URLSearchParams('view=units&utm_source=email'), filters({ q: 'x' }))
  assert.equal(written.get('view'), 'units')
  assert.equal(written.get('utm_source'), 'email')
})

test('the clear button counts only the controls the current view shows', () => {
  const set = filters({ q: 'x', status: 'leased', size: 'md' })
  assert.equal(activeCount(set, 'units'), 3)
  // Status and size are unit-wise; on the properties view they are not on
  // screen and must not be counted as something "Clear" would undo.
  assert.equal(activeCount(set, 'properties'), 1)
})
