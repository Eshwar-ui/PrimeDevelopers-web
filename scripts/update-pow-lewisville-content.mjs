// Apply the POW Lewisville (Phase I) page copy, SEO fields, cap rate table,
// FAQs and Drive photography from the 2026-11 handoff
// (pow-lewisville-claude-code-handoff, source doc
// https://claude.ai/artifact/SyX9WJEaBDmJPJJs6EHJz7). Phase II has its own
// script: update-pow-lewisville-phase-ii-content.mjs.
//
//   node scripts/prepare-pow-lewisville-photos.mjs            (once: Drive → WebP)
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-pow-lewisville-content.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-pow-lewisville-content.mjs --commit
//
// Merges into the live record. Untouched on purpose: address, the headline
// totals (buildings/sold/available → hero strip and the {totalUnits} /
// {availableUnits} tokens), the unit lists in floorPlans.buildings, siteModel
// and socials.
//
// House rule: no heading on either phase page says "Phase I" / "Phase II" —
// the phase lives in the switch, breadcrumbs, title tags, schema and body copy.
//
// Unconfirmed in the handoff, so left out rather than guessed:
//   TODO: ZIP — 75067 (record) or 75056; the kicker leaves it off, the record keeps 75067.
//         Street is "2601 E State Hwy 121" in the handoff, "2601 State Hwy 121" on the record.
//   TODO: lat/long — geo.position, Place `geo` and `hasMap` stay off until set.
//   TODO: unit totals — staging 77 / 63 / 14 vs old site 13 of 31 for Buildings 4–5;
//         one source must set buildings/sold/available (left as on the record).
//   TODO: Buildings 1–3 — add records or confirm sold out. Per-building area unknown
//         (the 185,238 on each tab was the phase total), so the tab shows "—".
//   Building 4 had a stray unit record "101"; it is refiled under Building 1.
//   TODO: the 3D site model still binds mesh empty_119 to "Building 4 / 101" — rebind it
//         in the admin site-model tool (to 101 in Building 1, or the right Building 4 unit).
//   TODO: unit statuses. The record had no Phase I unit inventory, so one unit record is
//         created per Drive Units/LEW-Unit-<n> folder (63 units, Buildings 1–5; folders
//         113, 115, 117, 311 and 313 are empty), carrying its best photos from
//         prepare-pow-lewisville-unit-photos.mjs. Status defaults to "leased" ("Most
//         Phase I units are leased" — handoff FAQ); set real ones in UNIT_STATUS.
//         Sizes are unknown and left blank. Existing unit records are merged, not replaced.
//   TODO: no Phase I units in the Rate Master for direct sale/lease — "Enquire for availability".
//   TODO: SH 121 traffic count (old site: 90,000 and 125,000 a day) — card says "heavy".
//   TODO: Castle Hills home count, and drive times for every nearby place.
//   TODO: tenant names (N & S Retail E-Commerce, Harvest Depot, Braeburn Systems) need
//         sign-off → SHOW_TENANT_NAMES false; business types shown instead. Same for the
//         names on the storefront signs in the tenant photos.
//   TODO: LoopNet Building 1 Unit 103 cap listing ($815,000, 7.52%) — not in the CAP sheet.
//   TODO: real Phase I tenant logos (site-wide 22 Yards / Farm2Cook / … removed).
//   TODO: confirm each YouTube video shows POW Lewisville; drone videos LEW-DRONE-1…5 to upload.
//   TODO: flyer PDF (broken on old site); floor plans PLANS_Lewisville_B41/B51.jpg and the
//         location map are not in the Drive folder; Crexi only if listed.
//   TODO: monument sign reads "PRIME FLEX SPACES" — not shown until the client confirms.
//   TODO: Drone LEW-9 and LEW-11 (assigned to this page by the handoff) show the light-blue
//         Phase II roof in frame — confirm they are acceptable here.
//   TODO: /lewisville doesn't exist yet, so those anchors are plain text; /investors doesn't
//         exist, so it points at /cap-properties (the site's investment listings).
import { applyContent, defaultPhotoDir, imageAltsFor } from './lib/property-content.mjs'
import { MAP_QUERY, neighborhoods } from './lib/pow-lewisville.mjs'
import { existsSync, readFileSync } from 'node:fs'

