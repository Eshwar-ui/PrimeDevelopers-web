// node --test, no runner needed: the lib modules are plain ESM.
//
// Runs against a trimmed copy of the live Centro Plaza record by default.
// Point CENTRO_JSON at a fresh `GET /api/properties/centro-plaza` to run the
// same checks against today's data instead.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bindSiteMeshes, reconcileSite, toViewerEntries } from '../src/lib/siteModel.js'

const fixture = process.env.CENTRO_JSON ?? new URL('./fixtures/centro-plaza-site.json', import.meta.url)
const centro = JSON.parse(readFileSync(fixture, 'utf8'))
const siteModel = centro.detail.siteModel
const buildings = centro.detail.floorPlans.buildings

const meshesOf = (report, label) => report.resolved.filter((e) => e.building?.building === label)

test('a stale unit binding falls back to its building instead of going dead', () => {
  const report = reconcileSite(siteModel.meshNames, buildings, siteModel)

  // Every unit-tagged shape whose building still exists resolves to something.
  const resolvedNames = new Set(report.resolved.map((e) => e.meshName))
  for (const [mesh, bind] of Object.entries(siteModel.unitBindings)) {
    if (!buildings.some((b) => b.building === bind.buildingLabel)) continue
    assert.ok(resolvedNames.has(mesh), `${mesh} (${bind.buildingLabel} / ${bind.unitLabel}) did not resolve`)
  }

  // Building 10 has no units since the 16 Sep tracker mirror; all nine of
  // its shapes come back as the building.
  const b10 = meshesOf(report, 'Building 10')
  assert.equal(b10.length, 9)
  assert.ok(b10.every((e) => e.kind === 'building'))

  // Building 6 is down to 605 and 606+608. All twenty shapes resolve: 605 as
  // its unit, the rest as the building.
  const b6 = meshesOf(report, 'Building 6')
  assert.equal(b6.length, 20)
  assert.deepEqual(
    b6.filter((e) => e.kind === 'unit').map((e) => e.unit.label),
    ['605'],
  )

  // The stale ones are still reported, so the admin can see what lost its
  // unit — they are just no longer dead.
  for (const e of [...b10, ...b6.filter((x) => x.kind === 'building')]) {
    assert.ok(report.staleBindings.includes(e.meshName))
  }
})

test('every building with shapes gets a chip, Building 10 included', () => {
  const entries = toViewerEntries(reconcileSite(siteModel.meshNames, buildings, siteModel))
  const tagged = new Set(entries.filter((e) => e.building).map((e) => e.building.building))
  for (const label of ['Building 1', 'Building 2', 'Building 4', 'Building 6', 'Building 8', 'Building 9', 'Building 10']) {
    assert.ok(tagged.has(label), `${label} has no chip`)
  }
})

test('every entry carrying a building has that building’s index', () => {
  const entries = toViewerEntries(reconcileSite(siteModel.meshNames, buildings, siteModel))
  const byBuilding = new Map()
  for (const e of entries) {
    if (!e.building) continue
    assert.equal(typeof e.buildingIndex, 'number', `${e.meshName} has no buildingIndex`)
    if (e.kind === 'building') assert.equal(e.buildingIndex, e.index)
    const seen = byBuilding.get(e.building.building)
    if (seen === undefined) byBuilding.set(e.building.building, e.buildingIndex)
    else assert.equal(e.buildingIndex, seen, `${e.building.building} has two building indexes`)
  }
  // An all-unit building (Building 9) still has one, distinct from its units'.
  const b9 = entries.filter((e) => e.building?.building === 'Building 9')
  assert.ok(b9.length > 0)
  assert.ok(b9.every((e) => e.kind === 'unit' && e.index !== e.buildingIndex))
})

test('the unit binding’s own building is the fallback when the mesh has no building binding', () => {
  const model = {
    meshNames: ['a', 'b'],
    unitBindings: {
      a: { buildingLabel: 'B1', unitLabel: 'gone' },
      b: { buildingLabel: 'Nowhere', unitLabel: 'gone' },
    },
    buildingBindings: {},
  }
  const report = reconcileSite(model.meshNames, [{ building: 'B1', unitList: [] }], model)
  assert.deepEqual(
    report.resolved.map((e) => [e.meshName, e.kind, e.building.building]),
    [['a', 'building', 'B1']],
  )
  assert.deepEqual(report.staleBindings, ['a', 'b'])
})

test('tagging a shape as a unit keeps it bound to the unit’s building', () => {
  const start = { meshNames: ['m'], buildingBindings: { m: 'Building 6' }, unitBindings: {}, roadBindings: {} }
  const asUnit = bindSiteMeshes(start, ['m'], { kind: 'unit', buildingLabel: 'Building 6', unitLabel: '605' })
  assert.deepEqual(asUnit.unitBindings.m, { buildingLabel: 'Building 6', unitLabel: '605' })
  assert.equal(asUnit.buildingBindings.m, 'Building 6')

  // Relabelled away, it is still Building 6 rather than scenery.
  const report = reconcileSite(['m'], [{ building: 'Building 6', unitList: [{ label: '605A' }] }], asUnit)
  assert.equal(report.resolved[0].kind, 'building')

  // Any other role still replaces both.
  const asRoad = bindSiteMeshes(asUnit, ['m'], { kind: 'road', roadName: 'FM 1431' })
  assert.deepEqual([asRoad.unitBindings, asRoad.buildingBindings, asRoad.roadBindings], [{}, {}, { m: 'FM 1431' }])
  const cleared = bindSiteMeshes(asUnit, ['m'], null)
  assert.deepEqual([cleared.unitBindings, cleared.buildingBindings, cleared.roadBindings], [{}, {}, {}])
})
