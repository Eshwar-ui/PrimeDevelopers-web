// Give POW Lewisville Phase II its own record content. Until now the record was
// a copy of Phase I (Buildings 4–5, 77 units, 14 available, Phase I copy and
// photos) rendered under its own canonical — the staging bug in the 2026-11
// handoff (pow-lewisville-claude-code-handoff, source doc
// https://claude.ai/artifact/SyX9WJEaBDmJPJJs6EHJz7).
//
//   node scripts/prepare-pow-lewisville-photos.mjs            (once: Drive → WebP)
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-pow-lewisville-phase-ii-content.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-pow-lewisville-phase-ii-content.mjs --commit
//   … --noindex     keep the page out of search (seo.noindex) while the TODOs below are open
//
// Unlike Phase I this also sets the headline totals (22 units, 0 sold, 22
// available) and replaces floorPlans.buildings with Buildings 6 and 7 and one
// unit record per Rate Master unit: the copied Buildings 4–5 are Phase I's.
// The units table below is generated from the same UNITS list, so the two
// cannot disagree.
//
// House rule: no heading on either phase page says "Phase I" / "Phase II".
// The FAQ questions render as H3s, so "Where is POW Lewisville Phase II?"
// from the handoff reads "Where are the new units?" here (and in FAQPage).
//
// Unconfirmed in the handoff, so left out rather than guessed:
//   TODO: ZIP — 75067 (record) or 75056; kicker leaves it off.
//   TODO: lat/long — geo.position, Place `geo` and `hasMap` stay off until set.
//   TODO: Phase II size — 107,821 SF (old site) vs 108,717 SF (sum of Rate Master units);
//         overview says "~108,000", building tabs carry the Rate Master sums.
//   TODO: door (14 × 14 ft) and clear-height (20 / 25 ft) specs come from the Building 6
//         LoopNet listing — confirm they apply to Building 7.
//   TODO: Building 7 max mezzanine sizes.
//   TODO: confirm with the client that the construction photos (yellow sheathing,
//         light-blue roof) show Buildings 6–7; request finished exterior and interior
//         photos (14 ft doors, 25 ft clear height) when complete.
//   TODO: unit photos — no LEW-Unit-6xx / 7xx folders; every unit shows the Phase II
//         construction photos (All Buildings LEW-43, LEW-271) until real ones exist.
//   TODO: floor plans PLANS_Lewisville_B6/B7.jpg are not in the Drive folder.
//   TODO: confirm Kpua3d5RKLM and h-nsWbta5Wc show Lewisville.
//   TODO: flyer PDF (broken on old site); Crexi only if listed.
//   TODO: Phase I tenant names / logos for "Businesses already open next door".
//   TODO: /lewisville doesn't exist yet, so those anchors are plain text; /investors doesn't
//         exist, so it points at /cap-properties.
import { applyContent, defaultPhotoDir, imageAltsFor } from './lib/property-content.mjs'
import { MAP_QUERY, neighborhoods } from './lib/pow-lewisville.mjs'

const NOINDEX = process.argv.includes('--noindex')
const SLUG = 'pow-lewisville-phase-ii'

// Rate Master, "Lewisville Flex Spaces": [units, building, size SF, sale price, $/SF, max mezzanine SF].
// Lease is $27/SF/yr base + $6 NNN on every row.
const RATE_MASTER = [
  [['604', '606'], 6, 3375, 995625, 295, 1125],
  [['703', '704', '705', '706', '707', '708', '709', '710'], 7, 3604, 1027140, 285, null],
  [['603', '605', '607', '609'], 6, 3957, 1167315, 295, 1319],
  [['701'], 7, 6159, 1755315, 285, null],
  [['702'], 7, 6289, 1792365, 285, null],
  [['711', '712'], 7, 6290, 1855550, 295, null],
  [['601', '611'], 6, 6923, 2042285, 295, 2303],
  [['608'], 6, 9151, 2699545, 295, 3047],
  [['602'], 6, 9282, 2738190, 295, 3090],
]
const LEASE = 27
const NNN = 6
const n = (v) => v.toLocaleString('en-US')
const usd = (v) => `$${n(v)}`

// One record per unit — the unit data the building tabs and unit cards read.
const UNITS = RATE_MASTER.flatMap(([labels, building, size, price, psf, mezz]) =>
  labels.map((label) => ({ label, building, size, price, psf, mezz })))

