// Turns a whole-site export made of "one group per unit" into a site model the
// viewer and the admin's tap-to-tag can work with: one named shape per unit box,
// and the site plan underneath collapsed into a single piece of scenery.
//
// Written for the Reagan Crossing (tracker: "RRC") export the client sent on
// 9 Nov 2026 as `01.glb` (ImageToStl converter, 6.5 MB). That file is:
//
//   • one root node (inches → metres, Z-up → Y-up), whose children are
//   • node 1, a "Component" holding the flat CAD site plan — kerbs, parking,
//     trees, roundabouts — as 8,580 separate meshes, and
//   • 115 "Group" nodes, each one unit box (5–12 wall/roof faces) or, for
//     16 of them, a flat footprint slab with no height.
//
// Every node is called "Component", "Group" or "Mesh0", so nothing can be
// bound by name, and 27,510 accessors make the JSON chunk 5 MB of the 6.5. Here
// each group's faces are baked (world transform applied) into ONE mesh named
// after the group's node index in the source file — `blk-8801` is node 8801 —
// so a binding can always be traced back to the client's file. Flat groups are
// `slab-N`. The site plan becomes one mesh, `site-plan`.
//
// The model is moved so the ground sits at y = 0 and the plan is centred on the
// origin; nothing is rotated or scaled. The offset is printed.
//
//   node scripts/prepare-site-model.mjs <input.glb> <output.glb> [--report out.json]
//
// Then Draco-compress it: node scripts/compress-site-model.mjs <output.glb> <final.glb>
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const [input, output] = args.filter((a) => !a.startsWith('--'))
const reportAt = args.includes('--report') ? args[args.indexOf('--report') + 1] : null
if (!input || !output) {
  console.error('Usage: node scripts/prepare-site-model.mjs <input.glb> <output.glb> [--report out.json]')
  process.exit(1)
}

// ── Read ─────────────────────────────────────────────────────────────────
const file = readFileSync(input)
if (file.readUInt32LE(0) !== 0x46546c67) throw new Error(`${input} is not a .glb file`)
const jsonLength = file.readUInt32LE(12)
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'))
const binStart = 20 + jsonLength + 8
const bin = file.subarray(binStart, binStart + file.readUInt32LE(20 + jsonLength))

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const ARRAYS = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }

function readAccessor(index) {
  const accessor = gltf.accessors[index]
  const view = gltf.bufferViews[accessor.bufferView]
  const Type = ARRAYS[accessor.componentType]
  const width = COMPONENTS[accessor.type]
  if (view.byteStride && view.byteStride !== Type.BYTES_PER_ELEMENT * width) {
    throw new Error(`Interleaved accessor ${index} is not supported`)
  }
  const offset = bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  // Copied: the buffer's own offset need not be aligned for a typed view.
  const bytes = bin.buffer.slice(offset, offset + accessor.count * width * Type.BYTES_PER_ELEMENT)
  return new Type(bytes)
}

// ── World transforms ─────────────────────────────────────────────────────
// Column-major 4x4, as glTF stores them.
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
function multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k]
  return out
}
function localMatrix(node) {
  if (node.matrix) return node.matrix
  if (node.translation || node.rotation || node.scale) {
    throw new Error(`Node "${node.name}" uses TRS; only matrix transforms are handled (none seen in this exporter)`)
  }
  return IDENTITY
}

const nodes = gltf.nodes
const world = new Array(nodes.length)
const scene = gltf.scenes[gltf.scene ?? 0]
const stack = scene.nodes.map((index) => [index, IDENTITY])
while (stack.length) {
  const [index, parent] = stack.pop()
  world[index] = multiply(parent, localMatrix(nodes[index]))
  for (const child of nodes[index].children ?? []) stack.push([child, world[index]])
}

const subtree = (index) => {
  const out = []
  const todo = [index]
  while (todo.length) {
    const i = todo.pop()
    out.push(i)
    todo.push(...(nodes[i].children ?? []))
  }
  return out
}

