// Compresses a whole-site GLB export toward the models bucket's 8 MB cap
// without merging any meshes together.
//
// The client's whole-site exports (like the first one, SITE LAYOUT.glb) carry
// their size almost entirely in a handful of oversized PNG textures — one
// alone was 30+ MB at 3200x2906px — while geometry across all ~364 meshes was
// under 2 MB. So the fix is texture recompression (WebP, capped resolution)
// plus Draco geometry compression, NOT simplifying or merging anything.
//
// `gltf-transform optimize`'s default preset also joins/flattens/instances
// meshes to cut draw calls, which is exactly wrong here: the admin's tap-to-tag
// flow (SiteModelManager) binds units, buildings and roads by clicking
// individual meshes, so every mesh that goes in must still exist, separately,
// on the way out. Those steps are explicitly disabled below — see the
// validated trial in the site-model PRD (46.56 MB -> 1.84 MB, mesh count
// unchanged) before changing these flags.
//
// Usage: node scripts/compress-site-model.mjs <input.glb> <output.glb>
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const [, , input, output] = process.argv
if (!input || !output) {
  console.error('Usage: node scripts/compress-site-model.mjs <input.glb> <output.glb>')
  process.exit(1)
}

// Meshes/nodes are 1:1 in every export we've seen from this client (one mesh
// per node, no reuse) — reading node+mesh count straight from the glTF JSON
// chunk is enough to confirm nothing got merged, with no extra dependency.
function countNodesAndMeshes(path) {
  const data = readFileSync(path)
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a .glb file`)
  const jsonChunkLength = data.readUInt32LE(12)
  const json = JSON.parse(data.subarray(20, 20 + jsonChunkLength).toString('utf8'))
  return { nodes: (json.nodes ?? []).length, meshes: (json.meshes ?? []).length }
}

const before = countNodesAndMeshes(input)
const beforeSize = statSync(input).size

console.log(`Compressing ${input} (${(beforeSize / 1e6).toFixed(2)} MB, ${before.meshes} meshes)...`)

execFileSync(
  'npx',
  [
    '--yes',
    '@gltf-transform/cli',
    'optimize',
    input,
    output,
    '--texture-compress', 'webp',
    '--texture-size', '1024',
    '--compress', 'draco',
    // Keep every mesh separately tappable — see the header comment.
    '--join', 'false',
    '--flatten', 'false',
    '--instance', 'false',
    '--palette', 'false',
    '--simplify', 'false',
  ],
  { stdio: 'inherit' }
)

const after = countNodesAndMeshes(output)
const afterSize = statSync(output).size

console.log(
  `\n${input} (${(beforeSize / 1e6).toFixed(2)} MB) -> ${output} (${(afterSize / 1e6).toFixed(2)} MB)`
)

if (after.meshes !== before.meshes || after.nodes !== before.nodes) {
  console.error(
    `\nMesh/node count changed (${before.meshes} meshes / ${before.nodes} nodes -> ${after.meshes} meshes / ${after.nodes} nodes). ` +
      `Something merged meshes that tagging depends on — do not upload this file. Check the flags above.`
  )
  process.exit(1)
}

const MODELS_BUCKET_LIMIT = 8 * 1024 * 1024
if (afterSize > MODELS_BUCKET_LIMIT) {
  console.error(
    `\nStill ${(afterSize / 1e6).toFixed(2)} MB — over the models bucket's 8 MB cap. ` +
      `Try a smaller --texture-size, or check for additional oversized textures.`
  )
  process.exit(1)
}

console.log(`${after.meshes} meshes preserved, under the 8 MB models bucket cap. Safe to upload.`)
