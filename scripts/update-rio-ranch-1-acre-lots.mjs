// Rio Ranch 1 Acre Lots (old site projectdetails/9) → /properties/rio-ranch-1-acre-lots.
// Page copy, SEO fields, FAQs and lot records from the 2026-11 handoff
// (rio-ranch-claude-code-handoff, source doc https://claude.ai/artifact/2jJWc3HUpEKwMC7eYGJqSa).
// The commercial lots page has its own script: update-rio-ranch-commercial-lots.mjs.
//
//   node scripts/update-rio-ranch-1-acre-lots.mjs --preview   (no login; writes tmp/rio-ranch-1-acre-lots.preview.json)
//   (with $env:PRIME_ADMIN_EMAIL and $env:PRIME_ADMIN_PASSWORD set) node scripts/update-rio-ranch-1-acre-lots.mjs            (dry run)
//   (with $env:PRIME_ADMIN_EMAIL and $env:PRIME_ADMIN_PASSWORD set) node scripts/update-rio-ranch-1-acre-lots.mjs --commit
//   RIO_PHOTO_DIR=<dir> …   prepared photos under the names in FILES / GALLERY
//
// Merges into the live record. Sets the hero strip totals (buildings / sold /
// available) from the lot records in scripts/data/rio-ranch-lots.json — the
// record's 55 / 36 / 19 came from the old site and match no source. Untouched:
// address, socials, and the gallery until photographs are on hand.
//
// Unconfirmed in the handoff, so left out rather than guessed:
//   TODO: lot count — Rate Master has 18; the old stats block said 55 total / 19 available.
//   TODO: lot-level availability — every lot defaults to "available" (status in the JSON).
//   TODO: prices not approved → SHOW_LOT_PRICES false: no price field, price FAQ or "from $" stat.
//   TODO: builder rules ("Choose your builder" in the description, a card and the copy) — if
//         buyers are tied to a builder, change the description to "Build your own home."
//   TODO: utilities, HOA and deed restrictions; Liberty Hill ISD (from the old page's text).
//   TODO: North San Gabriel River trail access is unverified, so the trails sentence and the
//         nearby-areas item are held back (TRAILS_CONFIRMED).
//   TODO: traffic counts (old page: 23,000+ a day on US 183) — the card names the routes only.
//   TODO: a sourced population figure; "ready to build" and "$165,703 household income" stay out.
//   TODO: lat/long — geo.position and the Place `geo` / `hasMap` stay off until set.
//   TODO: address and ZIP — see ADDRESS (both listings use 3150 CR 258).
//   TODO: drive times; store names (H-E-B, Walmart, Lowe's).
//   TODO: confirm the four YouTube videos show the acre lots.
//   TODO: flyer PDF and a site plan with lot letters — add once uploaded.
//   Photos come only from the client's Drive folder (prepare-rio-ranch-photos.mjs). Run with
//   RIO_PHOTO_DIR=rio-ranch-web-photos: they replace the record's gallery and listing image,
//   which are site-wide hero slides of another (retail) property.
//   TODO: confirm each picked shot shows the acre lots; the Drive folder has no site plan.
//   TODO: /liberty-hill doesn't exist yet → CITY_PAGES_LIVE false, anchors are plain text.
import { applyContent, imageAltsFor } from './lib/property-content.mjs'
import {
  MAP_QUERY, SHOW_LOT_PRICES, acreRange, allLots, faqList, lotRows, priced, totals, usd, videos,
} from './lib/rio-ranch.mjs'

const SLUG = 'rio-ranch-1-acre-lots'
const KIND = 'acre'
const PHOTO_DIR = process.env.RIO_PHOTO_DIR ?? ''
const CITY_PAGES_LIVE = false
const TRAILS_CONFIRMED = false
const link = (text, href) => (CITY_PAGES_LIVE ? `[${text}](${href})` : text)

const [MIN, MAX] = acreRange(KIND)
const lots = allLots(KIND)
const prices = lots.map((l) => l.price)
const oneAcre = lots.filter((l) => l.acres === 1).length
const COUNT = lots.length
const WORDS = { 8: 'eight' }
const cap = (s) => s[0].toUpperCase() + s.slice(1)