const unitRecord = (u, images) => ({
  label: u.label,
  status: 'available',
  tenant: '',
  tenantUrl: '',
  tenantCategory: '',
  size: String(u.size),
  floor: '',
  frontage: '',
  description: `Shell unit with a 14 × 14 ft overhead door${u.mezz ? ` and room for a mezzanine of up to ${n(u.mezz)} SF` : ''}. Leases from $${LEASE}/SF/yr plus $${NNN} NNN.`,
  rate: usd(u.price),
  x: null,
  y: null,
  logo: '',
  images,
  facingRoad: '',
})

const building = (number, img) => {
  const units = UNITS.filter((u) => u.building === number)
  return {
    number,
    building: `Building ${number}`,
    // Sum of the Rate Master unit sizes. TODO: confirm (see Phase II size above).
    area: n(units.reduce((t, u) => t + u.size, 0)),
    units: units.length,
    available: units.length,
    parking: 'Yes',
    // No unit photos exist yet (no LEW-Unit-6xx / 7xx folders in Drive), so every
    // unit shows the Phase II building under construction.
    // TODO: real unit photos once Buildings 6–7 are finished.
    unitList: units.map((u) => unitRecord(u, UNIT_IMAGES.map((k) => img[k]).filter(Boolean))),
  }
}

// The units table, one row per Rate Master line, from the same list.
const tableRows = RATE_MASTER.map(([labels, b, size, price, psf, mezz]) => ({
  unit: labels.join(', '),
  building: String(b),
  size: n(size),
  salePrice: usd(price),
  salePsf: `$${psf}`,
  lease: `$${LEASE}`,
  nnn: `$${NNN}`,
  annualRent: usd(size * (LEASE + NNN)),
  mezzanine: mezz ? n(mezz) : '', // TODO: Building 7 mezzanine sizes — shown as "—".
}))

const FILES = {
  hero: ['pow-lewisville-phase-ii-aerial.webp', 'Aerial of POW Lewisville with the new Phase II building on State Hwy 121, Lewisville TX'],
  og: ['pow-lewisville-phase-ii-og-1200x630.jpg', 'POW Lewisville Phase II flex warehouse units, Lewisville TX'],
  construction: ['pow-lewisville-phase-ii-building-construction.webp', 'POW Lewisville Phase II flex warehouse building under construction'],
  site: ['pow-lewisville-phase-ii-site-aerial.webp', 'Aerial of the POW Lewisville Phase II building and site'],
  // "Businesses already open next door": Phase I's storefronts, re-uploaded under this record.
  tenant1: ['pow-lewisville-tenant-1.webp', 'Business storefront at POW Lewisville'],
  tenant2: ['pow-lewisville-tenant-2.webp', 'Business storefront at POW Lewisville'],
  tenant3: ['pow-lewisville-tenant-3.webp', 'Business storefront at POW Lewisville'],
  storefronts: ['pow-lewisville-storefront-units.webp', 'Row of storefront flex units with tenant signage and overhead doors at POW Lewisville'],
}
const GALLERY = [
  'Front of the POW Lewisville Phase II building under construction, with storefront openings', // All Buildings/LEW-271
  'POW Lewisville Phase II building under construction, seen across the parking lot', // LEW-272
  'Long elevation of the POW Lewisville Phase II building under construction', // LEW-10
  'POW Lewisville Phase II building under construction behind site fencing', // LEW-5
  'Aerial of POW Lewisville with the Phase II building under construction', // Drone Photos/LEW-8
  'Aerial of POW Lewisville beside State Hwy 121', // Drone Photos/LEW-9
].map((alt, i) => [`pow-lewisville-phase-ii-gallery-${String(i + 1).padStart(2, '0')}.webp`, alt])

// Word for word in the visible FAQ and the FAQPage markup — both read this list.
const FAQS = [
  ['Where are the new units?', '2601 E State Hwy 121 at Leora Ln, Lewisville, TX, in Buildings 6 and 7 beside POW Lewisville Phase I.'],
  ['How much do the units cost?', 'Units sell from $995,625 (3,375 SF) to $2,738,190 (9,282 SF), at $285 to $295 per SF. Leases start at $27/SF/yr plus $6 NNN.'],
  // TODO: from the Building 6 LoopNet listing — confirm for Building 7.
  ['What size are the overhead doors?', 'Each unit has a 14 ft wide × 14 ft high overhead door.'],
  // TODO: from the Building 6 LoopNet listing — confirm for Building 7.
  ['What is the clear height?', '20 ft at the entry and 25 ft at the rear of each unit.'],
  ['Can I add a mezzanine?', "Yes, up to 50% of the unit's floor area."],
  ['What can I use the space for?', 'Zoning is light industrial: flex office, showroom and warehouse. Typical users include contractors, car services, gyms, distributors and e-commerce sellers.'],
  ['How do I book a tour?', 'Use the Enquire form or message the team on WhatsApp at +1 512-761-8025.'],
].map(([question, answer]) => ({ question, answer }))

