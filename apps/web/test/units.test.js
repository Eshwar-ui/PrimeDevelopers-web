import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyUnitChange,
  applyUnitChangeToDetail,
  formatArea,
  rekeySiteBindings,
  renameBuildingInDetail,
} from '../src/lib/units.js'
import { reconcileSite } from '../src/lib/siteModel.js'

const fixture = process.env.CENTRO_JSON ?? new URL('./fixtures/centro-plaza-site.json', import.meta.url)
const centro = JSON.parse(readFileSync(fixture, 'utf8'))

const sqft = (n) => `${n.toLocaleString()} sq ft`
const range = (a, b) => `${a.toLocaleString()}–${b.toLocaleString()} sq ft`

/* ── formatArea ─────────────────────────────────────────────────────── */

test('formatArea keeps ranges as ranges', () => {
  assert.equal(formatArea('1,500-2,000'), range(1500, 2000))
  assert.equal(formatArea('1500 – 2000 sq ft'), range(1500, 2000))
  assert.equal(formatArea('1,500 to 2,000'), range(1500, 2000))
  // Reversed ends are put in order; equal ends are one number.
  assert.equal(formatArea('2000-1500'), range(1500, 2000))
  assert.equal(formatArea('1500-1500'), sqft(1500))
})

test('formatArea reads single sizes as it always did', () => {
  assert.equal(formatArea('2,044'), sqft(2044))
  assert.equal(formatArea('3286 sq ft'), sqft(3286))
  assert.equal(formatArea(1250), sqft(1250))
  assert.equal(formatArea('1,234.5'), sqft(1234.5))
  for (const empty of ['', null, undefined, 'TBD', '0']) assert.equal(formatArea(empty), null)
})

/* ── rekeySiteBindings ──────────────────────────────────────────────── */

const site = () => ({
  url: 'x.glb',
  unitBindings: {
    a: { buildingLabel: 'Building 6', unitLabel: '605' },
    b: { buildingLabel: 'Building 6', unitLabel: '605' },
    c: { buildingLabel: 'Building 6', unitLabel: '606' },
    d: { buildingLabel: 'Building 8', unitLabel: '605' },
  },
  buildingBindings: { a: 'Building 6', c: 'Building 6', d: 'Building 8', e: 'Building 6' },
})

test('renameUnit re-points every shape of that unit, and only that unit', () => {
  const next = rekeySiteBindings(site(), { type: 'renameUnit', building: ' building 6 ', from: '605', to: '605A' })
  assert.deepEqual(next.unitBindings.a, { buildingLabel: 'Building 6', unitLabel: '605A' })
  assert.deepEqual(next.unitBindings.b, { buildingLabel: 'Building 6', unitLabel: '605A' })
  assert.equal(next.unitBindings.c.unitLabel, '606')
  // Same label in another building is a different unit.
  assert.equal(next.unitBindings.d.unitLabel, '605')
})

test('removeUnit drops the unit binding and keeps the shape in its building', () => {
  const next = rekeySiteBindings(site(), { type: 'removeUnit', building: 'Building 6', unit: '605' })
  assert.equal(next.unitBindings.a, undefined)
  assert.equal(next.unitBindings.b, undefined)
  assert.equal(next.buildingBindings.a, 'Building 6')
  // `b` had no building binding of its own; it gets one.
  assert.equal(next.buildingBindings.b, 'Building 6')
  assert.ok(next.unitBindings.c && next.unitBindings.d)
})

test('renameBuilding moves unit and building bindings together', () => {
  const next = rekeySiteBindings(site(), { type: 'renameBuilding', from: 'Building 6', to: 'Building 6A' })
  assert.deepEqual(
    Object.values(next.unitBindings).map((b) => b.buildingLabel),
    ['Building 6A', 'Building 6A', 'Building 6A', 'Building 8'],
  )
  assert.deepEqual(next.buildingBindings, { a: 'Building 6A', c: 'Building 6A', d: 'Building 8', e: 'Building 6A' })
})

test('a change that touches nothing returns the same object', () => {
  const model = site()
  assert.equal(rekeySiteBindings(model, { type: 'renameUnit', building: 'Building 9', from: '901', to: '901A' }), model)
  assert.equal(rekeySiteBindings(model, { type: 'renameUnit', building: 'Building 6', from: '605', to: '605' }), model)
  assert.equal(rekeySiteBindings(model, { type: 'renameBuilding', from: 'Building 6', to: '' }), model)
  assert.equal(rekeySiteBindings(null, { type: 'removeUnit', building: 'B', unit: '1' }), null)
})

/* ── applyUnitChangeToDetail / renameBuildingInDetail, on Centro ───── */

