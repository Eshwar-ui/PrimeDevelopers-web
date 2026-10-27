import test from 'node:test'
import assert from 'node:assert/strict'
import { buildingMissing, summarise, unitMissing } from '../src/admin/completeness.js'

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