const FILES = {
  hero: ['rio-ranch-1-acre-lots-liberty-hill.webp', 'One-acre homesites at Rio Ranch on Ronald Reagan Blvd, Liberty Hill TX'],
  og: ['rio-ranch-1-acre-lots-og-1200x630.jpg', 'Rio Ranch 1 acre lots for sale, Liberty Hill TX'],
  sitePlan: ['rio-ranch-1-acre-lots-site-plan.png', `Rio Ranch site plan showing the ${COUNT} residential lots`],
  lotView: ['rio-ranch-acre-lot-view.webp', 'One-acre lot at Rio Ranch with open views and natural landscaping'],
}
// From the client's Drive folder via prepare-rio-ranch-photos.mjs (source in the comment).
const GALLERY = [
  'Curving streets through mature oak trees at Rio Ranch, Liberty Hill TX', // Photos2/RioRanch-18
  'New street lined with oak trees at Rio Ranch', // Photos2/RioRanch-26
  'Street beside wooded homesites at Rio Ranch', // Photos2/RioRanch-30
  'Cul-de-sac under mature oak trees at Rio Ranch', // Photos2/RioRanch-2
  'Aerial of Rio Ranch and the river bend beside it, Liberty Hill TX', // Photos/RR_DRONE-31
].map((alt, i) => [`rio-ranch-1-acre-lots-gallery-${String(i + 1).padStart(2, '0')}.webp`, alt])
const files = {
  ...Object.fromEntries(Object.entries(FILES).map(([k, [name]]) => [k, name])),
  ...Object.fromEntries(GALLERY.map(([n]) => [n, n])),
}
const altFor = (key) => FILES[key]?.[1] ?? GALLERY.find(([n]) => n === key)?.[1] ?? ''

// Word for word in the visible accordion and the FAQPage markup — both read this list.
const FAQS = faqList([
  ['Where is Rio Ranch?', 'Rio Ranch is at Ronald Reagan Blvd and CR 258 in Liberty Hill, TX, in Williamson County, next to Santa Rita Ranch.'],
  ['How big are the lots?', `The ${COUNT} residential lots range from ${MIN} to ${MAX} acres, and ${WORDS[oneAcre] ?? oneAcre} of them are exactly one acre.`],
  ['How much do the lots cost?', priced(
    `Asking prices run from ${usd(Math.min(...prices))} to ${usd(Math.max(...prices))} per lot, at about $6.89 per square foot of land. The lot table shows each lot.`,
    null,
  )],
  ['What can I build on the lots?', 'The lots are for building your own home. Ask the team about builder options, utilities and any deed restrictions on the lot you want.'],
  ['Which school district are the lots in?', 'Liberty Hill ISD.'],
  ['How do I visit the site?', 'Use the Enquire form or message the team on WhatsApp at +1 512-761-8025 to book a site visit.'],
])

