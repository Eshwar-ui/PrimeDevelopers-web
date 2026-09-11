/**
 * Organization markup, built from the footer's own content.
 *
 * The footer already carries the exact payload search engines want for a local
 * business — legal name, postal address, telephone, email, social profiles —
 * and it renders on every route. So the graph is assembled here from that same
 * data rather than hand-maintained in `index.html`, where it would drift out
 * of sync with the CMS the first time someone changed a phone number.
 *
 * `RealEstateAgent` rather than plain `Organization`: it is the LocalBusiness
 * subtype schema.org defines for a property firm, and it inherits everything
 * Organization carries. A visitor-facing type mismatch is worse than none —
 * so if the address has no locality, the node degrades to a bare Organization
 * instead of claiming to be a local business with no location.
 */

import { citiesFor } from './texas'

/** Drops empty strings, empty arrays and nullish values, recursively. */
function prune(value) {
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((v) => v !== undefined)
    return items.length ? items : undefined
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const pruned = prune(v)
      if (pruned !== undefined) out[k] = pruned
    }
    // A node that is nothing but its own @type carries no information.
    return Object.keys(out).filter((k) => !k.startsWith('@')).length ? out : undefined
  }
  if (typeof value === 'string') return value.trim() || undefined
  return value ?? undefined
}

/** Absolute URLs only — a relative href in JSON-LD is ignored. */
const absolute = (origin, href) => {
  if (!href || href === '#') return undefined
  if (/^(https?:)?\/\//i.test(href)) return href
  return href.startsWith('/') ? origin + href : undefined
}

export function organizationSchema({ footer, properties = [], cities = [], origin, logoUrl }) {
  const {
    email, phone, studio, legalName, socials = [],
    addressStreet, addressLocality, addressRegion, addressPostalCode, addressCountry,
    licenseLabel, licenseNumber,
  } = footer

  // Gated on the locality rather than on `prune` returning nothing, because
  // `prune` never can here: `addressCountry` defaults to 'US', so the object
  // always survives with a country in it. That published a PostalAddress whose
  // only claim was "somewhere in the United States", and — worse — made the
  // `description` fallback below think a real address existed, so the one
  // human-readable line we did have was dropped too. A locality is the least
  // that makes an address an address, and it is the same test `@type` uses to
  // decide whether this is a local business at all.
  const address = addressLocality
    ? prune({
        '@type': 'PostalAddress',
        streetAddress: addressStreet,
        addressLocality: addressLocality,
        addressRegion: addressRegion,
        postalCode: addressPostalCode,
        addressCountry: addressCountry,
      })
    : undefined

  // Only `#` placeholders and relative hrefs are dropped; a real profile URL
  // is what `sameAs` exists for and is the strongest entity signal here.
  const sameAs = socials.map((s) => absolute(origin, s.href)).filter(Boolean)

  // Every city the portfolio actually stands in. Claiming a whole state would
  // be a stretch; claiming the places we have built is not. `citiesFor` is the
  // same resolver the two maps use, so the markup cannot name a town the map
  // has no pin for.
  const areaServed = citiesFor(properties, cities).map((c) => ({
    '@type': 'City',
    name: c.label,
    address: { '@type': 'PostalAddress', addressRegion: 'TX', addressCountry: 'US' },
  }))

  return prune({
    '@context': 'https://schema.org',
    // Degrade to Organization when we cannot say where the business is: a
    // LocalBusiness with no locality is exactly the kind of incomplete markup
    // that gets an entity distrusted rather than ranked.
    '@type': addressLocality ? 'RealEstateAgent' : 'Organization',
    '@id': origin ? origin + '/#organization' : undefined,
    name: 'Prime Developers',
    legalName: legalName,
    url: origin,
    logo: logoUrl,
    image: logoUrl,
    email: email,
    telephone: phone,
    address: address,
    // The human-readable line, kept when there are no structured parts to
    // stand in for it.
    description: address ? undefined : studio,
    areaServed: areaServed,
    sameAs: sameAs,
    // Real-estate licences are what `hasCredential` is for; a bare number in
    // `identifier` says nothing about what it identifies.
    hasCredential: licenseNumber
      ? {
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: licenseLabel || 'License',
          identifier: licenseNumber,
        }
      : undefined,
    contactPoint: prune({
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: phone,
      email: email,
      areaServed: addressCountry,
      availableLanguage: 'en',
    }),
  })
}