const indexOf = (detail, label) => detail.floorPlans.buildings.findIndex((b) => b.building === label)
const unitIndexOf = (detail, bi, label) => detail.floorPlans.buildings[bi].unitList.findIndex((u) => u.label === label)
const resolve = (detail) => reconcileSite(detail.siteModel.meshNames, detail.floorPlans.buildings, detail.siteModel)
const unitShapes = (detail, building, unit) =>
  resolve(detail).resolved.filter((e) => e.kind === 'unit' && e.building.building === building && e.unit.label === unit)

test('renaming 605 to 605A in the CMS keeps its shape (audit: “605 → 605A kills the shape”)', () => {
  const detail = centro.detail
  const bi = indexOf(detail, 'Building 6')
  const ui = unitIndexOf(detail, bi, '605')
  const before = unitShapes(detail, 'Building 6', '605').map((e) => e.meshName)
  assert.ok(before.length > 0)

  const unit = detail.floorPlans.buildings[bi].unitList[ui]
  const next = applyUnitChangeToDetail(detail, bi, ui, { ...unit, label: '605A' })
  assert.deepEqual(unitShapes(next, 'Building 6', '605A').map((e) => e.meshName), before)
  // Pure: the input record is untouched.
  assert.equal(detail.floorPlans.buildings[bi].unitList[ui].label, '605')
})

test('removing a unit leaves its shape in the building', () => {
  const detail = centro.detail
  const bi = indexOf(detail, 'Building 9')
  const ui = unitIndexOf(detail, bi, '908')
  const shapes = unitShapes(detail, 'Building 9', '908').map((e) => e.meshName)
  assert.ok(shapes.length > 0)

  const next = applyUnitChangeToDetail(detail, bi, ui, null)
  assert.equal(next.floorPlans.buildings[bi].unitList.some((u) => u.label === '908'), false)
  const report = resolve(next)
  for (const mesh of shapes) {
    const entry = report.resolved.find((e) => e.meshName === mesh)
    assert.equal(entry?.kind, 'building')
    assert.equal(entry.building.building, 'Building 9')
    assert.equal(next.siteModel.unitBindings[mesh], undefined)
  }
})

test('a rename onto a label another unit holds moves nothing', () => {
  const detail = centro.detail
  const bi = indexOf(detail, 'Building 8')
  const ui = unitIndexOf(detail, bi, '801')
  const unit = detail.floorPlans.buildings[bi].unitList[ui]
  const next = applyUnitChangeToDetail(detail, bi, ui, { ...unit, label: '802' })
  assert.equal(next.siteModel ?? null, detail.siteModel ?? null)
  assert.equal(next.floorPlans.buildings[bi].unitList[ui].label, '802')
})

test('renaming a building carries every shape with it', () => {
  const detail = centro.detail
  const bi = indexOf(detail, 'Building 6')
  const count = resolve(detail).resolved.filter((e) => e.building?.building === 'Building 6').length
  const next = renameBuildingInDetail(detail, bi, 'Building 6A')
  assert.equal(resolve(next).resolved.filter((e) => e.building?.building === 'Building 6A').length, count)
})

test('a building rename onto another building’s label moves nothing', () => {
  const detail = centro.detail
  // Backspacing "Building 10" passes through "Building 1".
  const next = renameBuildingInDetail(detail, indexOf(detail, 'Building 10'), 'Building 1')
  assert.equal(next.siteModel ?? null, detail.siteModel ?? null)
})

/* ── applyUnitChange, per-building model ───────────────────────────── */

const building = () => ({
  building: 'B-01',
  unitList: [{ label: '101' }, { label: '102' }],
  model: { url: 'b.glb', meshNames: ['Node1', 'Node2', 'unit-102'], bindings: { Node1: '101', Node2: '101' } },
})

test('a rename re-points every panel bound to the unit', () => {
  const next = applyUnitChange(building(), 0, { label: '101A' })
  assert.deepEqual(next.model.bindings, { Node1: '101A', Node2: '101A' })
  // A name-matched shape gets an explicit binding to the new label.
  assert.deepEqual(applyUnitChange(building(), 1, { label: '102A' }).model.bindings, {
    Node1: '101',
    Node2: '101',
    'unit-102': '102A',
  })
})

test('a rename onto a taken label, or a removal, is handled without merging units', () => {
  assert.deepEqual(applyUnitChange(building(), 0, { label: '102' }).model.bindings, { Node1: '101', Node2: '101' })
  const removed = applyUnitChange(building(), 0, null)
  assert.deepEqual(removed.unitList, [{ label: '102' }])
  assert.deepEqual(removed.model.bindings, {})
})
