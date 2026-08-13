// One-off: upload the client's CENTRO PLAZA building exports to production
// storage and attach them to the property's floor plans, with units derived
// from the same block grouping the viewer uses at runtime.
//
// Run from apps/web so the app's own units lib resolves:
//   node upload-buildings.mjs --dry
//   node upload-buildings.mjs --commit
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createClient } from '@supabase/supabase-js'
import { groupBySharedVertices, MODEL_MAX_BYTES, MODEL_MAX_TRIANGLES } from './src/lib/units.js'

const COMMIT = process.argv.includes('--commit')
const SLUG = 'centro-plaza'
const BUCKET = 'models'
const SPAN_FRACTION = 0.6

// Read straight from the API's env rather than duplicating secrets here.
const env = Object.fromEntries(
  readFileSync('../api/.env', 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z_]+\s*=/.test(line))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Array index decides the storage folder, matching how building-0 was written.
// `number`/`building` carry the client's own block numbering, which skips 7
// and 8 because those exports are duplicates of B-06.
const PLAN = [
  { index: 1, block: 2, file: '/Users/kalyan/Downloads/CENTRO PLAZA B-02.glb' },
  { index: 2, block: 3, file: '/Users/kalyan/Downloads/CENTRO PLAZA B-03.glb' },
  { index: 3, block: 4, file: '/Users/kalyan/Downloads/CENTRO PLAZA B-04.glb' },
  { index: 4, block: 5, file: '/Users/kalyan/Downloads/CENTRO PLAZA B-05.glb' },
  { index: 5, block: 6, file: '/Users/kalyan/Downloads/CENTRO PLAZA B-06 (1).glb' },
  { index: 6, block: 9, file: '/Users/kalyan/Downloads/CENTRO PLAZA B-09 (1).glb' },
  { index: 7, block: 10, file: '/Users/kalyan/Downloads/CENTRO PLAZA B-10 (1).glb' },
]

/**
 * Blocks, units and bindings for one export.
 *
 * Deliberately mirrors ModelViewer: bounds recomputed from vertex data (the
 * converter's declared accessor bounds are stale), the extrusion axis detected
 * rather than assumed, full-footprint slabs excluded so the ground does not
 * fuse every unit into one, and grouping keyed on the two plan axes.
 * Any drift between this and the viewer would bind meshes the viewer then
 * groups differently, so the numbering on screen would not match the CMS.
 */
async function analyse(path) {
  const buf = readFileSync(path)
  const bytes = buf.byteLength
  const scene = await new Promise((resolve, reject) =>
    new GLTFLoader().parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      '',
      (gltf) => resolve(gltf.scene),
      reject,
    ),
  )
  scene.updateMatrixWorld(true)

  const meshes = []
  scene.traverse((o) => {
    if (!o.isMesh) return
    o.geometry.computeBoundingBox()
    o.geometry.computeBoundingSphere()
    meshes.push(o)
  })

  let triangles = 0
  for (const m of meshes) {
    const g = m.geometry
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3
  }

  const box = new THREE.Box3()
  for (const m of meshes) box.union(new THREE.Box3().setFromObject(m))
  const size = box.getSize(new THREE.Vector3())
  const extent = [size.x, size.y, size.z]
  const shortest = extent.indexOf(Math.min(...extent))
  const flank = [0, 1, 2].filter((a) => a !== shortest)
  const isExtrusion =
    extent[shortest] > 0 &&
    extent[shortest] < Math.min(extent[flank[0]], extent[flank[1]]) / 2 &&
    Math.abs(box.min.getComponent(shortest)) < extent[shortest] * 0.05
  const upAxis = isExtrusion ? shortest : 1
  const planAxes = [0, 1, 2].filter((a) => a !== upAxis)
  const [planA, planB] = planAxes.map((a) => 'xyz'[a])
  const siteArea = extent[planAxes[0]] * extent[planAxes[1]]

  const items = []
  const centroids = new Map()
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position')
    const keys = new Set()
    const v = new THREE.Vector3()
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
      const a = v[planA]
      const b = v[planB]
      if (a < minA) minA = a
      if (a > maxA) maxA = a
      if (b < minB) minB = b
      if (b > maxB) maxB = b
      keys.add(`${a.toFixed(2)}|${b.toFixed(2)}`)
    }
    if (siteArea > 0 && (maxA - minA) * (maxB - minB) > siteArea * SPAN_FRACTION) continue
    items.push({ name: mesh.name, keys })
    centroids.set(mesh.name, [(minA + maxA) / 2, (minB + maxB) / 2])
  }

  const groupOf = groupBySharedVertices(items)
  const members = new Map()
  for (const [name, gid] of groupOf) {
    if (!members.has(gid)) members.set(gid, [])
    members.get(gid).push(name)
  }

  // Numbered along the building's long axis so unit 101 is at one end and the
  // numbers run down the terrace, which is how the client numbers B-01.
  const longAxisFirst = extent[planAxes[0]] >= extent[planAxes[1]]
  const ordered = [...members.entries()]
    .map(([gid, names]) => {
      const pts = names.map((n) => centroids.get(n))
      const a = pts.reduce((s, p) => s + p[0], 0) / pts.length
      const b = pts.reduce((s, p) => s + p[1], 0) / pts.length
      return { gid, names, a, b }
    })
    .sort((x, y) => (longAxisFirst ? x.a - y.a || x.b - y.b : x.b - y.b || x.a - y.a))

  const unitList = []
  const bindings = {}
  ordered.forEach((group, i) => {
    const label = String(101 + i)
    // Matches makeUnit(): every field present, only the label and status set.
    // Blank fields render as omitted rather than as empty rows, so a building
    // is presentable the moment it is uploaded and gets richer as the admin
    // fills it in.
    unitList.push({
      x: null, y: null, rate: '', size: '', floor: '',
      label, status: 'available', tenant: '', frontage: '', description: '',
    })
    for (const name of group.names) bindings[name] = label
  })

  return {
    bytes, triangles, meshes: meshes.length,
    meshNames: meshes.map((m) => m.name),
    dims: extent.map((n) => Math.round(n)),
    blocks: ordered.length, unitList, bindings,
    overLimit: bytes > MODEL_MAX_BYTES || triangles > MODEL_MAX_TRIANGLES,
  }
}

