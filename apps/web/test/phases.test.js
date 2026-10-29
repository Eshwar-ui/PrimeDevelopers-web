import test from 'node:test'
import assert from 'node:assert/strict'
import { collapsePhases, phaseSiblings } from '../src/lib/phases.js'

const record = (slug, name, extra = {}) => ({ slug, name, buildings: 1, sold: 0, available: 1, ...extra })

test('an unphased record named as a phased one’s base is its Phase I', () => {
  const list = [record('pow', 'POW Lewisville '), record('pow-ii', 'POW Lewisville Phase II'), record('other', 'POW Leander')]
  const listings = collapsePhases(list)
  assert.deepEqual(listings.map((p) => p.slug), ['pow', 'other'])
  assert.equal(listings[0].buildings, 2)
  assert.deepEqual(
    phaseSiblings(list, list[1]).map((s) => s.label),
    ['Phase I', 'Phase II'],
  )
})

test('the implicit first phase follows its siblings’ numbering', () => {
  const list = [record('a', 'Rio Ranch'), record('b', 'Rio Ranch Phase 2')]
  assert.deepEqual(phaseSiblings(list, list[0]).map((s) => s.label), ['Phase 1', 'Phase 2'])
})

test('a shared prefix alone still groups nothing', () => {
  const list = [record('a', 'Rio Ranch 1 Acre Lots'), record('b', 'Rio Ranch Phase 2')]
  assert.equal(collapsePhases(list).length, 2)
  assert.deepEqual(phaseSiblings(list, list[0]), [])
})
