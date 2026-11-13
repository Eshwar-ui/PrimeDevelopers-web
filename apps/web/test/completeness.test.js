import test from 'node:test'
import assert from 'node:assert/strict'
import { buildingMissing, summarise, unitMissing } from '../src/admin/completeness.js'

const full = { label: '101', status: 'available', size: '900', clearHeight: '24 ft', leasePrice: '28', description: 'd', images: ['a.jpg'] }

test('a filled-in unit has nothing missing', () => {
  assert.deepEqual(unitMissing(full), [])
})

test('a leased unit also needs its tenant', () => {
  assert.deepEqual(unitMissing({ ...full, status: 'leased' }), ['Tenant'])
})

test('what the tracker will fill in is not asked of the editor', () => {
  // The label is the tracker's alone; the size and prices arrive with the sync.
  const synced = {
    ...full,
    label: '',
    size: '',
    leasePrice: '',
    trackerUnitIds: ['t1'],
    tracker: { values: { size: '900', leasePrice: '28' } },
  }
  assert.deepEqual(unitMissing(synced), [])
})

test('any one price will do, and the older free-text rate counts', () => {
  const unpriced = { ...full, leasePrice: '' }
  assert.deepEqual(unitMissing(unpriced), ['Price'])
  assert.deepEqual(unitMissing({ ...unpriced, salePrice: '650000' }), [])
  assert.deepEqual(unitMissing({ ...unpriced, status: 'sold', soldPrice: '610000', tenant: 'Owner' }), [])
  assert.deepEqual(unitMissing({ ...unpriced, rate: '$28 / SF / yr' }), [])
})

test('clear height is asked for instead of floor', () => {
  assert.deepEqual(unitMissing({ ...full, clearHeight: '' }), ['Clear height'])
  assert.deepEqual(unitMissing({ ...full, clearHeight: '', floor: 'Ground' }), ['Clear height'])
})

test('a building needs a name, area, number and at least one unit', () => {
  assert.deepEqual(buildingMissing({ building: 'B1', area: '1', number: '1', unitList: [full] }), [])
  assert.deepEqual(buildingMissing({}), ['Building name', 'Area', 'Number', 'Units'])
})

test('summarise counts status, completeness and pending', () => {
  const b = { building: 'B1', area: '1', number: '1', unitList: [full, { ...full, status: 'sold', description: '' }] }
  const s = summarise([b], null)
  assert.equal(s.units, 2)
  assert.equal(s.complete, 1)
  assert.equal(s.pending, 1)
  assert.equal(s.counts.sold, 1)
})

test('a field the tracker has no data for is the editor to fill, even on a synced unit', () => {
  const synced = { ...full, trackerUnitIds: ['t1'] }
  // No square footage in the tracker: the sync keeps the website's size, so the editor may fill it.
  const noSqft = { ...synced, size: '', tracker: { values: { status: 'available' } } }
  assert.deepEqual(unitMissing(noSqft), ['Size'])
  assert.deepEqual(unitMissing({ ...synced, size: '', tracker: { values: { size: '1,510' } } }), [])
  // Switched off for this unit: the tracker feeds nothing, so everything is asked.
  assert.deepEqual(unitMissing({ ...synced, size: '', trackerSync: false, tracker: { values: { size: '1,510' } } }), ['Size'])
  // Overridden: the editor's value stands, so a blank one is the editor's to fill.
  assert.deepEqual(
    unitMissing({ ...synced, size: '', trackerOverrides: ['size'], tracker: { values: { size: '1,510' } } }),
    ['Size'],
  )
  // Synced before the tracker's values were recorded: it fed the size as it always did.
  assert.deepEqual(unitMissing({ ...synced, size: '', tracker: { sqft: 1510 } }), [])
})