const results = []
for (const entry of PLAN) {
  const a = await analyse(entry.file)
  if (a.overLimit) throw new Error(`B-${String(entry.block).padStart(2, '0')} exceeds upload limits`)
  results.push({ ...entry, ...a })
  console.log(
    `B-${String(entry.block).padStart(2, '0')}  ${String(Math.round(a.bytes / 1024)).padStart(3)}KB  ` +
    `${String(a.meshes).padStart(3)} meshes  ${String(a.triangles).padStart(3)} tris  ` +
    `${a.dims.join(' x ').padEnd(20)}  ${String(a.blocks).padStart(2)} units  ` +
    `${Object.keys(a.bindings).length} bindings`,
  )
}

if (!COMMIT) {
  console.log('\nDry run — nothing uploaded. Re-run with --commit.')
  process.exit(0)
}

const { data: property, error: readErr } = await supabase
  .from('properties').select('id, detail').eq('slug', SLUG).single()
if (readErr) throw readErr

const buildings = [...(property.detail?.floorPlans?.buildings ?? [])]
console.log(`\nExisting buildings: ${buildings.length}`)

for (const r of results) {
  const folder = `projects/${SLUG}/building-${r.index}/model`
  const path = `${folder}/${randomUUID()}.glb`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, readFileSync(r.file), {
      contentType: 'model/gltf-binary',
      cacheControl: '31536000',
      upsert: false,
    })
  if (upErr) throw new Error(`upload ${path}: ${upErr.message}`)
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  buildings[r.index] = {
    area: '',
    units: r.unitList.length,
    number: r.block,
    parking: 'Yes',
    building: `Block B-${String(r.block).padStart(2, '0')}`,
    unitList: r.unitList,
    available: r.unitList.length,
    planImage: '',
    model: {
      url,
      poster: '',
      bindings: r.bindings,
      fileSize: r.bytes,
      meshNames: r.meshNames,
      triangles: r.triangles,
      uploadedAt: new Date().toISOString(),
    },
  }
  console.log(`uploaded B-${String(r.block).padStart(2, '0')} -> ${path}`)
}

const detail = {
  ...property.detail,
  floorPlans: { ...property.detail.floorPlans, buildings },
}
const { error: writeErr } = await supabase
  .from('properties').update({ detail }).eq('id', property.id)
if (writeErr) throw writeErr

console.log(`\nCMS updated: ${buildings.length} buildings on ${SLUG}.`)
