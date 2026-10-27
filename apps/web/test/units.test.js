import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyUnitChange,
  formatArea,
  getUnits,
  markOriginalLabels,
  reconcile,
  rekeyForSave,
  rekeySiteBindings,
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

test('a list of changes is applied in one pass, so a swap exchanges shapes', () => {
  const next = rekeySiteBindings(site(), [
    { type: 'renameUnit', building: 'Building 6', from: '605', to: '606' },
    { type: 'renameUnit', building: 'Building 6', from: '606', to: '605' },
  ])
  assert.deepEqual(
    ['a', 'b', 'c'].map((mesh) => next.unitBindings[mesh].unitLabel),
    ['606', '606', '605'],
  )
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
  assert.equal(rekeySiteBindings(model, []), model)
  assert.equal(rekeySiteBindings(null, { type: 'removeUnit', building: 'B', unit: '1' }), null)
})

/* ── typing, a keystroke at a time ─────────────────────────────────── */

// What the editors do on each keystroke: UnitFields hands the whole row back
// with the new label, BuildingBlock passes it through applyUnitChange.
const typeUnit = (detail, buildingIndex, unitIndex, labels, options) =>
  labels.reduce((current, label) => {
    const buildings = current.floorPlans.buildings.map((building, i) =>
      i === buildingIndex
        ? applyUnitChange(building, unitIndex, { ...building.unitList[unitIndex], label }, options)
        : building,
    )
    return { ...current, floorPlans: { ...current.floorPlans, buildings } }
  }, detail)

const typeBuilding = (detail, buildingIndex, names) =>
  names.reduce((current, name) => {
    const buildings = current.floorPlans.buildings.map((building, i) =>
      i === buildingIndex ? { ...building, building: name } : building,
    )
    return { ...current, floorPlans: { ...current.floorPlans, buildings } }
  }, detail)

const perBuilding = (unitLabels, bindings, meshNames) => ({
  floorPlans: {
    buildings: [
      {
        building: 'B-10',
        unitList: unitLabels.map((label) => ({ label })),
        model: { url: 'b.glb', meshNames, bindings },
      },
    ],
  },
})

const modelOf = (detail) => detail.floorPlans.buildings[0].model

test('per keystroke, a per-building model keeps main’s behaviour (1001 → 100 → 1002 → 1002A)', () => {
  const detail = perBuilding(['1001', '1002'], {}, ['unit-1001', 'unit-1002'])
  const typed = typeUnit(detail, 0, 0, ['100', '1002', '1002A'])
  assert.deepEqual(modelOf(typed).bindings, { 'unit-1001': '1002A' })
})

test('re-keyed at save, the same typing gives the same result', () => {
  const detail = markOriginalLabels(perBuilding(['1001', '1002'], {}, ['unit-1001', 'unit-1002']))
  const typed = typeUnit(detail, 0, 0, ['100', '1002', '1002A'], { rebind: false })
  // Nothing moved while typing…
  assert.deepEqual(modelOf(typed).bindings, {})
  // …and everything moves once, at save.
  const saved = rekeyForSave(typed)
  assert.deepEqual(modelOf(saved).bindings, { 'unit-1001': '1002A' })
  const report = reconcile(modelOf(saved).meshNames, getUnits(saved.floorPlans.buildings[0]), modelOf(saved).bindings)
  assert.deepEqual(
    report.matched.map(({ meshName, unit }) => [meshName, unit.label]),
    [['unit-1001', '1002A'], ['unit-1002', '1002']],
  )
})

test('a per-building swap (605 ↔ 606) exchanges the shapes at save', () => {
  const detail = markOriginalLabels(perBuilding(['605', '606'], { n1: '605', n2: '606' }, ['n1', 'n2']))
  let typed = typeUnit(detail, 0, 0, ['60', '606'], { rebind: false })
  typed = typeUnit(typed, 0, 1, ['60', '605'], { rebind: false })
  assert.deepEqual(modelOf(rekeyForSave(typed)).bindings, { n1: '606', n2: '605' })
})

const siteDetail = () => ({
  floorPlans: {
    buildings: [
      { building: 'Building 6', unitList: [{ label: '605' }, { label: '606' }] },
      { building: 'Building 1', unitList: [{ label: '101' }] },
      { building: 'Building 10', unitList: [{ label: '1001' }] },
    ],
  },
  siteModel: {
    url: 'site.glb',
    meshNames: ['a', 'b', 'c', 'd', 'e', 'f'],
    unitBindings: {
      a: { buildingLabel: 'Building 6', unitLabel: '605' },
      b: { buildingLabel: 'Building 6', unitLabel: '605' },
      c: { buildingLabel: 'Building 6', unitLabel: '606' },
      d: { buildingLabel: 'Building 1', unitLabel: '101' },
      e: { buildingLabel: 'Building 10', unitLabel: '1001' },
    },
    buildingBindings: { a: 'Building 6', b: 'Building 6', c: 'Building 6', d: 'Building 1', e: 'Building 10', f: 'Building 10' },
  },
})

