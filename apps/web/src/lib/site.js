// The public identity of the site, for anything written into <head>.
//
// Canonicals and structured data always name the production origin, whichever
// host is serving the build. theprimedeveloper.com still serves the 2023 site
// (see render.yaml); this app runs on the CloudFront and Firebase copies until
// the domain moves over, and those copies must not compete with it in search.

export const SITE_ORIGIN = (import.meta.env.VITE_SITE_ORIGIN || 'https://theprimedeveloper.com').replace(/\/$/, '')

// Singular, with "The". Never "Prime Developers" in copy or structured data.
export const BRAND_NAME = 'The Prime Developer'

const productionHost = new URL(SITE_ORIGIN).hostname

/** True only on the production domain — every other host is a staging copy. */
export const isProductionHost = () =>
  typeof window !== 'undefined' &&
  [productionHost, `www.${productionHost}`].includes(window.location.hostname)