const patch = (detail, img) => ({
  kicker: 'Flex · Office Warehouse · 2601 E State Hwy 121, Lewisville, TX',
  tagline: 'New office warehouse and flex units for sale on State Hwy 121, from 3,375 to 9,282 SF',
  ...(img.hero ? { covers: { ...detail.covers, detailHero: img.hero } } : {}),
  overview: {
    ...detail.overview,
    eyebrow: 'Prime Office Warehouses Lewisville',
    heading: 'New flex warehouse units for sale in Lewisville, with 14 ft doors and 25 ft clear height',
    body: [
      'POW Lewisville Phase II adds two new buildings, 6 and 7, to the Prime Office Warehouses project at Leora Ln and E State Hwy 121 in Lewisville, TX. Its 22 units are delivered as shells, ready for you to fit out as office, showroom or warehouse.',
      // TODO: /lewisville doesn't exist yet — restore as [flex warehouse for sale in DFW](/lewisville).
      "Each unit has a 14 × 14 ft overhead door, 25 ft clear height at the rear and room for a mezzanine of up to 50% of the floor. Units sell from $995,625 or lease from $33/SF/yr all-in. If you're looking for a flex warehouse for sale in DFW, these are some of the newest units on the SH 121 corridor.",
      'Phase II sits beside the established [POW Lewisville Phase I](/properties/pow-lewisville), so new owners join a working business community from day one.',
    ].join('\n\n'),
    flyer: '', // was "#": TODO wire once the PDF is uploaded.
    stats: [
      { value: '~108,000', label: 'SF Phase II size' },
      { value: '{totalUnits}', label: 'Total units' },
      { value: '{availableUnits}', label: 'Available units' },
    ],
  },
  highlights: {
    ...detail.highlights,
    heading: 'Built for workshops, showrooms, storage and growing teams',
    body: 'Zoning is light industrial, covering flex office, showroom and warehouse use. The tall shells suit businesses that need racking, vehicles or equipment inside: contractors, car services, gyms, distributors and e-commerce sellers.',
    bigStats: [
      { value: '25 ft', label: 'Rear clear height' },
      { value: '14 × 14 ft', label: 'Overhead doors' },
    ],
    cards: [
      { title: '14 ft overhead doors', body: 'A 14 ft wide × 14 ft high overhead door on every unit for vans, trucks and large deliveries.' },
      { title: '25 ft clear height', body: '20 ft clear at the entry rising to 25 ft at the rear, room for tall racking.' },
      { title: 'Mezzanine allowance', body: 'Add a mezzanine of up to 50% of the unit, up to 3,090 SF on the largest units.' },
      { title: '24/7 access', body: 'Owners and staff can get in any time, with signage on the SH 121 frontage.' },
    ],
  },
  floorPlans: {
    ...detail.floorPlans,
    intro: {
      heading: 'Site overview and floor plans',
      // TODO: /lewisville doesn't exist yet — restore the link on "office warehouse for sale in Lewisville".
      body: 'Phase II has two buildings of shell units. Select a building to see its plan, then compare units below. Shopping for office warehouse for sale in Lewisville? Every Phase II unit is available today.',
    },
    buildings: [building(6, img), building(7, img)],
  },
  pricing: {
    units: {
      heading: 'Units for sale or lease',
      // TODO: /lewisville doesn't exist yet — restore the link on "industrial condo for sale near Dallas".
      intro: [
        "Units start at $995,625 ($295/SF) to buy, or $33/SF/yr all-in to lease ($27 base + $6 NNN). Building 7's standard units are priced lower at $285/SF. Like an industrial condo for sale near Dallas, you own the unit and build equity instead of paying rent.",
        'No Phase II units are leased yet, so there are no cap rate listings here. See our other [investment properties](/cap-properties).',
      ].join('\n\n'),
      rows: tableRows,
    },
  },
  location: {
    ...detail.location,
    eyebrow: 'Zoning Opportunities',
    heading: 'Light industrial zoning on the SH 121 frontage',
    sub: '',
    body: [
      'Phase II sits on the State Hwy 121 frontage road at Leora Ln, with quick access to I-35E, the Sam Rayburn Tollway and the Dallas North Tollway. Customers and staff can reach it from Lewisville, Carrollton, The Colony, Plano and Frisco.',
      'Light industrial zoning covers automotive services, construction trades, gyms, light manufacturing, shipping and showroom retail. Units come with 24/7 access, front-loading doors, mezzanine options and signage.',
    ].join('\n\n'),
  },
  establishedSites: { ...detail.establishedSites, heading: 'Businesses already open next door' },
  tenants: [],
  neighborhoods: neighborhoods(),
  videosHeading: 'See POW Lewisville',
  // ouA2c7FdYLk, aIZYFBGO1OQ, c5szqNDA-XI and kiHEcxuHqBY were POW Leander's — dropped.
  // TODO: confirm both show Lewisville.
  videos: ['Kpua3d5RKLM', 'h-nsWbta5Wc'].map((id, i) => ({
    url: `https://www.youtube.com/watch?v=${id}`,
    title: `POW Lewisville Phase II video ${i + 1}`,
  })),
  faqHeading: 'POW Lewisville FAQs',
  faqs: FAQS,
  resourceLinks: [
    { label: 'Map', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`, thumbnail: '' },
    { label: 'LoopNet', url: 'https://www.loopnet.com/Listing/2601-E-State-Highway-121-Lewisville-TX/37428443/', thumbnail: '' },
  ],
  closing: {
    body: 'Talk to The Prime Developer team about buying or leasing a new unit on State Hwy 121, from pricing and fit-out to a site tour.',
  },
  seo: {
    ...detail.seo,
    title: 'POW Lewisville Phase II | Flex Warehouse for Sale | The Prime Developer',
    description: 'New flex warehouse units for sale on State Hwy 121, Lewisville, TX: 14 ft doors, 25 ft clear height, mezzanines. From $995,625. Enquire today.',
    ogTitle: 'POW Lewisville Phase II | Flex Warehouse for Sale',
    ogDescription: '22 new office warehouse and flex units on State Hwy 121 in Lewisville, TX. Buy from $995,625.',
    twitterDescription: 'New flex units with 14 ft doors and 25 ft clear height on SH 121, Lewisville.',
    ...(img.og ? { ogImage: img.og } : {}),
    ogImageAlt: FILES.og[1],
    heroAlt: FILES.hero[1],
    geoRegion: 'US-TX',
    geoPlacename: 'Lewisville',
    alternateName: 'Prime Office Warehouses Lewisville Phase II',
    placeDescription: 'Two-building office warehouse and flex development with 22 shell units on State Hwy 121 in Lewisville, TX.',
    amenities: ['14 x 14 ft overhead doors', '25 ft rear clear height', 'Mezzanine up to 50% of unit', '24/7 access'],
    noindex: NOINDEX,
  },
  imageAlts: imageAltsFor(detail, img, altFor),
})

// Unit card photos: the construction shot, then the front elevation.
const UNIT_IMAGES = ['construction', 'pow-lewisville-phase-ii-gallery-01.webp']

const altFor = (key) => FILES[key]?.[1] ?? GALLERY.find(([name]) => name === key)?.[1] ?? ''

// First three after the hero → overview mosaic; next four → "Businesses already open next door".
const GALLERY_ORDER = ['construction', 'site', 'gallery5', 'tenant1', 'tenant2', 'tenant3', 'storefronts', ...GALLERY.map(([n]) => n)]
  .map((k) => (k === 'gallery5' ? GALLERY[4][0] : k))
  .filter((k, i, all) => all.indexOf(k) === i)
const files = { ...Object.fromEntries(Object.entries(FILES).map(([k, [name]]) => [k, name])), ...Object.fromEntries(GALLERY.map(([g]) => [g, g])) }

await applyContent({
  slug: SLUG,
  folder: 'projects/pow-lewisville-phase-ii/drive',
  photoDir: defaultPhotoDir(),
  files,
  galleryOrder: GALLERY_ORDER,
  patch,
  top: { buildings: UNITS.length, sold: 0, available: UNITS.length },
})
