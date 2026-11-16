// Rio Ranch Commercial Lots (old site projectdetails/8) → /properties/rio-ranch-commercial-lots.
// Page copy, SEO fields, FAQs and lot records from the 2026-11 handoff
// (rio-ranch-claude-code-handoff, source doc https://claude.ai/artifact/2jJWc3HUpEKwMC7eYGJqSa).
// The 1 acre lots page has its own script: update-rio-ranch-1-acre-lots.mjs.
//
//   node scripts/update-rio-ranch-commercial-lots.mjs --preview   (no login; writes tmp/rio-ranch-commercial-lots.preview.json)
//   (with $env:PRIME_ADMIN_EMAIL and $env:PRIME_ADMIN_PASSWORD set) node scripts/update-rio-ranch-commercial-lots.mjs            (dry run)
//   (with $env:PRIME_ADMIN_EMAIL and $env:PRIME_ADMIN_PASSWORD set) node scripts/update-rio-ranch-commercial-lots.mjs --commit   (creates + publishes)
//   RIO_PHOTO_DIR=<dir> …   prepared photos under the names in FILES / GALLERY
//
// The record does not exist on the new site yet, so --commit creates it. The
// hero strip totals (buildings / sold / available) come from the lot records in
// scripts/data/rio-ranch-lots.json, as does the lot grid; prices sit behind
// SHOW_LOT_PRICES in scripts/lib/rio-ranch.mjs.
//
// Unconfirmed in the handoff, so left out rather than guessed:
//   TODO: lot count — Rate Master prices 6 lots; the old site said 15 total / 9 available.
//   TODO: lot-level availability — every lot defaults to "available" (status in the JSON).
//   TODO: prices not approved → SHOW_LOT_PRICES false: no price fields, price FAQ or "from $" stat.
//   TODO: the $12 / $14 / $16 per SF spread — ask whether it is frontage or corner, then set lots.note.
//   TODO: lat/long — geo.position and the Place `geo` / `hasMap` stay off until set.
//   TODO: street address and ZIP (from the LoopNet URL) — see ADDRESS.
//   TODO: "no commercial destinations for 3.5 miles" is unverified, so the overview
//         sentence and the "Little competition on the corridor" card are held back (COMPETITION_CONFIRMED).
//   TODO: TxDOT traffic counts (23,000+ on US 183, 34,000+ on SH 29) and their year/location —
//         the traffic card names the roads without figures until confirmed.
//   TODO: a sourced Liberty Hill population figure; Apple "within 25 miles" stays out.
//   TODO: permitted uses, utilities and deed restrictions.
//   TODO: drive times for every nearby place; Santa Rita Ranch "next to" the lots.
//   TODO: which of the six YouTube videos show the commercial lots.
//   TODO: flyer PDF (old "View Flyer" had no link) and a site plan with lot letters —
//         add to resourceLinks / lots.sitePlan once uploaded.
//   Photos come only from the client's Drive folder (prepare-rio-ranch-photos.mjs); run with
//   RIO_PHOTO_DIR=rio-ranch-web-photos. TODO: confirm each picked shot shows the commercial
//   lots; the Drive folder has no site plan.
//   TODO: /liberty-hill and /leander don't exist yet → CITY_PAGES_LIVE false, anchors are plain text.
//   TODO: /properties/rio-ranch hub — confirm with the client before building it.
import { applyContent, imageAltsFor } from './lib/property-content.mjs'
import {
  ADDRESS, MAP_QUERY, SHOW_LOT_PRICES, acreRange, allLots, faqList, lotRows, priced, totals, usd, videos,
} from './lib/rio-ranch.mjs'

const SLUG = 'rio-ranch-commercial-lots'
const KIND = 'commercial'
const PHOTO_DIR = process.env.RIO_PHOTO_DIR ?? ''
const CITY_PAGES_LIVE = false
const COMPETITION_CONFIRMED = false
const link = (text, href) => (CITY_PAGES_LIVE ? `[${text}](${href})` : text)

const [MIN, MAX] = acreRange(KIND)
const lots = allLots(KIND)
const prices = lots.map((l) => l.price)
const psf = [...new Set(lots.map((l) => l.pricePerSf))].sort((a, b) => a - b)