const SHOW_TENANT_NAMES = false
const SLUG = 'pow-lewisville'
const STOREFRONT_ALT = 'Business storefront at POW Lewisville'

// Slot → [prepared file, alt text]. Drive source in scripts/pow-lewisville-drive-manifest.json.
const FILES = {
  hero: ['pow-lewisville-office-warehouse-exterior.webp', 'POW Lewisville two-storey office warehouse building with stone facade and glass storefronts, Lewisville TX'],
  og: ['pow-lewisville-og-1200x630.jpg', 'POW Lewisville office warehouse and flex units, Lewisville TX'],
  aerial: ['pow-lewisville-aerial-buildings.webp', 'Aerial view of the POW Lewisville office warehouse buildings and parking'],
  corner: ['pow-lewisville-storefront-corner.webp', 'Corner unit with glass storefront and stone facade at POW Lewisville'],
  site: ['pow-lewisville-site-aerial.webp', 'Aerial of the POW Lewisville buildings, Lewisville TX'],
  tenant1: ['pow-lewisville-tenant-1.webp', STOREFRONT_ALT],
  tenant2: ['pow-lewisville-tenant-2.webp', STOREFRONT_ALT],
  tenant3: ['pow-lewisville-tenant-3.webp', STOREFRONT_ALT],
  storefronts: ['pow-lewisville-storefront-units.webp', 'Row of storefront flex units with tenant signage and overhead doors at POW Lewisville'],
  frontage: ['pow-lewisville-sh-121-frontage-aerial.webp', 'Aerial of POW Lewisville beside State Hwy 121'],
  corridor: ['pow-lewisville-sh-121-corridor-aerial.webp', 'Wide aerial of POW Lewisville and the State Hwy 121 corridor'],
}
// pow-lewisville-gallery-01…14.webp, alt written against each photograph.
const GALLERY = [
  'Corner of a POW Lewisville building with stone facade and glass storefront', // All Buildings/LEW-2
  'Row of flex units with overhead doors along a POW Lewisville building', // LEW-8
  'Stone and dark-panel flex units with overhead doors at POW Lewisville', // LEW-14
  'Building 1 corner storefront at POW Lewisville', // LEW-38
  'Two-storey flex units with overhead doors at POW Lewisville', // LEW-84
  'Glass entrance and overhead doors on a POW Lewisville flex unit', // LEW-113
  'Corner storefront with tenant signage at POW Lewisville', // LEW-142
  'Parking in front of the flex units at POW Lewisville', // LEW-191
  'Building 1 with glass storefronts and landscaping at POW Lewisville', // LEW-225
  'POW Lewisville buildings and tenant signage seen from the street', // LEW-255
  'Street view of the POW Lewisville office warehouse buildings', // LEW-262
  'Storefront end-cap and flex units along the street at POW Lewisville', // LEW-269
  'Aerial close-up of the POW Lewisville buildings and flex units', // Drone Photos/LEW-3
  'Wide aerial of the POW Lewisville buildings and surrounding Lewisville', // Drone Photos/LEW-13
].map((alt, i) => [`pow-lewisville-gallery-${String(i + 1).padStart(2, '0')}.webp`, alt])

// Word for word in the visible FAQ and the FAQPage markup — both read this list.
const FAQS = [
  ['Where is POW Lewisville?', '2601 E State Hwy 121 at Leora Ln, Lewisville, TX, on the SH 121 frontage road. Phase I has five buildings.'],
  ['Can I buy or lease a unit?', 'Units can be bought, leased or built to suit. Most Phase I units are leased; new units for sale are in POW Lewisville Phase II, from $995,625.'],
  ['What businesses can use the space?', 'Zoning is light industrial: flex office, showroom and warehouse. Typical users include car services, sign shops, roofing contractors and gymnastics centers.'],
  ['Are there investment properties for sale?', 'Yes. Three leased units are for sale from $695,750 at 6% to 6.5% cap rates, on NNN leases of 3 to 15 years.'],
  ['Can I add a mezzanine?', 'Yes, up to 50% of the base floor plan.'],
  ['How big is the development?', 'Phase I covers 185,238 SF across five buildings. The full project is 294,512 SF across seven buildings.'],
  ['How do I book a tour?', 'Use the Enquire form or message the team on WhatsApp at +1 512-761-8025.'],
].map(([question, answer]) => ({ question, answer }))

