import { defineConfig, loadEnv } from 'vite'
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
export default defineConfig(({ command, mode }) => {
  /**
   * Dev-only API proxy. Set DEV_API_TARGET in .env to whichever API you're
   * working against — a local `pnpm --filter @prime-developers/api dev`, or
   * the deployed Render service — and point VITE_API_BASE_URL at the dev
   * server itself. The browser then only ever talks to its own origin, so the
   * deployed API's CORS allowlist (which knows nothing about localhost) can't
   * block a local session. Absent the variable, nothing is proxied; production
   * builds never see this block at all.
   */
  const { DEV_API_TARGET, VITE_API_BASE_URL } = loadEnv(mode, process.cwd(), '')

  /**
   * A production build bakes VITE_API_BASE_URL into the bundle and into
   * index.html's preconnect and prefetch, and the site is deployed by hand from
   * a developer's machine rather than by CI. That combination has exactly one
   * bad outcome: a build carrying a localhost origin goes live and every
   * visitor sees a site that cannot reach its own data.
   *
   * .env.production is the reason that shouldn't happen. This is the reason it
   * can't: fail the build rather than deploy a broken bundle. A local override
   * — .env.production.local — will trip this too, which is the point.
   */
  if (command === 'build' && mode === 'production') {
    if (!VITE_API_BASE_URL) {
      throw new Error('VITE_API_BASE_URL is unset — check apps/web/.env.production.')
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(VITE_API_BASE_URL)) {
      throw new Error(
        `Refusing to build for production against ${VITE_API_BASE_URL}. ` +
          'That value is baked into the deployed bundle. It comes from ' +
          'apps/web/.env.production, or from a .env.production.local overriding it.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss(), selfHostedDraco()],
    server: DEV_API_TARGET
      ? { proxy: { '/api': { target: DEV_API_TARGET, changeOrigin: true } } }
      : {},
  }
})
