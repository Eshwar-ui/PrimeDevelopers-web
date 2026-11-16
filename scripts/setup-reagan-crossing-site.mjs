// Gives both Reagan Crossing pages their unit inventory from Prime Tracker and
// the whole-site 3D model Centro Plaza has, with every shape tagged to its unit.
//
// Before this (checked 11 Nov 2026): both records had `floorPlans.buildings: []`
// and no site model, so the pages showed 0 units and no plan.
//
// Prime Tracker calls the development "RRC" (Reagan Ranch Commercial):
//   RRC Phase 1  → reagan-crossing-phase-1   Buildings 1–5, 7, 8
//   RRC Phase 2  → reagan-crossing-phase-2   Buildings 9–12
//
// The model is the client's `01.glb` (9 Nov 2026), prepared with
//   node scripts/prepare-site-model.mjs 01.glb raw.glb && node scripts/compress-site-model.mjs raw.glb rrc-site-model.glb
// which names each unit box after its node in the client's file (`blk-8801`).
// Both pages show the whole site; each tags only its own phase's buildings,
// so the other phase reads as grey context.
//
// What this writes, per property:
//   • floorPlans.buildings — the tracker's buildings and unit rows (label,
//     status, size; nothing else). Rows the tracker sells or lets together are
//     one row labelled "104+106", as the tracker sync does.
//   • siteModel — the uploaded model plus buildingBindings/unitBindings.
//   • the headline totals (units / taken / available).
// It merges: a building or unit row already on the record keeps its photos,
// descriptions and other website-owned fields, and is never deleted.
//
// Dry run by default, and the dry run needs no login — it reads the public
// record and writes the result it would save to .aws-stage/rrc/<slug>.preview.json.
//
//   node scripts/setup-reagan-crossing-site.mjs --model .aws-stage/rrc/rrc-site-model.glb
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/setup-reagan-crossing-site.mjs --model .aws-stage/rrc/rrc-site-model.glb --commit
//
// Add `--only reagan-crossing-phase-1` to do one property.
//
// Run with --commit on 11 Nov 2026 (06:47 UTC) for both properties: 53 units
// and 61 tagged shapes on Phase I, 38 units and 4 tagged shapes on Phase II.
// A second run skips any record that already has a model unless you pass
// --replace-model, which is what to use when the client re-exports with
// Buildings 11/12 (the shape names `blk-<node>` shift in a re-export, so carry
// the existing tags over by centroid, using .aws-stage/rrc/shapes.json).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null)
const COMMIT = argv.includes('--commit')
const MODEL = flag('--model')
const ONLY = flag('--only')
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`
const OUT_DIR = '.aws-stage/rrc'

if (!MODEL) throw new Error('Pass --model <prepared .glb> (see the header comment)')

// ── Tracker inventory ────────────────────────────────────────────────────
// Read from each project's Units tab on 11 Nov 2026. `[label, status, sqft]`;
// a "+" label is one tracker deal ("2 units sold together") and the tracker
// shows no size for those. Headers then: Phase 1 "53/53, 0 available"
// (50 sold, 3 leased); Phase 2 "55 total, 8 available".
//
// Phase 2's tracker also lists, and this leaves out:
//   • a building named just "Building" with one unit named "Unit Number" — a
//     spreadsheet header row imported as data;
//   • "Reagan Ranch Commercial (RRC) - Building 5" with 16 units 502–517 —
//     Building 5 is a Phase 1 building, already listed there as 500–517.
// Both need removing in the tracker before Phase 2 can be linked to the sync.
// Also mirrored verbatim but double-counted there: 902 (2,495 sf, sold) and
// 902A + 902B (1,276 + 1,219 = 2,495 sf) — the split units are listed
// alongside the unit they were split from.
const TRACKER = {
  'reagan-crossing-phase-1': {
    'Building 1': [['100', 'sold', 1403], ['102', 'sold', 1430], ['104+106', 'sold'], ['108+110+112+114', 'sold']],
    'Building 2': [['200+202', 'sold'], ['204+214', 'sold'], ['206', 'sold', 1672], ['208', 'sold', 1465], ['210', 'sold', 1465], ['212', 'sold', 1430]],
    'Building 3': [
      ['300', 'leased', 3212], ['302', 'leased', 1514], ['303', 'sold', 2126], ['305', 'leased', 2860], ['306', 'sold', 1430],
      ['307', 'sold', 1560], ['308', 'sold', 1430], ['309', 'sold', 1657], ['310', 'sold', 1567],
    ],
    'Building 4': [
      ['401', 'sold', 1276], ['402', 'sold', 1348], ['403', 'sold', 1422], ['404', 'sold', 1269], ['405', 'sold', 1422],
      ['406', 'sold', 1357], ['407', 'sold', 1357], ['408', 'sold', 1422], ['409', 'sold', 2723], ['410', 'sold', 1800],
    ],
    'Building 5': [
      ['500', 'sold', 1258], ['501', 'sold', 1186], ['502', 'sold', 977], ['503', 'sold', 977], ['504', 'sold', 905], ['505', 'sold', 905],
      ['506', 'sold', 976], ['507', 'sold', 976], ['508', 'sold', 1052], ['509', 'sold', 1052], ['510', 'sold', 1052], ['511', 'sold', 1052],
      ['512', 'sold', 976], ['513', 'sold', 976], ['514', 'sold', 905], ['515', 'sold', 905], ['516', 'sold', 2235], ['517', 'sold', 950],
    ],
    // In the tracker with no units.
    'Building 7': [],
    'Building 8': [],
  },
  'reagan-crossing-phase-2': {
    'Building 9': [['901', 'sold', 4301], ['902', 'sold', 2495], ['902A', 'available', 1276], ['902B', 'leased', 1219]],
    'Building 10': [['1001', 'sold', 3033], ['1002', 'sold', 2466]],
    'Building 11': [
      ['1101', 'sold', 1618], ['1102', 'leased', 1216], ['1103', 'sold', 1262], ['1104', 'sold', 1337], ['1105', 'sold', 1410],
      ['1106', 'sold', 1261], ['1107', 'sold', 1338], ['1108', 'sold', 1968], ['1109', 'available', 1618], ['1110', 'sold', 1216],
      ['1111', 'sold', 1262], ['1112', 'sold', 1337], ['1113', 'sold', 1410], ['1114', 'sold', 1261], ['1115', 'sold', 1338],
      ['1116', 'available', 2109],
    ],
    'Building 12': [
      ['1201', 'sold', 1927], ['1202', 'sold', 1338], ['1203', 'sold', 1261], ['1204', 'sold', 1410], ['1205', 'sold', 1337],
      ['1206', 'sold', 1262], ['1207', 'sold', 1216], ['1208', 'sold', 1618], ['1209', 'available', 2067], ['1210', 'sold', 1338],
      ['1211', 'sold', 1261], ['1212', 'available', 1410], ['1213', 'sold', 1337], ['1214', 'sold', 1262], ['1215', 'sold', 1216],
      ['1216', 'available', 1618],
    ],
  },
}

// ── Shapes ───────────────────────────────────────────────────────────────
// Which box in the model is which unit. Worked out 11 Nov 2026 by measuring
// every box's footprint and lining the sequence up against the tracker's unit
// sizes, building by building (footprints run ~1.5× the tracker's square feet
// throughout, so it is the pattern that matches, not the raw figure):
//
//   Building 1+2  one strip of 16 boxes, 100→114 then 200→214 west to east;
//                 mean size error 2%, the two 2,090 sf corner units meet in
//                 the middle and 108/206 are the slightly wider bays.
//   Building 3    a column of 9, 300→310 north to south, every box within 5%.
//   Building 4    a column: 401/402 side by side at the north end, 403→408,
//                 then 409 (the 2,723 sf box) and 410. Which of the two north
//                 boxes is 401 is a guess — they are the same size.
//   Building 5    two columns of back-to-back pairs, 500/501 north → 514/515,
//                 then 516 (the double-depth box) and 517. Evens are put in
//                 the west column from the north pair's sizes (1,258 > 1,186);
//                 the pairs themselves are the same size, so that is weak.
//   Building 9    the 4,301 sf box (901) and the box beside it (902).
//   Building 10   3,033 sf (1001) and 2,466 sf (1002).
//   Buildings 7/8 three boxes each; the tracker has no units there, so they
//                 are tagged as buildings. 7 is the cluster nearer Building 3,
//                 following the site's numbering, which runs 1→6 west to east
//                 along the front and back again along the rear.
//
// Left untagged on purpose (grey context):
//   blk-9077      the large box at the east end — the daycare (Building 6 in
//                 the tracker's seed data; not in the live tracker).
//   blk-8925, blk-8953  one extra box each in Buildings 4 and 5 with no unit
//                 in the tracker; tagged to their building only.
//   Phase 2's south row: 16 boxes that are an exact copy of the Building 1+2
//   strip (same widths, same order) and, under them, 16 flat footprint slabs
//   of a single 16-unit building. The tracker has two 16-unit buildings there
//   (11 and 12) whose sizes match neither row unit-for-unit, so neither is
//   tagged until the client confirms the Phase 2 layout or re-exports it.
const SHAPES = {
  'reagan-crossing-phase-1': {
    'Building 1': {
      units: {
        100: ['blk-8647'],
        102: ['blk-8653'],
        '104+106': ['blk-8659', 'blk-8665'],
        '108+110+112+114': ['blk-8671', 'blk-8677', 'blk-8683', 'blk-8689'],
      },
    },
    'Building 2': {
      units: {
        '200+202': ['blk-8698', 'blk-8706'],
        '204+214': ['blk-8712', 'blk-8742'],
        206: ['blk-8736'],
        208: ['blk-8718'],
        210: ['blk-8724'],
        212: ['blk-8730'],
      },
    },
    'Building 3': {
      units: {
        300: ['blk-8801'], 302: ['blk-8813'], 303: ['blk-8823'], 305: ['blk-8831'], 306: ['blk-8841'],
        307: ['blk-8847'], 308: ['blk-8853'], 309: ['blk-8859'], 310: ['blk-8865'],
      },
    },
    'Building 4': {
      units: {
        401: ['blk-8881'], 402: ['blk-8873'], 403: ['blk-8889'], 404: ['blk-8895'], 405: ['blk-8901'],
        406: ['blk-8907'], 407: ['blk-8913'], 408: ['blk-8919'], 409: ['blk-8945'], 410: ['blk-8935'],
      },
      building: ['blk-8925'],
    },
    'Building 5': {
      units: {
        500: ['blk-9061'], 501: ['blk-9069'], 502: ['blk-9055'], 503: ['blk-9049'], 504: ['blk-9043'], 505: ['blk-9037'],
        506: ['blk-9031'], 507: ['blk-9025'], 508: ['blk-9019'], 509: ['blk-9013'], 510: ['blk-9007'], 511: ['blk-9001'],
        512: ['blk-8989'], 513: ['blk-8995'], 514: ['blk-8977'], 515: ['blk-8983'], 516: ['blk-8961'], 517: ['blk-8971'],
      },
      building: ['blk-8953'],
    },
    'Building 7': { building: ['blk-8775', 'blk-8783', 'blk-8793'] },
    'Building 8': { building: ['blk-8749', 'blk-8757', 'blk-8767'] },
  },
  'reagan-crossing-phase-2': {
    'Building 9': { units: { 901: ['blk-8618'], 902: ['blk-8624'] } },
    'Building 10': { units: { 1001: ['blk-8601'], 1002: ['blk-8611'] } },
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────
const norm = (v) => String(v ?? '').trim().toLowerCase()
const partsOf = (label) => String(label).split('+').filter(Boolean)

// makeUnit() in apps/web/src/lib/units.js — every field, so the admin form has
// no blanks.
const makeUnit = (label) => ({
  label, status: 'available', tenant: '', size: '', clearHeight: '', rate: '', leasePrice: '', salePrice: '', soldPrice: '',
  frontage: '', description: '', x: null, y: null, logo: '', images: [], tenantUrl: '', tenantCategory: '', facingRoad: '',
  hidden: false,
})
// makeBuilding in apps/web/src/admin/PropertyEditPage.jsx.
const makeBuilding = (name) => ({
  building: name, area: '', number: '', units: '', available: '', parking: 'Yes', planImage: '', unitList: [], facingRoad: '',
})

function readGlb(path) {
  const data = readFileSync(path)
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a .glb file`)
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8'))
  // The order three.js's traverse() visits them, which is what the admin stores.
  const meshNames = []
  const visit = (i) => {
    const node = json.nodes[i]
    if (node.mesh !== undefined) meshNames.push(node.name)
    for (const c of node.children ?? []) visit(c)
  }
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root)
  if (new Set(meshNames).size !== meshNames.length) throw new Error('Mesh names in the model are not unique')
  const triangles = json.meshes.reduce(
    (n, mesh) => n + mesh.primitives.reduce((m, p) => m + (p.indices !== undefined ? json.accessors[p.indices].count / 3 : 0), 0),
    0,
  )
  return { data, meshNames, triangles }
}

