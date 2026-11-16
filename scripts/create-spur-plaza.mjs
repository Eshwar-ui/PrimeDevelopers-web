// Spur Plaza: a plain-text "coming soon" page — hero, closing CTA and footer,
// nothing else. The property was missing from the new site (website audit
// 2026-10-27). The client wants only the address, the basics and a coming-soon
// note: no photos, units, pricing, FAQs, floor plans, overview or location bands
// (the page renders a band only when its content is set, so leaving them out
// removes them).
//
// Source: the old site (theprimedeveloper.com, projectdetails/4) for the address
// and the description.
//
//   node scripts/create-spur-plaza.mjs --preview      (no login; writes tmp/spur-plaza.preview.json)
//   node scripts/create-spur-plaza.mjs                (dry run, needs PRIME_ADMIN_EMAIL / PRIME_ADMIN_PASSWORD)
//   node scripts/create-spur-plaza.mjs --commit       (creates the record and publishes it)
//
// detail.status = 'coming-soon' makes the hero panel and listing cards read
// "Coming soon" rather than "Fully reserved" for a record with no units.
//
// Left out, not guessed:
//   TODO: unit counts. The old site listed Buildings 1, 2, 4 and 6 (14 / 16 / 15 / 9 units),
//         but every building there carried POW Lewisville's 185,310 SF area and its
//         neighbourhood list was Lewisville's, so none of it is reliable.
//   TODO: photos, lat/long, project size, delivery date, prices — add when released.
import { applyContent } from './lib/property-content.mjs'

const SLUG = 'spur-plaza'
const ADDRESS = '2085 Highway 183, Leander, TX 78641'

const patch = (detail) => ({
  status: 'coming-soon',
  kicker: `Retail & Office · ${ADDRESS}`,
  tagline: 'Coming soon: two-storey retail and office condos on Highway 183 in Leander, with storefronts below and offices above. Enquire to hear first when units are released.',
  // Listing card figures, in place of unit counts the record doesn't have.
  specs: ['Leander, TX', 'Retail & office', 'Coming soon'],
  closing: {
    body: 'Spur Plaza is coming soon. Talk to The Prime Developer team to hear first when units, sizes and prices are released.',
  },
  seo: {
    ...detail.seo,
    title: 'Spur Plaza | Retail & Office Condos in Leander, TX | The Prime Developer',
    description: 'Spur Plaza is a coming-soon retail and office condo development at 2085 Highway 183, Leander, TX, from The Prime Developer. Enquire to hear first.',
    ogTitle: 'Spur Plaza | Coming Soon to Leander, TX',
    ogDescription: 'Two-storey retail and office condos coming soon on Highway 183 in Leander, TX.',
    twitterDescription: 'Retail and office condos coming soon on Highway 183, Leander.',
    geoRegion: 'US-TX',
    geoPlacename: 'Leander',
    placeDescription: 'Upcoming two-storey retail and office condo development on Highway 183 in Leander, TX.',
  },
})

await applyContent({
  slug: SLUG,
  folder: `projects/${SLUG}`,
  photoDir: '',
  files: {},
  galleryOrder: [],
  patch,
  create: { name: 'Spur Plaza', address: ADDRESS, category: 'Retail', published: true },
  top: { buildings: 0, sold: 0, available: 0 },
})
