// The unit list's search and its availability / size / pricing filters.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_FILTERS,
  UNIT_FACETS,
  activeFilterCount,
  facetCounts,
  filterUnits,
  matchesQuery,
  readFilters,
  writeFilters,
} from '../src/lib/unitFilters.js'
import { unitSF } from '../src/lib/units.js'

const centro = { name: 'Centro Plaza', address: '15101 Ronald Reagan Blvd, Leander, TX', category: 'Retail' }
const lakeline = { name: 'Lakeline Square', address: '1 Lakeline Blvd, Cedar Park, TX', category: 'Office' }
const b7 = { building: 'Building 7' }
const b8 = { building: 'Building 8' }

const row = (property, building, unit) => ({ property, building, unit, sf: unitSF(unit.size) })

const rows = [
  row(centro, b7, { label: '701', status: 'available', size: '900', leasePrice: '24', clearHeight: '24 ft' }),
  row(centro, b7, { label: '702', status: 'available', size: '1,500', leasePrice: '30' }),
  row(centro, b7, { label: '703+704', status: 'available', size: '3,200', salePrice: '1250000' }),
  row(centro, b8, { label: '801', status: 'leased', size: '1,100', tenant: 'Lava Coffee', tenantCategory: 'Coffee' }),
  row(lakeline, b8, { label: '801', status: 'sold', size: '5,000' }),
  row(lakeline, b8, { label: '802', size: '', leasePrice: '40' }),
]

const labels = (list) => list.map(({ property, unit }) => `${property.name.split(' ')[0]}:${unit.label}`)

test('every word typed must be found, in any order, whatever the case', () => {
  assert.equal(matchesQuery(rows[0], ''), true)
  assert.equal(matchesQuery(rows[0], '  '), true)
  assert.equal(matchesQuery(rows[0], 'building 7 centro'), true)
  assert.equal(matchesQuery(rows[0], 'CENTRO building7'), false)
  assert.equal(matchesQuery(rows[0], 'centro lakeline'), false)
})

test('a typed number names a unit or a building, never a street number or a ZIP code', () => {
  const zip = { name: 'Centro Plaza', address: '14300 Ronald Reagan Blvd, Leander, TX 78641', category: 'Retail' }
  const b6 = row(zip, { building: 'Building 6' }, { label: '603', status: 'available', size: '1,061' })
  const b7unit = row(zip, b7, { label: '701', status: 'available', size: '900' })
  const all = [b6, b7unit]
  assert.deepEqual(labels(filterUnits(all, { ...EMPTY_FILTERS, q: 'building 7' })), ['Centro:701'])
  assert.deepEqual(labels(filterUnits(all, { ...EMPTY_FILTERS, q: '7' })), ['Centro:701'])
  assert.deepEqual(labels(filterUnits(all, { ...EMPTY_FILTERS, q: '603' })), ['Centro:603'])
  // The number has to begin one of the unit's own: "03" is inside 603, not a start of it.
  assert.deepEqual(filterUnits(all, { ...EMPTY_FILTERS, q: '03' }), [])
  // Words are still found anywhere, address included.
  assert.equal(filterUnits(all, { ...EMPTY_FILTERS, q: 'leander' }).length, 2)
  assert.equal(filterUnits(all, { ...EMPTY_FILTERS, q: '78641' }).length, 0)
})

test('a unit is found by its number, its building, its property, its address and its tenant', () => {
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, q: '704' })), ['Centro:703+704'])
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, q: 'unit 701' })), ['Centro:701'])
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, q: 'cedar park' })), ['Lakeline:801', 'Lakeline:802'])
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, q: 'coffee' })), ['Centro:801'])
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, q: '24 ft' })), ['Centro:701'])
  assert.deepEqual(filterUnits(rows, { ...EMPTY_FILTERS, q: 'nothing like this' }), [])
})

test('availability filters by status, and a unit with none reads as available', () => {
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, status: 'available' })), [
    'Centro:701',
    'Centro:702',
    'Centro:703+704',
    'Lakeline:802',
  ])
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, status: 'sold' })), ['Lakeline:801'])
})

test('size uses the homepage’s bands, so a link from there lands filtered the same way', () => {
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, size: 'sm' })), ['Centro:701'])
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, size: 'md' })), ['Centro:702', 'Centro:801'])
  assert.deepEqual(labels(filterUnits(rows, { ...EMPTY_FILTERS, size: 'xl' })), ['Lakeline:801'])
  // A unit with no size is in no band rather than in the smallest.
  assert.equal(filterUnits(rows, { ...EMPTY_FILTERS, size: 'sm' }).some(({ unit }) => unit.label === '802'), false)
})

test('pricing bands split lease (per sq ft per year) from sale (total), and “on request” finds the rest', () => {
  const by = (price) => labels(filterUnits(rows, { ...EMPTY_FILTERS, price }))
  assert.deepEqual(by('lease-lt-25'), ['Centro:701'])
  assert.deepEqual(by('lease-25-35'), ['Centro:702'])
  assert.deepEqual(by('lease-35'), ['Lakeline:802'])
  assert.deepEqual(by('sale-1m'), ['Centro:703+704'])
  assert.deepEqual(by('sale-lt-500k'), [])
  assert.deepEqual(by('on-request'), ['Centro:801', 'Lakeline:801'])
})

test('search and every filter narrow together', () => {
  const filters = { q: 'centro', status: 'available', size: 'md', price: '' }
  assert.deepEqual(labels(filterUnits(rows, filters)), ['Centro:702'])
  assert.equal(activeFilterCount(filters), 3)
  assert.equal(activeFilterCount(EMPTY_FILTERS), 0)
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, q: '   ' }), 0)
})

test('an option’s count is what choosing it would show with the other filters applied', () => {
  const counts = facetCounts(rows, { ...EMPTY_FILTERS, status: 'available' })
  // Its own facet is not applied to itself: picking "Sold" is still one unit, not zero.
  assert.equal(counts.status.sold, 1)
  assert.equal(counts.status.available, 4)
  // The others are narrowed to the available units.
  assert.equal(counts.size.sm, 1)
  assert.equal(counts.size.xl, 0)
  assert.equal(counts.price['on-request'], 0)
  assert.deepEqual(Object.keys(counts), UNIT_FACETS.map((f) => f.id))
})

test('filters round-trip through the URL, and an id nothing has reads as "any"', () => {
  const filters = { q: 'coffee', status: 'leased', size: 'md', price: 'on-request' }
  const params = writeFilters(new URLSearchParams('view=units&property=x'), filters)
  assert.equal(params.get('view'), 'units')
  assert.equal(params.get('property'), 'x')
  assert.deepEqual(readFilters(params), filters)

  assert.deepEqual(readFilters(new URLSearchParams('status=reserved&size=huge&price=free&q=')), EMPTY_FILTERS)
  assert.deepEqual(readFilters(new URLSearchParams('')), EMPTY_FILTERS)
  // Clearing removes the keys rather than leaving empty ones in the address.
  assert.equal(writeFilters(params, EMPTY_FILTERS).toString(), 'view=units&property=x')
})