/** Merge the tracker rows into the record's buildings without losing anything website-owned. */
function mergeBuildings(existing, tracker) {
  const buildings = (existing ?? []).map((b) => ({ ...b, unitList: [...(b.unitList ?? [])] }))
  const log = []
  for (const [name, rows] of Object.entries(tracker)) {
    let building = buildings.find((b) => norm(b.building) === norm(name))
    if (!building) {
      building = makeBuilding(name)
      buildings.push(building)
      log.push(`+ ${name}`)
    }
    building.number = building.number || String(Number(name.match(/\d+$/)[0]))
    for (const [label, status, sqft] of rows) {
      const size = sqft ? sqft.toLocaleString('en-US') : ''
      const at = building.unitList.findIndex((u) => norm(u.label) === norm(label))
      if (at < 0) {
        building.unitList.push({ ...makeUnit(label), status, size })
        log.push(`  + ${name} ${label} (${status}${size ? `, ${size} sf` : ''})`)
      } else {
        const prior = building.unitList[at]
        const next = { ...prior, status, size: size || prior.size }
        if (prior.status !== next.status || prior.size !== next.size) {
          log.push(`  ~ ${name} ${label}: ${prior.status}/${prior.size || '—'} → ${next.status}/${next.size || '—'}`)
        }
        building.unitList[at] = next
      }
    }
  }
  const byNumber = (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || String(a).localeCompare(String(b))
  buildings.sort((a, b) => byNumber(a.number, b.number))
  for (const b of buildings) {
    b.unitList.sort((x, y) => byNumber(x.label, y.label))
    b.units = b.unitList.reduce((n, u) => n + partsOf(u.label).length, 0)
    b.available = b.unitList.filter((u) => u.status === 'available').reduce((n, u) => n + partsOf(u.label).length, 0)
  }
  return { buildings, log }
}

/** buildingBindings/unitBindings as bindSiteMeshes() in apps/web/src/lib/siteModel.js writes them. */
function bindingsFor(shapes, buildings, meshNames) {
  const buildingBindings = {}
  const unitBindings = {}
  const problems = []
  const present = new Set(meshNames)
  const claim = (mesh, buildingLabel) => {
    if (!present.has(mesh)) problems.push(`${mesh} is not in the model`)
    if (buildingBindings[mesh]) problems.push(`${mesh} is tagged twice`)
    buildingBindings[mesh] = buildingLabel
  }
  for (const [name, spec] of Object.entries(shapes)) {
    const building = buildings.find((b) => norm(b.building) === norm(name))
    if (!building) {
      problems.push(`${name} has shapes but no building on the record`)
      continue
    }
    for (const mesh of spec.building ?? []) claim(mesh, building.building)
    for (const [label, meshes] of Object.entries(spec.units ?? {})) {
      const unit = building.unitList.find((u) => norm(u.label) === norm(label))
      if (!unit) problems.push(`${name} ${label} has shapes but no unit row`)
      for (const mesh of meshes) {
        claim(mesh, building.building)
        unitBindings[mesh] = { buildingLabel: building.building, unitLabel: unit?.label ?? label }
      }
    }
  }
  return { buildingBindings, unitBindings, problems }
}

async function call(path, { token, ...init } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

// ── Run ──────────────────────────────────────────────────────────────────
// The records by id, not slug: Phase I was renamed from `reagan-crossing-phase-1`
// to `reagan-crossing` on 11 Nov 2026, the day this was written. The keys
// above stay as they were; the current slug is looked up each run.
const IDS = {
  'reagan-crossing-phase-1': '9ea27598-69a7-4169-b447-06fb7ff2671b',
  'reagan-crossing-phase-2': '11c1262a-fb30-4794-8a3c-a08fd1890648',
}
const listed = await call('/properties')
const list = Array.isArray(listed) ? listed : (listed?.data ?? [])
const slugOf = (key) => {
  const found = list.find((p) => p.id === IDS[key])
  if (!found) throw new Error(`No property with id ${IDS[key]} (${key}) in the public list`)
  return found.slug
}

const model = readGlb(MODEL)
const keys = Object.keys(TRACKER).filter((key) => !ONLY || key === ONLY || slugOf(key) === ONLY)
mkdirSync(OUT_DIR, { recursive: true })

let token = null
if (COMMIT) {
  const email = process.env.PRIME_ADMIN_EMAIL
  const password = process.env.PRIME_ADMIN_PASSWORD
  if (!email || !password) throw new Error('--commit needs PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')
  ;({ accessToken: token } = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }))
}

