import { useEffect } from 'react'
import { BRAND_NAME, SITE_ORIGIN, isProductionHost } from '../lib/site'
import { faqSchema, propertySchema } from '../lib/structuredData'
import { coverImage } from '../lib/covers'

// JSON in a <script> body ends at the first "</script>" it contains.
const serialise = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

/**
 * Title, description, canonical, Open Graph / X cards, geo tags and JSON-LD
 * for a property page, from the record's `detail.seo` with fallbacks for a
 * property that has none.
 *
 * The site has no per-route head management (see NewsPostPage), so each tag
 * is written directly and put back on the way out — a canonical left behind
 * would point whichever page the visitor opens next at this property.
 *
 * Robots is only raised to `index` on the production host. Everywhere else
 * main.jsx has already written `noindex, nofollow`, and this leaves it alone.
 */
export function usePropertyHead(property) {
  useEffect(() => {
    if (!property) return
    const d = property.detail ?? {}
    const seo = d.seo ?? {}
    const url = `${SITE_ORIGIN}/properties/${property.slug}`
    const title = seo.title || `${property.name} | ${BRAND_NAME}`
    const description = seo.description || d.tagline || ''
    const ogTitle = seo.ogTitle || title
    const ogDescription = seo.ogDescription || description
    // A purpose-made 1200×630 card when there is one, the hero until then —
    // and only the card's dimensions are known, so only it states them.
    const image = seo.ogImage || coverImage(property, 'detailHero') || property.image
    const imageAlt = seo.ogImageAlt || seo.heroAlt || property.name

    const undo = []
    const previousTitle = document.title
    document.title = title
    undo.push(() => {
      document.title = previousTitle
    })

    const put = (tag, keyAttr, key, valueAttr, value) => {
      if (value == null || value === '') return
      let el = document.head.querySelector(`${tag}[${keyAttr}="${key}"]`)
      if (el) {
        const previous = el.getAttribute(valueAttr)
        el.setAttribute(valueAttr, value)
        undo.push(() => (previous == null ? el.removeAttribute(valueAttr) : el.setAttribute(valueAttr, previous)))
      } else {
        el = document.createElement(tag)
        el.setAttribute(keyAttr, key)
        el.setAttribute(valueAttr, value)
        document.head.appendChild(el)
        undo.push(() => el.remove())
      }
    }
    const meta = (key, value) => put('meta', key.startsWith('og:') ? 'property' : 'name', key, 'content', value)

    meta('description', description)
    if (isProductionHost()) meta('robots', 'index, follow, max-image-preview:large')
    put('link', 'rel', 'canonical', 'href', url)

    meta('og:type', 'website')
    meta('og:site_name', BRAND_NAME)
    meta('og:locale', 'en_US')
    meta('og:title', ogTitle)
    meta('og:description', ogDescription)
    meta('og:url', url)
    meta('og:image', image)
    if (seo.ogImage) {
      meta('og:image:width', '1200')
      meta('og:image:height', '630')
    }
    meta('og:image:alt', imageAlt)
    meta('twitter:card', 'summary_large_image')
    meta('twitter:title', ogTitle)
    meta('twitter:description', seo.twitterDescription || ogDescription)
    meta('twitter:image', image)

    meta('geo.region', seo.geoRegion)
    meta('geo.placename', seo.geoPlacename)
    if (Number.isFinite(seo.latitude) && Number.isFinite(seo.longitude)) {
      meta('geo.position', `${seo.latitude};${seo.longitude}`)
    }

    for (const graph of [
      propertySchema({ property, origin: SITE_ORIGIN, url, title, description }),
      faqSchema(d.faqs),
    ]) {
      if (!graph) continue
      const ld = document.createElement('script')
      ld.type = 'application/ld+json'
      ld.textContent = serialise(graph)
      document.head.appendChild(ld)
      undo.push(() => ld.remove())
    }

    return () => undo.reverse().forEach((fn) => fn())
  }, [property])
}
