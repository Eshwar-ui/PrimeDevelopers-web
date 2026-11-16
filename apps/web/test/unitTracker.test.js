// A unit linked to Prime Tracker: which of its fields the sync feeds, which the
// editor has taken over, and how "replace my edits" puts the tracker's back.
// The API's half of the contract is in apps/api/test/tracker-sync.test.ts.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TRACKED_FIELDS,
  followsTracker,
  replaceWithTracker,
  sameTrackedValue,
  trackerValues,
  unitFed,
  withTrackerOverrides,
} from '../src/admin/unitChecks.js'

const synced = (extra = {}) => ({
  label: '101',
  status: 'available',
  size: '1,510',
  tenant: '',
  leasePrice: '30',
  salePrice: '',
  soldPrice: '',
  trackerUnitIds: ['t1'],
  tracker: { values: { status: 'available', size: '1,510', tenant: '', leasePrice: '30' } },
  ...extra,
})

test('the fed fields are the ones the API merges', () => {
  assert.deepEqual(TRACKED_FIELDS, ['status', 'size', 'tenant', 'leasePrice', 'salePrice', 'soldPrice'])
})

test('a unit follows the tracker when it is linked and has not been switched off', () => {
  assert.equal(followsTracker(synced()), true)
  assert.equal(followsTracker(synced({ trackerSync: true })), true)
  assert.equal(followsTracker(synced({ trackerSync: false })), false)
  assert.equal(followsTracker({ label: '9' }), false)
})

test('numbers compare as numbers, text as trimmed text', () => {
  assert.equal(sameTrackedValue('size', '1,510', '1510'), true)
  assert.equal(sameTrackedValue('leasePrice', '$30.00', '30'), true)
  assert.equal(sameTrackedValue('leasePrice', '30', '31'), false)
  assert.equal(sameTrackedValue('salePrice', '', ''), true)
  assert.equal(sameTrackedValue('salePrice', '', '650000'), false)
  assert.equal(sameTrackedValue('tenant', ' Lava Coffee ', 'Lava Coffee'), true)
  assert.equal(sameTrackedValue('status', 'sold', 'available'), false)
})

test('changing a fed field makes it an override; changing it back follows the tracker again', () => {
  const unit = synced()
  const edited = withTrackerOverrides({ ...unit, size: '1,800' }, unit)
  assert.deepEqual(edited.trackerOverrides, ['size'])

  const twice = withTrackerOverrides({ ...edited, status: 'leased' }, edited)
  // Always in the order of TRACKED_FIELDS, whichever was touched first.
  assert.deepEqual(twice.trackerOverrides, ['status', 'size'])

  const back = withTrackerOverrides({ ...twice, size: '1510' }, twice)
  assert.deepEqual(back.trackerOverrides, ['status'])
  assert.deepEqual(withTrackerOverrides({ ...back, status: 'available' }, back).trackerOverrides, [])
})

test('an edit to a field the website owns, or that the tracker has no value for, is no override', () => {
  const unit = synced()
  const copy = { ...unit, description: 'New copy', clearHeight: '24 ft' }
  assert.equal(withTrackerOverrides(copy, unit), copy)
  assert.equal('trackerOverrides' in copy, false)
  // The tracker sent no sale price, so typing one is just filling a field in.
  const priced = { ...unit, salePrice: '650000' }
  assert.equal(withTrackerOverrides(priced, unit), priced)
})

test('nothing changes — the very same object comes back — when no override does', () => {
  const unit = synced()
  assert.equal(withTrackerOverrides(unit, unit), unit)
  assert.equal('trackerOverrides' in withTrackerOverrides({ ...unit, label: '101A' }, unit), false)
})

test('a unit the tracker is switched off for, or one that is not synced, is left alone', () => {
  const off = synced({ trackerSync: false, size: '2,000' })
  assert.equal(withTrackerOverrides(off, synced()), off)
  const manual = { label: '9', size: '500' }
  assert.equal(withTrackerOverrides({ ...manual, size: '600' }, manual).trackerOverrides, undefined)
})

test('switching the tracker back on works out the edits made while it was off', () => {
  const off = synced({ trackerSync: false, size: '2,000', status: 'leased' })
  const on = withTrackerOverrides({ ...off, trackerSync: true }, off)
  assert.deepEqual(on.trackerOverrides, ['status', 'size'])
})

test('a unit synced before the tracker’s values were recorded keeps what the editor touches', () => {
  const old = { label: '101', size: '900', status: 'available', trackerUnitIds: ['t1'], tracker: { sqft: 900 } }
  assert.equal(trackerValues(old), null)
  const edited = withTrackerOverrides({ ...old, size: '1,000' }, old)
  assert.deepEqual(edited.trackerOverrides, ['size'])
  // A later edit adds to the list rather than replacing it.
  assert.deepEqual(withTrackerOverrides({ ...edited, status: 'sold' }, edited).trackerOverrides, ['size', 'status'])
})

test('replacing my edits puts every fed field back and clears the list', () => {
  const edited = synced({ size: '1,800', status: 'leased', description: 'Corner suite', trackerOverrides: ['size', 'status'] })
  const replaced = replaceWithTracker(edited)
  assert.equal(replaced.size, '1,510')
  assert.equal(replaced.status, 'available')
  assert.equal('trackerOverrides' in replaced, false)
  // Everything the tracker does not feed is the editor's, untouched.
  assert.equal(replaced.description, 'Corner suite')
  assert.deepEqual(replaced.trackerUnitIds, ['t1'])
  // And it is now exactly what the next sync would write: no override to find.
  assert.equal(withTrackerOverrides(replaced, replaced), replaced)
})

test('replacing leaves a field the tracker has no value for as it is', () => {
  const edited = synced({ salePrice: '650000', tenant: 'Pop-up', trackerOverrides: ['tenant'] })
  const replaced = replaceWithTracker(edited)
  assert.equal(replaced.salePrice, '650000')
  assert.equal(replaced.tenant, '')
  const noValues = { label: '1', size: '5', trackerUnitIds: ['t'] }
  assert.equal(replaceWithTracker(noValues), noValues)
})

test('the sync will write a field only when the tracker feeds the unit, has a value, and the editor has not taken it', () => {
  const unit = synced()
  assert.equal(unitFed(unit, 'size'), true)
  assert.equal(unitFed(unit, 'salePrice'), false, 'the tracker has no sale price for it')
  assert.equal(unitFed({ ...unit, trackerOverrides: ['size'] }, 'size'), false)
  assert.equal(unitFed({ ...unit, trackerSync: false }, 'size'), false)
  assert.equal(unitFed({ label: '9', size: '5' }, 'size'), false)
})