// ── Bake ─────────────────────────────────────────────────────────────────
/** Every triangle under `rootIndex`, in world space, as one geometry. */
function bake(rootIndex) {
  const positions = []
  const normals = []
  const indices = []
  for (const i of subtree(rootIndex)) {
    const node = nodes[i]
    if (node.mesh === undefined) continue
    const m = world[i]
    // Uniform scale throughout this exporter, so the normal matrix is the
    // rotation part, renormalised.
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      if ((primitive.mode ?? 4) !== 4) continue
      const p = readAccessor(primitive.attributes.POSITION)
      const n = primitive.attributes.NORMAL !== undefined ? readAccessor(primitive.attributes.NORMAL) : null
      const base = positions.length / 3
      for (let v = 0; v < p.length; v += 3) {
        const [x, y, z] = [p[v], p[v + 1], p[v + 2]]
        positions.push(
          m[0] * x + m[4] * y + m[8] * z + m[12],
          m[1] * x + m[5] * y + m[9] * z + m[13],
          m[2] * x + m[6] * y + m[10] * z + m[14],
        )
        if (n) {
          const [a, b, c] = [n[v], n[v + 1], n[v + 2]]
          const nx = m[0] * a + m[4] * b + m[8] * c
          const ny = m[1] * a + m[5] * b + m[9] * c
          const nz = m[2] * a + m[6] * b + m[10] * c
          const length = Math.hypot(nx, ny, nz) || 1
          normals.push(nx / length, ny / length, nz / length)
        } else {
          normals.push(0, 1, 0)
        }
      }
      const index = primitive.indices !== undefined ? readAccessor(primitive.indices) : null
      if (index) for (const k of index) indices.push(base + k)
      else for (let k = 0; k < p.length / 3; k++) indices.push(base + k)
    }
  }
  return { positions, normals, indices }
}

const bounds = (positions) => {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], positions[i + a])
      max[a] = Math.max(max[a], positions[i + a])
    }
  return { min, max }
}

const root = scene.nodes[0]
const children = nodes[root].children ?? []
const meshCount = (i) => subtree(i).filter((k) => nodes[k].mesh !== undefined).length
// The site plan is the child holding most of the meshes — 8,580 of 9,170 here.
const sitePlanIndex = children.reduce((best, i) => (meshCount(i) > meshCount(best) ? i : best), children[0])

const shapes = []
const sitePlan = bake(sitePlanIndex)
for (const index of children) {
  if (index === sitePlanIndex) continue
  const geometry = bake(index)
  if (!geometry.indices.length) continue
  const { min, max } = bounds(geometry.positions)
  const flat = max[1] - min[1] < 0.05
  shapes.push({ name: `${flat ? 'slab' : 'blk'}-${index}`, source: index, geometry, min, max })
}

// ── Recentre ─────────────────────────────────────────────────────────────
// Ground = the site plan's lowest point (every box stands on it); centre = the
// middle of everything on plan.
const all = bounds([...sitePlan.positions, ...shapes.flatMap((s) => s.geometry.positions)])
const offset = [-(all.min[0] + all.max[0]) / 2, -bounds(sitePlan.positions).min[1], -(all.min[2] + all.max[2]) / 2]
const shift = (positions) => {
  for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) positions[i + a] += offset[a]
}
shift(sitePlan.positions)
for (const shape of shapes) {
  shift(shape.geometry.positions)
  for (let a = 0; a < 3; a++) {
    shape.min[a] += offset[a]
    shape.max[a] += offset[a]
  }
}

// ── Write ────────────────────────────────────────────────────────────────
const chunks = []
let byteLength = 0
const out = {
  asset: { version: '2.0', generator: `prepare-site-model.mjs from ${input.split('/').pop()}` },
  scene: 0,
  scenes: [{ name: 'site', nodes: [0] }],
  nodes: [{ name: 'site', children: [] }],
  meshes: [],
  materials: [{ name: 'default', pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 1 }, doubleSided: true }],
  accessors: [],
  bufferViews: [],
  buffers: [],
}

