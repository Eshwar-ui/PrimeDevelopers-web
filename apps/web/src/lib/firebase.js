/**
 * Firebase Analytics and Performance Monitoring.
 *
 * Loaded deliberately late and off the critical path. Everything here is behind
 * a dynamic import that only runs after the app has mounted, so the SDK lands
 * in its own chunk and never touches the bundle a first paint waits on — the
 * whole point of the code splitting and the inline content prefetch is that the
 * first screen costs as little as possible, and measurement is not worth
 * spending that budget on.
 *
 * Late initialisation does not cost us the load metrics. Performance Monitoring
 * reads the browser's Navigation and Resource Timing entries, which are
 * recorded by the browser whether or not the SDK was listening at the time, so
 * the page-load trace is complete even though this starts after mount.
 *
 * The config below is not secret. A Firebase web config is a set of public
 * identifiers — Google's own documentation ships it in client source — and
 * access is governed by security rules and API-key restrictions rather than by
 * hiding these values. They are inlined rather than passed through VITE_ env
 * vars because they are the same in every environment and would otherwise be
 * six more keys to keep in step across three .env files.
 */
const config = {
  apiKey: 'AIzaSyCHsNIlmkvzAWzbz2K_WmRuj4TWPfjYMG8',
  authDomain: 'theprime-construction.firebaseapp.com',
  projectId: 'theprime-construction',
  storageBucket: 'theprime-construction.firebasestorage.app',
  messagingSenderId: '723505302734',
  appId: '1:723505302734:web:fbb3a14718cd1dbbbd549f',
  measurementId: 'G-D1ZFLHW94L',
}

/**
 * Starts measurement. Safe to call more than once — the guard makes repeat
 * calls no-ops rather than initialising a second Firebase app.
 *
 * Silent by design. Analytics is blocked outright by a good share of ad
 * blockers and by Brave, and a rejected dynamic import there would surface as
 * an uncaught error in the console of a visitor who has done nothing wrong.
 * Nothing on the site depends on this resolving.
 */
let started = false

export function startMeasurement() {
  // Development traffic is our own, and mixing it into the property's numbers
  // makes every report a little wrong in a way nobody remembers to correct for.
  if (started || !import.meta.env.PROD || typeof window === 'undefined') return
  started = true

  const run = async () => {
    try {
      const [{ initializeApp }, { getAnalytics, isSupported }, { getPerformance }] =
        await Promise.all([
          import('firebase/app'),
          import('firebase/analytics'),
          import('firebase/performance'),
        ])

      const app = initializeApp(config)

      // Analytics needs cookies and IndexedDB. `isSupported` is what keeps this
      // from throwing in a private window or an embedded webview where they are
      // unavailable — Performance has no such requirement and still runs.
      if (await isSupported()) getAnalytics(app)
      getPerformance(app)
    } catch {
      /* blocked, offline, or unsupported — measurement is not load-bearing */
    }
  }

  // Waits for the browser to be idle rather than racing the page. requestIdle-
  // Callback is unavailable in Safari before 16.4, hence the timeout fallback.
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else window.setTimeout(run, 2000)
}
