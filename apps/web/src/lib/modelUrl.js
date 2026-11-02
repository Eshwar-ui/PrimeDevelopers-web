// Where the browser should fetch a 3D model from.
//
// Dev only. Model files live on the site's CDN, which sends no CORS headers.
// The deployed site never notices, because it is served from that same origin;
// a local session is not, so the browser blocks the download and every 3D
// viewer lands on "The 3D model didn't load". vite.config.js proxies /media on
// the dev server to that CDN and exposes its origin as VITE_DEV_MEDIA_ORIGIN —
// this points a model URL at the proxy instead.
//
// Anything not on that origin is returned untouched, and a production build
// never sets the variable, so this is the identity function there.
const PROXIED_ORIGIN = import.meta.env.DEV ? import.meta.env.VITE_DEV_MEDIA_ORIGIN : ''

export function modelSrc(url) {
  if (!PROXIED_ORIGIN || !url) return url
  try {
    const parsed = new URL(url)
    return parsed.origin === PROXIED_ORIGIN ? `${parsed.pathname}${parsed.search}` : url
  } catch {
    return url
  }
}
