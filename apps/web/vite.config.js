import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * three's DRACOLoader resolves its decoder files at module scope with
 * `new URL('../libs/draco/…', import.meta.url)`. Vite sees those, treats them
 * as assets and copies ~1.3 MB of decoder into dist — none of which is ever
 * requested, because we point the loader at the self-hosted copy in
 * `public/draco/` instead.
 *
 * This rewrites those expressions to plain paths, so nothing is emitted and
 * `/draco/` also becomes the loader's built-in default.
 *
 * Failure mode is safe: if three changes the shape of those lines the regex
 * stops matching, the assets come back, and the app still works — it just
 * carries the dead weight again.
 */
function selfHostedDraco() {
  const DECODER_URL = /new URL\(\s*'\.\.\/libs\/draco\/(?:gltf\/)?([\w.]+)',\s*import\.meta\.url\s*\)\.toString\(\)/g

  return {
    name: 'self-hosted-draco',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('three/examples/jsm/loaders/DRACOLoader')) return null
      if (!DECODER_URL.test(code)) return null
      DECODER_URL.lastIndex = 0
      return { code: code.replace(DECODER_URL, (_, file) => `'/draco/${file}'`), map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), selfHostedDraco()],
})
