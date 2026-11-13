import test from 'node:test'
import assert from 'node:assert/strict'
import { followsTracker, replaceWithTracker, turnTrackerOn, withTrackerOverrides } from '../src/admin/unitChecks.js'

const unit = (extra = {}) => ({
  label: '101',
  trackerUnitIds: ['t1'],
  tracker: { values: { status: 'leased', size: '1,296 SF', tenant: 'Spot Fusion' } },
  ...extra,
})

test('ticking the tracker back on replaces this unit’s edits with the tracker’s data', () => {
  const edited = unit({ trackerSync: false, status: 'available', size: '9,999 SF', tenant: 'My tenant' })
  const next = turnTrackerOn(edited)
  assert.equal(next.trackerSync, true)
  assert.deepEqual([next.status, next.size, next.tenant], ['leased', '1,296 SF', 'Spot Fusion'])
  assert.equal(next.trackerOverrides, undefined)
  assert.equal(followsTracker(next), true)
  // And the form's own recomputation sees nothing left to override.
  assert.equal(withTrackerOverrides(next, edited).trackerOverrides, undefined)
})

test('an edit made while following the tracker is also dropped', () => {
  const edited = unit({ status: 'sold', trackerOverrides: ['status'] })
  assert.equal(turnTrackerOn(edited).status, 'leased')
})

test('fields the tracker has no value for keep the website’s value', () => {
  const next = turnTrackerOn(unit({ trackerSync: false, leasePrice: '$42' }))
  assert.equal(next.leasePrice, '$42')
})

test('with no recorded tracker values, overrides are cleared and the next sync decides', () => {
  const noValues = { label: '101', trackerUnitIds: ['t1'], trackerSync: false, size: '1 SF', trackerOverrides: ['size'] }
  const next = turnTrackerOn(noValues)
  assert.equal(next.trackerSync, true)
  assert.equal(next.size, '1 SF')
  assert.equal(next.trackerOverrides, undefined)
  assert.equal(replaceWithTracker(noValues), noValues)
})
