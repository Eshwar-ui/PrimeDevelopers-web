// Builds a minimal .glb massing model for verifying the viewer end to end:
// one shared unit-cube mesh, one node per unit named `unit-<label>`, plus a
// ground slab named as scenery so the "not everything is interactive" path
// gets exercised too.
import { writeFileSync } from 'node:fs'

const F = [
  // [normal, four corner offsets] for each face of a unit cube (-0.5..0.5)
  [[1, 0, 0], [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]]],
  [[-1, 0, 0], [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]]],
  [[0, 1, 0], [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]]],
  [[0, -1, 0], [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5]]],
  [[0, 0, 1], [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]],
  [[0, 0, -1], [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]],
]

const positions = []
const normals = []
const indices = []
F.forEach(([n, corners], f) => {
  corners.forEach((c) => {
    positions.push(...c)
    normals.push(...n)
  })
  const b = f * 4
  indices.push(b, b + 1, b + 2, b, b + 2, b + 3)
})

const posBuf = Buffer.from(new Float32Array(positions).buffer)
const nrmBuf = Buffer.from(new Float32Array(normals).buffer)
const idxBuf = Buffer.from(new Uint16Array(indices).buffer)
// glTF requires the JSON chunk padded with spaces and the BIN chunk with
// zeros — pad the JSON chunk with 0x00 and JSON.parse chokes on the tail.
const pad = (buf, byte = 0x00) =>
  buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4), byte)]) : buf
const bin = Buffer.concat([posBuf, nrmBuf, pad(idxBuf)])

// label, [x, z], [width, height, depth]
const UNITS = [
  ['301', [-9, -6], [5, 4, 7]],
  ['302', [-3.5, -6], [5, 4, 7]],
  ['304', [2, -6], [5, 5.5, 7]],
  ['307', [7.5, -6], [5, 5.5, 7]],
  ['405', [-9, 4], [5, 3.5, 7]],
  ['406', [-3.5, 4], [5, 3.5, 7]],
  ['408', [2, 4], [5, 4.5, 7]],
  ['409', [7.5, 4], [5, 4.5, 7]],
  ['601', [15, -2], [6, 3, 16]],
]

const nodes = [
  { name: 'site-ground', mesh: 0, translation: [2, -0.15, 0], scale: [46, 0.3, 34] },
  { name: 'road-main', mesh: 0, translation: [2, 0.02, -0.6], scale: [42, 0.05, 3.4] },
  ...UNITS.map(([label, [x, z], [w, h, d]]) => ({
    name: `unit-${label}`,
    mesh: 0,
    translation: [x, h / 2, z],
    scale: [w, h, d],
  })),
]

const gltf = {
  asset: { version: '2.0', generator: 'prime-developers test fixture' },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes: [{ name: 'box', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
    { buffer: 0, byteOffset: posBuf.length, byteLength: nrmBuf.length, target: 34962 },
    { buffer: 0, byteOffset: posBuf.length + nrmBuf.length, byteLength: idxBuf.length, target: 34963 },
  ],
  buffers: [{ byteLength: bin.length }],
}

const jsonChunk = pad(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20)
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8)

const chunk = (data, type) => {
  const head = Buffer.alloc(8)
  head.writeUInt32LE(data.length, 0)
  head.writeUInt32LE(type, 4)
  return Buffer.concat([head, data])
}

const out = process.argv[2]
writeFileSync(out, Buffer.concat([header, chunk(jsonChunk, 0x4e4f534a), chunk(bin, 0x004e4942)]))
console.log(`wrote ${out} — ${nodes.length} nodes, ${UNITS.length} units`)
