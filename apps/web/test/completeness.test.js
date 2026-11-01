import test from 'node:test'
import assert from 'node:assert/strict'
import { buildingMissing, summarise, unitMissing } from '../src/admin/completeness.js'
import { trackerOwnedFields } from '../src/admin/unitChecks.js'

const full = { label: '101', status: 'available', size: '900', floor: 'G', rate: '$1', description: 'd', images: ['a.jpg'] }

test('a filled-in unit has nothing missing', () => {
  assert.deepEqual(unitMissing(full), [])
})

test('a leased unit also needs its tenant', () => {
  assert.deepEqual(unitMissing({ ...full, status: 'leased' }), ['Tenant'])
})

test('tracker-owned fields are not asked of the editor', () => {
  const synced = { ...full, label: '', size: '', trackerUnitIds: ['t1'] }
  assert.deepEqual(unitMissing(synced), [])
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

test('the tracker owns only what it has data for; the CMS keeps the rest', () => {
  const synced = { ...full, trackerUnitIds: ['t1'] }
  // No square footage in the tracker: the sync keeps the website's size, so the editor may fill it.
  const noSqft = { ...synced, size: '', tracker: { sqft: null, occupant: null } }
  assert.equal(trackerOwnedFields(noSqft).size, false)
  assert.deepEqual(unitMissing(noSqft), ['Size'])
  assert.equal(trackerOwnedFields({ ...synced, tracker: { sqft: 1510 } }).size, true)

  // Tenant: cleared by the sync while available, the lease's while leased with one on record,
  // and the CMS's when the tracker names nobody or the unit is sold.
  assert.equal(trackerOwnedFields({ ...synced, tracker: {} }).tenant, true)
  assert.equal(trackerOwnedFields({ ...synced, status: 'leased', tracker: { occupant: 'JB Sree' } }).tenant, true)
  assert.equal(trackerOwnedFields({ ...synced, status: 'leased', tracker: { occupant: null } }).tenant, false)
  assert.equal(trackerOwnedFields({ ...synced, status: 'sold', tracker: { occupant: null } }).tenant, false)

  // Synced before row.tracker existed: locked as before.
  assert.deepEqual(trackerOwnedFields({ ...synced, status: 'leased' }), { label: true, status: true, size: true, tenant: true })
  // Not synced at all: everything is the CMS's.
  assert.deepEqual(trackerOwnedFields(full), { label: false, status: false, size: false, tenant: false })
})
