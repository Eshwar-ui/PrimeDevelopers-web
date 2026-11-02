import { useEffect } from 'react'
import { applyHead } from '../lib/head'
import { INDEXABLE, resolveHead } from '../lib/seo'
import { SITE_ORIGIN, isProductionHost } from '../lib/site'

/**
 * Give one route its own <head>: title, description, canonical, social card
 * and any JSON-LD, put back when the route leaves.
 *
 * Call it with a `path` rather than a full URL. Canonicals must always name
 * the production origin whichever host is serving the build (see lib/site),
 * and leaving that to each caller is how one page ends up canonicalising
 * itself to the CloudFront copy.
 *
 *   useHead({ path: '/about', title: '…', description: '…' })
 *
 * Robots is only raised to `index` on the production host. Everywhere else
 * main.jsx has already written `noindex, nofollow` before the first render,
 * and writing anything here would overwrite it — applyHead updates a tag that
 * already exists rather than adding a second one, so a staging copy would
 * quietly invite the crawler in. A page that must stay out of the index
 * (the 404) passes `robots` explicitly and is honoured on every host.
 */
export function useHead(spec) {
  // The spec is rebuilt on every render, so its identity is useless as a
  // dependency and an effect keyed on it would unwind and rewrite the whole
  // head each time. Keyed on the content instead, this runs when something
  // actually changed — which, on a page whose data arrives from the API, is
  // once on mount and once when the record lands.
  const key = JSON.stringify(spec ?? null)

  useEffect(() => {
    // Nothing to say is a valid answer: <RouteHead> calls this on every
    // navigation and gets `undefined` back for the dynamic routes, which
    // build their own head from the record they loaded. A spec carrying only
    // `jsonLd` is equally valid — that is how a page adds its structured
    // data on top of the title the route table already gave it.
    const resolved = JSON.parse(key)
    if (!resolved) return

    return applyHead(
      resolveHead(resolved, {
        origin: SITE_ORIGIN,
        // Undefined, not a noindex, off the production host: main.jsx has
        // already written `noindex, nofollow` before the first render, and
        // applyHead updates a tag that exists rather than adding a second
        // one — so writing anything here would overwrite it and quietly
        // invite the crawler into a staging copy.
        robots: isProductionHost() ? INDEXABLE : undefined,
      }),
    )
  }, [key])
}