const FILES = {
  hero: ['rio-ranch-commercial-lots-liberty-hill.webp', 'Aerial view of Rio Ranch commercial lots on Ronald Reagan Blvd, Liberty Hill TX'],
  og: ['rio-ranch-commercial-lots-og-1200x630.jpg', 'Rio Ranch commercial lots for sale, Liberty Hill TX'],
  sitePlan: ['rio-ranch-commercial-lots-site-plan.png', 'Rio Ranch site plan showing commercial lots G1, G2, G5, H, C9 and C11'],
  landView: ['rio-ranch-commercial-land-view.webp', 'Rolling commercial land at Rio Ranch with views toward the San Gabriel River'],
}
// TODO: describe each shot once the photographs exist.
const GALLERY = [
  'Open commercial land and a new access road at Rio Ranch, Liberty Hill TX', // Photos2/RioRanch-45
  'Commercial land beside Ronald Reagan Blvd with a new road into Rio Ranch', // Photos2/RioRanch-50
  'Ronald Reagan Blvd with a new Rio Ranch road crossing it', // Photos2/RioRanch-58
  'Aerial of Rio Ranch between the San Gabriel River and Ronald Reagan Blvd', // Photos/RR_DRONE-48
  'Ronald Reagan Blvd and open land at Rio Ranch in evening light', // Photos2/RioRanch-57
].map((alt, i) => [`rio-ranch-commercial-gallery-${String(i + 1).padStart(2, '0')}.webp`, alt])
const files = {
  ...Object.fromEntries(Object.entries(FILES).map(([k, [name]]) => [k, name])),
  ...Object.fromEntries(GALLERY.map(([n]) => [n, n])),
}
const altFor = (key) => FILES[key]?.[1] ?? GALLERY.find(([n]) => n === key)?.[1] ?? ''

// Word for word in the visible accordion and the FAQPage markup — both read this list.
const FAQS = faqList([
  ['Where is Rio Ranch?', 'Rio Ranch is at Ronald Reagan Blvd and CR 258 in Liberty Hill, TX, in Williamson County, between State Highway 29 and US 183.'],
  ['How big are the commercial lots?', `Lots at Rio Ranch Commercial Lots range from ${MIN} to ${MAX} acres.`],
  ['How much do the commercial lots cost?', priced(
    `Asking prices run from ${usd(Math.min(...prices))} to ${usd(Math.max(...prices))} per lot, at $${psf[0]} to $${psf.at(-1)} per square foot of land. The lot table shows each lot.`,
    null,
  )],
  ['What can I build on the lots?', 'The lots are marketed for business use. Ask the team for the permitted uses, utilities and deed restrictions on the lot you want.'],
  ['What is nearby?', 'Rio Ranch is next to Santa Rita Ranch, with Liberty Hill and Leander retail and dining a short drive away. State Highway 29 and US 183 connect to Georgetown and Cedar Park.'],
  ['How do I visit the site?', 'Use the Enquire form or message the team on WhatsApp at +1 512-761-8025 to book a site visit.'],
])