console.log(`Model ${basename(MODEL)}: ${(model.data.length / 1024).toFixed(0)} KB, ${model.meshNames.length} shapes, ${model.triangles.toLocaleString()} triangles\n`)

let failed = false
for (const key of keys) {
  const slug = slugOf(key)
  const record = COMMIT ? await call(`/admin/properties/${slug}`, { token }) : await call(`/properties/${slug}`)
  const property = record?.data ?? record
  if (property.id !== IDS[key]) throw new Error(`${slug} is ${property.id}, expected ${IDS[key]} — stopping`)
  const detail = property.detail ?? {}

  if (detail.siteModel?.url && !argv.includes('--replace-model')) {
    console.log(`${slug}: already has a site model (${detail.siteModel.url}) — pass --replace-model to swap it. Skipped.\n`)
    continue
  }

  const { buildings, log } = mergeBuildings(detail.floorPlans?.buildings, TRACKER[key])
  const { buildingBindings, unitBindings, problems } = bindingsFor(SHAPES[key], buildings, model.meshNames)

  const units = buildings.reduce((n, b) => n + b.units, 0)
  const available = buildings.reduce((n, b) => n + b.available, 0)
  const tagged = new Set(Object.values(unitBindings).map((b) => `${norm(b.buildingLabel)}::${norm(b.unitLabel)}`))
  const shapeless = buildings.flatMap((b) =>
    b.unitList.filter((u) => !tagged.has(`${norm(b.building)}::${norm(u.label)}`)).map((u) => `${b.building} ${u.label}`),
  )

  console.log(`${slug} (${property.name}, updatedAt ${property.updatedAt ?? '—'})`)
  console.log(`  totals: ${property.buildings}/${property.sold}/${property.available} → ${units}/${units - available}/${available} (units/taken/available)`)
  console.log(`  buildings: ${buildings.map((b) => `${b.building} (${b.units})`).join(', ')}`)
  console.log(`  shapes tagged: ${Object.keys(buildingBindings).length} (${Object.keys(unitBindings).length} to units) of ${model.meshNames.length}`)
  if (shapeless.length) console.log(`  units with no shape in the model (${shapeless.length}): ${shapeless.join(', ')}`)
  for (const line of log.slice(0, 12)) console.log(`  ${line}`)
  if (log.length > 12) console.log(`  … ${log.length - 12} more row changes`)
  if (problems.length) {
    failed = true
    console.log(`  PROBLEMS — nothing will be written for this property:\n    ${problems.join('\n    ')}`)
  }

  const siteModel = {
    ...(detail.siteModel ?? {}),
    url: detail.siteModel?.url ?? '',
    poster: detail.siteModel?.poster ?? '',
    uploadedAt: new Date().toISOString(),
    fileSize: model.data.length,
    triangles: model.triangles,
    meshNames: model.meshNames,
    roads: detail.siteModel?.roads ?? [],
    roadBindings: {},
    buildingBindings,
    unitBindings,
    orientation: detail.siteModel?.orientation ?? null,
  }
  const next = {
    buildings: units,
    sold: units - available,
    available,
    detail: { ...detail, floorPlans: { ...(detail.floorPlans ?? {}), buildings }, siteModel },
  }
  writeFileSync(`${OUT_DIR}/${key}.preview.json`, JSON.stringify({ ...property, ...next }, null, 2))
  console.log(`  preview: ${OUT_DIR}/${key}.preview.json\n`)

  if (!COMMIT || problems.length) continue

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(`${OUT_DIR}/${slug}-before-site-setup-${stamp}.json`, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))

  const form = new FormData()
  form.append('folder', `properties/${slug}/site-model/model`)
  form.append('file', new Blob([model.data], { type: 'model/gltf-binary' }), basename(MODEL))
  const { url } = await call('/uploads/model', { token, method: 'POST', body: form })
  next.detail.siteModel.url = url

  await call(`/admin/properties/${property.id}`, {
    token,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...next, expectedUpdatedAt: property.updatedAt }),
  })
  console.log(`  saved — model at ${url}; backup in ${OUT_DIR}/${slug}-before-site-setup-${stamp}.json\n`)
}

if (!COMMIT) console.log('Dry run — nothing written. Re-run with --commit and an admin login to save.')
if (failed) process.exitCode = 1