const shapesOf = (detail, building) =>
  reconcileSite(detail.siteModel.meshNames, detail.floorPlans.buildings, detail.siteModel)
    .resolved.filter((e) => e.building.building === building)
    .map((e) => (e.kind === 'unit' ? `${e.meshName}:${e.unit.label}` : e.meshName))

test('a site-model swap typed through a collision (605 → 60 → 606, then 606 → 60 → 605)', () => {
  let typed = typeUnit(markOriginalLabels(siteDetail()), 0, 0, ['60', '606'], { rebind: false })
  typed = typeUnit(typed, 0, 1, ['60', '605'], { rebind: false })
  const saved = rekeyForSave(typed)
  assert.deepEqual(shapesOf(saved, 'Building 6'), ['a:606', 'b:606', 'c:605'])
})

test('a building renamed through another building’s name (Building 10 → Building 1 → Building 11)', () => {
  const typed = typeBuilding(markOriginalLabels(siteDetail()), 2, ['Building 1', 'Building 11'])
  const saved = rekeyForSave(typed)
  assert.deepEqual(shapesOf(saved, 'Building 11'), ['e:1001', 'f'])
  // Building 1 keeps exactly its own shape.
  assert.deepEqual(shapesOf(saved, 'Building 1'), ['d:101'])
})

test('a save that ends on a collision moves nothing', () => {
  // 605 renamed to 606 while 606 stays: two rows share a label.
  const typed = typeUnit(markOriginalLabels(siteDetail()), 0, 0, ['606'], { rebind: false })
  const before = siteDetail().siteModel
  assert.deepEqual(rekeyForSave(typed).siteModel, before)
  // Building 10 left named "Building 1".
  const named = typeBuilding(markOriginalLabels(siteDetail()), 2, ['Building 1'])
  assert.deepEqual(rekeyForSave(named).siteModel, before)
})

test('rekeyForSave strips its markers and leaves an unmarked record as it was', () => {
  const saved = rekeyForSave(typeUnit(markOriginalLabels(siteDetail()), 0, 0, ['605A'], { rebind: false }))
  assert.equal(JSON.stringify(saved).includes('_original'), false)
  assert.deepEqual(rekeyForSave(siteDetail()), siteDetail())
})

/* ── on Centro's live record ───────────────────────────────────────── */

const indexOf = (detail, label) => detail.floorPlans.buildings.findIndex((b) => b.building === label)
const unitIndexOf = (detail, bi, label) => detail.floorPlans.buildings[bi].unitList.findIndex((u) => u.label === label)
const resolve = (detail) => reconcileSite(detail.siteModel.meshNames, detail.floorPlans.buildings, detail.siteModel)
const unitShapes = (detail, building, unit) =>
  resolve(detail)
    .resolved.filter((e) => e.kind === 'unit' && e.building.building === building && e.unit.label === unit)
    .map((e) => e.meshName)

test('rekeyForSave carries a renamed unit’s shapes (605 → 605A, typed a key at a time)', () => {
  const detail = markOriginalLabels(centro.detail)
  const bi = indexOf(detail, 'Building 6')
  const ui = unitIndexOf(detail, bi, '605')
  const before = unitShapes(centro.detail, 'Building 6', '605')
  assert.ok(before.length > 0)

  const saved = rekeyForSave(typeUnit(detail, bi, ui, ['60', '605', '605A'], { rebind: false }))
  assert.deepEqual(unitShapes(saved, 'Building 6', '605A'), before)
  // Pure: the loaded record is untouched.
  assert.equal(centro.detail.floorPlans.buildings[bi].unitList[ui].label, '605')
})

test('a building and one of its units renamed in the same save', () => {
  const detail = markOriginalLabels(centro.detail)
  const bi = indexOf(detail, 'Building 9')
  const ui = unitIndexOf(detail, bi, '908')
  const count = resolve(centro.detail).resolved.filter((e) => e.building?.building === 'Building 9').length
  const shapes908 = unitShapes(centro.detail, 'Building 9', '908')

  let typed = typeBuilding(detail, bi, ['Building 9A'])
  typed = typeUnit(typed, bi, ui, ['908A'], { rebind: false })
  const saved = rekeyForSave(typed)
  assert.equal(resolve(saved).resolved.filter((e) => e.building?.building === 'Building 9A').length, count)
  assert.deepEqual(unitShapes(saved, 'Building 9A', '908A'), shapes908)
})