const patch = (detail, img) => ({
  kicker: 'Land · 1 Acre Lots · Ronald Reagan Blvd & CR 258, Liberty Hill, TX',
  tagline: 'Acre-plus homesites in Liberty Hill, next to Santa Rita Ranch',
  specs: ['Liberty Hill, TX', `${COUNT} homesites`, `${MIN}–${MAX} acres`],
  ...(img.hero ? { covers: { ...detail.covers, detailHero: img.hero } } : {}),
  overview: {
    eyebrow: '1 Acre Lots for Sale',
    heading: '1 acre lots for sale in Liberty Hill, TX',
    body: [
      `Rio Ranch has ${COUNT} residential lots for sale at Ronald Reagan Blvd and CR 258 in Liberty Hill, TX, in Williamson County. Lots run from ${MIN} to ${MAX} acres, with most at an acre or just over, so there is space for a custom home, a yard, a workshop or a pool.`,
      `The lots sit next to Santa Rita Ranch, between State Highway 29 and US 183, with Liberty Hill and Leander shopping and dining a short drive away. They have scenic views and natural landscaping${TRAILS_CONFIRMED ? ', and the North San Gabriel River trails are close' : ''}.`,
      `Buy a lot, pick your own builder and design the home you want. If you are looking at ${link('land for sale in Liberty Hill', '/liberty-hill')}, or want acreage lots in Liberty Hill, TX with room to build, Rio Ranch gives you a choice of lot sizes and prices in one community.`,
    ].join('\n\n'),
    stats: [
      { value: '{totalUnits}', label: 'Lots' },
      { value: `${MIN}–${MAX}`, label: 'Acres per lot' },
      ...(SHOW_LOT_PRICES ? [{ value: usd(Math.min(...prices)), label: 'From, per lot' }] : []),
    ],
  },
  highlights: {
    heading: 'Acreage lots to build your own home',
    body: `Each Rio Ranch lot gives you at least an acre in a growing part of Williamson County. Compare lot sizes${priced(' and prices', '')} below, then build the home you want, with the builder you choose.`,
    bigStats: [],
    cards: [
      { title: 'Room to build', body: `Lots from ${MIN} to ${MAX} acres, with most near an acre.` },
      // TODO: add the traffic count once confirmed (old page: 23,000+ vehicles a day on US 183).
      { title: 'Traffic and access', body: 'Routes on State Highway 29, US 183 and Ronald Reagan Blvd.' },
      { title: 'Growing area', body: "Liberty Hill is at the edge of the Austin metro's expansion, beside Santa Rita Ranch." },
      { title: 'Choose your builder', body: 'Buy the land, then build with the builder you pick.' },
    ],
  },
  lots: {
    heading: priced('Available lots and pricing', 'Available lots'),
    intro: priced(
      `Choose a lot by size and price. Prices are asking prices for the land only; ask the team about availability, utilities and terms. ${cap(WORDS[oneAcre] ?? String(oneAcre))} lots are exactly one acre at ${usd(300000)}.`,
      'Choose a lot by size. Ask the team about pricing, availability, utilities and terms.',
    ),
    ...(img.sitePlan ? { sitePlan: { src: img.sitePlan, alt: FILES.sitePlan[1] } } : {}),
    rows: lotRows(KIND),
  },
  neighborhoods: {
    heading: 'Next to Santa Rita Ranch',
    intro: `Rio Ranch sits at Ronald Reagan Blvd and CR 258 in Liberty Hill, beside Santa Rita Ranch, with State Highway 29 and US 183 connecting to Leander, Georgetown and Cedar Park. Looking for ${link('land for sale in Liberty Hill', '/liberty-hill')}? Rio Ranch gives you acreage with the town's shops and dining a short drive away.`,
    mapQuery: MAP_QUERY,
    // TODO: confirm each place, and drive times before any minutes are added.
    items: [
      { name: 'Santa Rita Ranch', note: 'Master-planned community next to Rio Ranch.' },
      { name: "H-E-B, Walmart and Lowe's", note: 'Everyday shopping in Leander and Liberty Hill.' },
      ...(TRAILS_CONFIRMED ? [{ name: 'North San Gabriel River', note: 'Nature trails near the lots.' }] : []),
      { name: 'Liberty Hill ISD', note: 'School district for the lots.' },
    ],
  },
  videosHeading: 'See Rio Ranch',
  videos: videos(['VrdIDnzOZRw', 'cCWKEDQiX-I', 'qUrn0semSBI', '-8apzuWxxLU']),
  faqHeading: 'Rio Ranch 1 acre lot FAQs',
  faqs: FAQS,
  // TODO: Flyer PDF once uploaded.
  resourceLinks: [
    { label: 'Map', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`, thumbnail: '' },
    { label: 'LoopNet', url: 'https://www.loopnet.com/Listing/3150-County-Road-258-Liberty-Hill-TX/37562259/', thumbnail: '' },
    ...(img.sitePlan ? [{ label: 'Site plan', url: img.sitePlan, thumbnail: '' }] : []),
  ],
  related: {
    label: 'More at Rio Ranch',
    links: [{ label: 'Rio Ranch Commercial Lots', href: '/properties/rio-ranch-commercial-lots', note: 'Commercial land from 1.27 to 7.39 acres on Ronald Reagan Blvd.' }],
  },
  closing: {
    heading: 'Ready to choose your acre at Rio Ranch?',
    body: 'Talk to The Prime Developer team about 1 acre lots in Liberty Hill, from lot sizes and pricing to a site visit.',
  },
  seo: {
    ...detail.seo,
    title: '1 Acre Lots for Sale in Liberty Hill TX | Rio Ranch',
    description: `Rio Ranch offers 1 acre lots for sale in Liberty Hill, TX, from ${MIN} to ${MAX} acres. Choose your builder and build your own home. Enquire today.`,
    ogTitle: 'Rio Ranch 1 Acre Lots | Liberty Hill, TX',
    ogDescription: `1 acre lots from ${MIN} to ${MAX} acres for sale in Liberty Hill, TX. Build your own home.`,
    twitterDescription: 'Acre-plus homesites for sale in Liberty Hill, TX.',
    ...(img.og ? { ogImage: img.og } : {}),
    ogImageAlt: 'One-acre homesites at Rio Ranch, Liberty Hill TX',
    heroAlt: FILES.hero[1],
    geoRegion: 'US-TX',
    geoPlacename: 'Liberty Hill',
    placeDescription: `Residential lots from ${MIN} to ${MAX} acres for sale at Ronald Reagan Blvd and CR 258 in Liberty Hill, TX.`,
    containedIn: 'Williamson County, TX',
  },
  imageAlts: imageAltsFor(detail, img, altFor),
})

await applyContent({
  slug: SLUG,
  folder: `projects/${SLUG}`,
  photoDir: PHOTO_DIR,
  files,
  galleryOrder: ['lotView', ...GALLERY.map(([n]) => n)],
  patch,
  top: (img) => ({ ...totals(KIND), ...(img.hero ? { image: img.hero } : {}) }),
})