const cap = (unit, tenant, businessType, size, price, capRate, leaseTerm, rent, nnn) =>
  ({ unit, ...(SHOW_TENANT_NAMES ? { tenant } : {}), businessType, size, price, capRate, leaseTerm, rent, nnn })

const patch = (detail, img) => ({
  kicker: 'Flex · Office Warehouse · 2601 E State Hwy 121, Lewisville, TX',
  tagline: 'Office warehouse and flex space on State Hwy 121, between Lewisville and Castle Hills',
  ...(img.hero ? { covers: { ...detail.covers, detailHero: img.hero } } : {}),
  overview: {
    ...detail.overview,
    eyebrow: 'Prime Office Warehouses Lewisville',
    heading: 'Office warehouse and flex space in Lewisville, with a storefront on every unit',
    body: [
      'POW Lewisville (Prime Office Warehouses Lewisville) is an office warehouse and flex development at Leora Ln and E State Hwy 121 in Lewisville, TX. Phase I covers five buildings and 185,238 SF, part of a seven-building, 294,512 SF project.',
      // TODO: /lewisville doesn't exist yet — restore as [flex space for sale in Lewisville](/lewisville).
      "Every unit pairs a glass storefront with open warehouse or office space behind it, so customers walk in as they would to a shop. Owners can fit out each unit as office, showroom or warehouse. If you're comparing flex space for sale in Lewisville, Phase I is already open and working.",
      'For investors, three Phase I units are for sale with tenants in place, priced from $695,750 at 6% to 6.5% cap rates. They suit buyers looking for an [office warehouse investment property in Texas](/cap-properties).',
    ].join('\n\n'),
    // Unit counts resolve from the same totals as the hero strip.
    stats: [
      { value: '185,238', label: 'SF Phase I size' },
      { value: '{totalUnits}', label: 'Total units' },
      { value: '{availableUnits}', label: 'Available units' },
    ],
  },
  highlights: {
    ...detail.highlights,
    heading: 'Built for showrooms, contractors, gyms and e-commerce',
    body: 'Zoning is light industrial, which covers flex office, showroom and warehouse use. That fits car services, sign shops, roofing contractors, gymnastics centers and online sellers who need a door to the street and room to store stock.',
    bigStats: [
      { value: '185,238', label: 'SF Phase I' },
      { value: '294,512', label: 'SF full project' },
    ],
    cards: [
      { title: 'Storefront units', body: 'Glass entrance doors and a retail-style front on every unit.' },
      { title: 'Mezzanine allowance', body: 'Add a mezzanine of up to 50% of the base floor plan.' },
      // TODO: confirm the daily count (old site says both 90,000 and 125,000 vehicles a day).
      { title: 'Highway 121 frontage', body: 'Heavy daily traffic on State Hwy 121.' },
      { title: 'Buy, lease or build to suit', body: 'Own your unit, lease it, or have it built to your layout.' },
    ],
  },
  floorPlans: {
    ...detail.floorPlans,
    intro: {
      heading: 'Site overview and floor plans',
      // TODO: /lewisville doesn't exist yet — restore the link on "office warehouse for sale in Lewisville".
      body: 'Phase I has five buildings with storefront flex units. Select a building to see its plan and who is open there. Need office warehouse for sale in Lewisville with more room? See the new units in [POW Lewisville Phase II](/properties/pow-lewisville-phase-ii).',
    },
    // Unit lists untouched. The tab's "Total Area" was the phase total on both
    // buildings; blank until per-building areas are known. Unit counts from the handoff.
    // TODO: Buildings 1–3.
    buildings: phaseOneBuildings(detail.floorPlans?.buildings ?? [], img),
  },
  pricing: {
    capRate: {
      heading: 'Cap rate investment properties',
      intro: "Buy a unit with a tenant already paying rent. POW Lewisville's leased units pay 6% to 6.5% on NNN leases of 3 to 15 years. See all [cap rate properties in Texas](/cap-properties).",
      showTenantNames: SHOW_TENANT_NAMES,
      rows: [
        cap('516', 'N & S Retail E-Commerce', 'E-commerce retailer', '1,815', '$695,750', '6.50%', '3 yrs', '$41,745', '$23,595'),
        cap('513, 515', 'Harvest Depot', 'Wholesale supply', '3,150', '$1,526,538', '6.50%', '5 yrs', '$99,225', '$40,950'),
        cap('501', 'Braeburn Systems', 'Technology manufacturer', '5,530', '$2,041,846', '6.00%', '15 yrs', '$132,720', '$71,890'),
      ],
    },
  },
  location: {
    ...detail.location,
    eyebrow: 'Tailored',
    heading: 'On State Hwy 121, in the middle of North Texas growth',
    sub: '',
    body: [
      'POW Lewisville sits on the State Hwy 121 frontage road at Leora Ln, with quick access to I-35E, the Sam Rayburn Tollway and the Dallas North Tollway. Customers and staff can reach it from Lewisville, Carrollton, The Colony, Plano and Frisco.',
      // TODO: /lewisville doesn't exist yet — restore as [Lewisville's commercial real estate](/lewisville).
      "Zoning is light industrial, so the units work for flex office, showroom and warehouse uses. That puts owners in the middle of Lewisville's commercial real estate market, next to Castle Hills and the retail along SH 121.",
    ].join('\n\n'),
  },
  establishedSites: { ...detail.establishedSites, heading: 'Businesses already open at POW Lewisville' },
  // The site-wide logo strip showed tenants of other projects. TODO: real Phase I tenant logos.
  tenants: [],
  neighborhoods: neighborhoods(),
  videosHeading: 'See POW Lewisville',
  // TODO: confirm each shows POW Lewisville; add LEW-DRONE-1…5 once on YouTube.
  videos: ['SU2ADiU-9oE', 'cHLL6mikzKQ', '70DngEBi9-k', 'ko6-k0Ztx6c'].map((id, i) => ({
    url: `https://www.youtube.com/watch?v=${id}`,
    title: `POW Lewisville video ${i + 1}`,
  })),
  faqHeading: 'POW Lewisville FAQs',
  faqs: FAQS,
  // TODO: Flyer and Floor plans PDFs once uploaded; Crexi only if listed.
  resourceLinks: [
    { label: 'Map', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`, thumbnail: '' },
    { label: 'LoopNet', url: 'https://www.loopnet.com/Listing/2601-Tx-121-Lewisville-TX/22144421/', thumbnail: '' },
  ],
  closing: {
    body: 'Talk to The Prime Developer team about office warehouse and flex space on State Hwy 121, from leased investment units to a site tour.',
  },
  seo: {
    ...detail.seo,
    title: 'POW Lewisville | Office Warehouse & Flex Space | The Prime Developer',
    description: 'POW Lewisville has office warehouse and flex units on State Hwy 121 in Lewisville, TX. Buy, lease or invest in leased units from $695,750. Enquire today.',
    ogTitle: 'POW Lewisville | Office Warehouse & Flex Space',
    ogDescription: 'Storefront office warehouse and flex units on State Hwy 121 in Lewisville, TX.',
    twitterDescription: 'Office warehouse and flex units on SH 121, Lewisville. Buy, lease or invest.',
    ...(img.og ? { ogImage: img.og } : {}),
    ogImageAlt: FILES.og[1],
    heroAlt: FILES.hero[1],
    geoRegion: 'US-TX',
    geoPlacename: 'Lewisville',
    // latitude/longitude: TODO — left as the record has them (none today).
    alternateName: 'Prime Office Warehouses Lewisville',
    placeDescription: 'Phase I of a seven-building office warehouse and flex development on State Hwy 121 in Lewisville, TX, with storefront units to buy, lease or build to suit.',
    amenities: ['Mezzanine up to 50% of floor plan', 'Glass storefront entrances', 'On-site parking'],
    noindex: false,
  },
  imageAlts: imageAltsFor(detail, img, altFor),
})

// ── Units ────────────────────────────────────────────────────────────────
// Best photos per Drive unit folder, chosen by prepare-pow-lewisville-unit-photos.mjs.
const UNIT_PICKS = existsSync('scripts/pow-lewisville-unit-photos.json')
  ? JSON.parse(readFileSync('scripts/pow-lewisville-unit-photos.json', 'utf8'))
  : {}
const UNIT_PHOTOS = Object.entries(UNIT_PICKS).flatMap(([unit, picks]) =>
  picks.map((p, i) => ({ unit, key: `unit-${unit}-${i + 1}`, file: p.file, first: i === 0 })))
const UNIT_ALTS = Object.fromEntries(UNIT_PHOTOS.map(({ unit, key, first }) =>
  [key, first ? `Unit ${unit} storefront at POW Lewisville` : `Unit ${unit} at POW Lewisville`]))

// Known from the cap rate sheet: these four have tenants paying rent.
// TODO: every other unit's status — "leased" until Prime Tracker or the client says otherwise.
const UNIT_STATUS = { 501: 'leased', 513: 'leased', 515: 'leased', 516: 'leased' }
const DEFAULT_STATUS = 'leased'

const blankUnit = (label) => ({
  label, status: UNIT_STATUS[label] ?? DEFAULT_STATUS, tenant: '', tenantUrl: '', tenantCategory: '',
  size: '', floor: '', frontage: '', description: '', x: null, y: null, logo: '', images: [], facingRoad: '',
})

// Phase I is Buildings 1–5 (Phase II is 6 and 7), one record per unit folder.
// A unit's building is its first digit (Unit 402 → Building 4): a record filed
// under the wrong building (the stray "101" under Building 4) moves to its own,
// merged with any record already there. Existing units keep every field they
// have; a unit only gains photos, and only when it has none.
const PHASE_ONE = [1, 2, 3, 4, 5]
const buildingOf = (label, fallback) => (/^[1-5]\d\d$/.test(String(label)) ? Number(String(label)[0]) : fallback)

function phaseOneBuildings(current, img) {
  const byNumber = new Map(current.filter((b) => PHASE_ONE.includes(b.number)).map((b) => [b.number, b]))
  const filed = new Map(PHASE_ONE.map((n) => [n, []]))
  for (const b of byNumber.values()) {
    for (const u of b.unitList ?? []) {
      const list = filed.get(buildingOf(u.label, b.number))
      const twin = list.find((t) => t.label === u.label)
      if (!twin) list.push(u)
      // Keep the fuller record's fields; fill its blanks from the other.
      else Object.entries(u).forEach(([k, v]) => { if (twin[k] == null || twin[k] === '' || (Array.isArray(twin[k]) && !twin[k].length)) twin[k] = v })
    }
  }
  return PHASE_ONE.map((number) => {
    const b = byNumber.get(number) ?? { number, building: `Building ${number}`, parking: 'Yes', unitList: [] }
    const photosFor = (unit) => UNIT_PHOTOS.filter((p) => p.unit === unit).map((p) => img[p.key]).filter(Boolean)
    const list = filed.get(number).map((u) => (u.images?.length || !UNIT_PICKS[u.label] ? u : { ...u, images: photosFor(u.label) }))
    for (const unit of Object.keys(UNIT_PICKS).filter((u) => u[0] === String(number))) {
      if (!list.some((u) => u.label === unit)) list.push({ ...blankUnit(unit), images: photosFor(unit) })
    }
    list.sort((a, c) => String(a.label).localeCompare(String(c.label), 'en', { numeric: true }))
    return {
      ...b,
      // Was the phase total (185,238) on every tab; per-building areas unknown.
      area: '',
      unitList: list,
      // Handoff counts for 4 and 5 (staging data). TODO: one source for all five.
      ...(number === 4 ? { units: 14, available: 4 } : number === 5 ? { units: 17, available: 9 } : { units: list.length, available: list.filter((u) => u.status === 'available').length }),
    }
  })
}

const altFor = (key) => FILES[key]?.[1] ?? GALLERY.find(([name]) => name === key)?.[1] ?? UNIT_ALTS[key] ?? ''

// Order matters to the page: the first three after the hero fill the overview
// mosaic, the next four become "Businesses already open", the rest the gallery.
const GALLERY_ORDER = ['aerial', 'corner', 'site', 'tenant1', 'tenant2', 'tenant3', 'storefronts', 'frontage', 'corridor', ...GALLERY.map(([n]) => n)]
const files = {
  ...Object.fromEntries(Object.entries(FILES).map(([k, [name]]) => [k, name])),
  ...Object.fromEntries(GALLERY.map(([n]) => [n, n])),
  ...Object.fromEntries(UNIT_PHOTOS.map(({ key, file }) => [key, file])),
}

await applyContent({
  slug: SLUG,
  folder: 'projects/pow-lewisville/drive',
  photoDir: defaultPhotoDir(),
  files,
  galleryOrder: GALLERY_ORDER,
  patch,
})
