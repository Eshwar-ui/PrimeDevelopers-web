import { MODEL_MAX_BYTES, MODEL_MAX_TRIANGLES, formatBytes } from './units'

// Parses a .glb in the browser before it is uploaded, so the admin learns
// what is wrong with a model while they still have the file in hand — rather
// than after a slow upload, or worse, after a visitor's phone runs out of
// memory. three is imported dynamically so the admin bundle never carries it.
export async function inspectGlb(file) {
  const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ])

  const draco = new DRACOLoader().setDecoderPath('/draco/')
  const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)

  const buffer = await file.arrayBuffer()
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject)
  })
  draco.dispose()

  const meshNames = []
  let triangles = 0

  gltf.scene.traverse((object) => {
    if (!object.isMesh) return
    meshNames.push(object.name)
    const geometry = object.geometry
    const count = geometry?.index ? geometry.index.count : (geometry?.attributes?.position?.count ?? 0)
    triangles += Math.floor(count / 3)
  })

  return { meshNames, triangles, fileSize: file.size }
}

// Rejections name the actual number, the limit, and the specific remedy.
// "File too large" tells an admin nothing they can act on.
export function validateModelFile(file) {
  if (!file) return 'No file selected.'

  const isGlb = file.name.toLowerCase().endsWith('.glb')
  if (!isGlb) {
    return `Only .glb files are accepted (this is “${file.name}”). Ask your modeller to export binary glTF.`
  }

  if (file.size > MODEL_MAX_BYTES) {
    return `This model is ${formatBytes(file.size)}. The limit is ${formatBytes(MODEL_MAX_BYTES)} — larger models fail on mobile. Ask your modeller to re-export with Draco compression.`
  }

  return null
}

export function triangleWarning(triangles) {
  if (triangles <= MODEL_MAX_TRIANGLES) return null
  return `This model has ${triangles.toLocaleString()} triangles, above the ${MODEL_MAX_TRIANGLES.toLocaleString()} recommended for smooth performance on phones. It will still work, but may feel slow on older devices.`
}