function pushView(typed, target) {
  const pad = (4 - (byteLength % 4)) % 4
  if (pad) {
    chunks.push(Buffer.alloc(pad))
    byteLength += pad
  }
  out.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: typed.byteLength, target })
  chunks.push(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength))
  byteLength += typed.byteLength
  return out.bufferViews.length - 1
}

function addMesh(name, { positions, normals, indices }) {
  const p = new Float32Array(positions)
  const { min, max } = bounds(p)
  const pAccessor = out.accessors.push({ bufferView: pushView(p, 34962), componentType: 5126, count: p.length / 3, type: 'VEC3', min, max }) - 1
  const n = new Float32Array(normals)
  const nAccessor = out.accessors.push({ bufferView: pushView(n, 34962), componentType: 5126, count: n.length / 3, type: 'VEC3' }) - 1
  const wide = p.length / 3 > 65535
  const i = wide ? new Uint32Array(indices) : new Uint16Array(indices)
  const iAccessor = out.accessors.push({ bufferView: pushView(i, 34963), componentType: wide ? 5125 : 5123, count: i.length, type: 'SCALAR' }) - 1
  const mesh = out.meshes.push({ name, primitives: [{ attributes: { POSITION: pAccessor, NORMAL: nAccessor }, indices: iAccessor, material: 0 }] }) - 1
  const node = out.nodes.push({ name, mesh }) - 1
  out.nodes[0].children.push(node)
}

addMesh('site-plan', sitePlan)
for (const shape of shapes) addMesh(shape.name, shape.geometry)

const binChunk = Buffer.concat(chunks)
out.buffers.push({ byteLength: binChunk.length })
let json = Buffer.from(JSON.stringify(out), 'utf8')
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
const binPadded = Buffer.concat([binChunk, Buffer.alloc((4 - (binChunk.length % 4)) % 4)])
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + json.length + 8 + binPadded.length, 8)
const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(json.length, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binPadded.length, 0)
binHeader.writeUInt32LE(0x004e4942, 4)
writeFileSync(output, Buffer.concat([header, jsonHeader, json, binHeader, binPadded]))

// ── Report ───────────────────────────────────────────────────────────────
const SQFT_PER_M2 = 10.7639
const report = shapes.map((s) => ({
  name: s.name,
  centre: [+((s.min[0] + s.max[0]) / 2).toFixed(1), +((s.min[2] + s.max[2]) / 2).toFixed(1)],
  size: [+(s.max[0] - s.min[0]).toFixed(1), +(s.max[1] - s.min[1]).toFixed(1), +(s.max[2] - s.min[2]).toFixed(1)],
  footprintSqft: Math.round((s.max[0] - s.min[0]) * (s.max[2] - s.min[2]) * SQFT_PER_M2),
}))
if (reportAt) writeFileSync(reportAt, JSON.stringify({ offset, shapes: report }, null, 2))

const triangles = (sitePlan.indices.length + shapes.reduce((n, s) => n + s.geometry.indices.length, 0)) / 3
console.log(
  `${input} (${(file.length / 1e6).toFixed(2)} MB, ${gltf.meshes.length} meshes) -> ${output} ` +
    `(${(byteLength / 1e6).toFixed(2)} MB, ${out.meshes.length} meshes, ${triangles.toLocaleString()} triangles)`,
)
console.log(`  site plan: node ${sitePlanIndex}, ${meshCount(sitePlanIndex)} meshes -> "site-plan"`)
console.log(`  shapes: ${shapes.filter((s) => s.name.startsWith('blk-')).length} boxes, ${shapes.filter((s) => s.name.startsWith('slab-')).length} flat slabs`)
console.log(`  moved by [${offset.map((v) => v.toFixed(3)).join(', ')}] so the ground is at y = 0`)