const patch = (detail, img) => ({
  kicker: 'Land · Commercial Lots · Ronald Reagan Blvd & CR 258, Liberty Hill, TX',
  tagline: "Commercial land on Ronald Reagan Blvd, in the path of Liberty Hill's growth",
  specs: ['Liberty Hill, TX', `${lots.length} commercial lots`, `${MIN}–${MAX} acres`],
  ...(img.hero ? { covers: { ...detail.covers, detailHero: img.hero } } : {}),
  overview: {
    eyebrow: 'Commercial Land for Sale',
    heading: 'Commercial lots for sale in Liberty Hill on Ronald Reagan Blvd',
    body: [
      `Rio Ranch Commercial Lots are large parcels for sale on Ronald Reagan Blvd at CR 258 in Liberty Hill, TX, in Williamson County. Lots run from ${MIN} to ${MAX} acres, so there is room for a retail pad, a medical or office building, a service business or a larger development.`,
      [
        ...(COMPETITION_CONFIRMED
          ? ['Ronald Reagan Blvd has no commercial destinations for 3.5 miles where it meets Highway 29, which leaves a business here with little direct competition along the corridor.']
          : []),
        `The lots sit between State Highway 29 and US 183, next to Santa Rita Ranch, with new neighborhoods on every side. If you are comparing ${link('commercial land for sale in Liberty Hill', '/liberty-hill')} or ${link('commercial land for sale in Leander', '/leander')}, Rio Ranch is one of the few sites on this stretch of Ronald Reagan Blvd.`,
      ].join(' '),
      'Buying land lets you build to your own plan and keep the upside as the area fills in. The lots are marketed for business use; ask the team for permitted uses, utilities and deed restrictions on the lot you want.',
    ].join('\n\n'),
    stats: [
      { value: '{availableUnits}', label: 'Lots available' },
      { value: `${MIN}–${MAX}`, label: 'Acres per lot' },
      ...(SHOW_LOT_PRICES ? [{ value: `$${psf[0]}`, label: 'From, per SF of land' }] : []),
    ],
  },
  highlights: {
    heading: 'Commercial land with room to build',
    body: 'Rio Ranch Commercial Lots give businesses frontage on a growing corridor between State Highway 29 and US 183. Pick a lot by size and price, then build the use that fits: retail, medical, office or services.',
    bigStats: [],
    cards: [
      ...(COMPETITION_CONFIRMED
        ? [{ title: 'Little competition on the corridor', body: 'No commercial destinations on Ronald Reagan Blvd for 3.5 miles where it meets Highway 29.' }]
        : []),
      // TODO: add "More than 23,000 vehicles a day on US 183 and more than 34,000 on
      // State Highway 29." once the TxDOT year and count locations are confirmed.
      { title: 'Traffic on US 183 and SH 29', body: 'Between US 183 and State Highway 29, two of the main routes through Williamson County.' },
      { title: 'Growth around Liberty Hill', body: "Liberty Hill sits at the edge of the Austin metro's expansion, with new communities such as Santa Rita Ranch nearby." },
      { title: 'Pick your own use', body: `Lots from ${MIN} to ${MAX} acres for retail, office, medical or service businesses.` },
    ],
  },
  lots: {
    heading: priced('Available lots and pricing', 'Available lots'),
    intro: priced(
      'Choose a lot by size and price. Prices are asking prices for the land only; ask the team about availability, utilities and terms.',
      'Choose a lot by size. Ask the team about pricing, availability, utilities and terms.',
    ),
    // TODO: one line on why prices differ by lot ($12, $14, $16 per SF) once the client says.
    note: '',
    ...(img.sitePlan ? { sitePlan: { src: img.sitePlan, alt: FILES.sitePlan[1] } } : {}),
    rows: lotRows(KIND),
  },
  neighborhoods: {
    heading: 'Between State Highway 29 and US 183',
    intro: `Rio Ranch sits at Ronald Reagan Blvd and CR 258 in Liberty Hill, next to Santa Rita Ranch, with State Highway 29 and US 183 connecting to Georgetown, Leander and Cedar Park. Looking at ${link('commercial land for sale in Liberty Hill', '/liberty-hill')}? This is one of the larger sites on the corridor.`,
    mapQuery: MAP_QUERY,
    // TODO: confirm each place, and drive times before any minutes are added.
    items: [
      { name: 'Santa Rita Ranch', note: 'Master-planned community next to Rio Ranch.' },
      { name: 'Liberty Hill', note: 'Town centre, dining and services a short drive away.' },
      { name: 'Leander', note: 'H-E-B, retail and dining.' },
      { name: 'State Highway 29 and US 183', note: 'Regional routes to Georgetown and Cedar Park.' },
    ],
  },
  videosHeading: 'See Rio Ranch',
  videos: videos(['2sjYhrsTPsQ', 'VrdIDnzOZRw', 'cCWKEDQiX-I', 'qUrn0semSBI', '-8apzuWxxLU', '1v76jne-7xE']),
  faqHeading: 'Rio Ranch commercial lot FAQs',
  faqs: FAQS,
  // TODO: Flyer PDF once uploaded.
  resourceLinks: [
    { label: 'Map', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`, thumbnail: '' },
    { label: 'LoopNet', url: 'https://www.loopnet.com/Listing/3150-CR-258-Liberty-Hill-TX/25066498/', thumbnail: '' },
    ...(img.sitePlan ? [{ label: 'Site plan', url: img.sitePlan, thumbnail: '' }] : []),
  ],
  related: {
    label: 'More at Rio Ranch',
    links: [{ label: 'Rio Ranch 1 Acre Lots', href: '/properties/rio-ranch-1-acre-lots', note: 'Residential homesites from 1.00 to 2.35 acres.' }],
  },
  closing: {
    heading: 'Interested in a commercial lot at Rio Ranch?',
    body: 'Talk to The Prime Developer team about commercial lots in Liberty Hill, from pricing and availability to a site visit.',
  },
  seo: {
    ...detail.seo,
    title: 'Commercial Lots for Sale in Liberty Hill TX | Rio Ranch',
    description: `Rio Ranch offers commercial lots for sale in Liberty Hill, TX, from ${MIN} to ${MAX} acres on Ronald Reagan Blvd. Enquire today.`,
    ogTitle: 'Rio Ranch Commercial Lots | Liberty Hill, TX',
    ogDescription: `Commercial lots from ${MIN} to ${MAX} acres on Ronald Reagan Blvd in Liberty Hill, TX.`,
    twitterDescription: 'Commercial land for sale on Ronald Reagan Blvd, Liberty Hill.',
    ...(img.og ? { ogImage: img.og } : {}),
    ogImageAlt: FILES.hero[1],
    heroAlt: FILES.hero[1],
    geoRegion: 'US-TX',
    geoPlacename: 'Liberty Hill',
    placeDescription: `Commercial lots from ${MIN} to ${MAX} acres for sale on Ronald Reagan Blvd at CR 258 in Liberty Hill, TX.`,
    containedIn: 'Williamson County, TX',
  },
  imageAlts: imageAltsFor(detail, img, altFor),
})

await applyContent({
  slug: SLUG,
  folder: `projects/${SLUG}`,
  photoDir: PHOTO_DIR,
  files,
  galleryOrder: ['landView', ...GALLERY.map(([n]) => n)],
  patch,
  create: { name: 'Rio Ranch Commercial Lots', address: ADDRESS, category: 'Open Plots', published: true },
  top: (img) => ({ ...totals(KIND), ...(img.hero ? { image: img.hero } : {}) }),
})
