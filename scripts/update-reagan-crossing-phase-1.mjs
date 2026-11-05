// Apply the Reagan Crossing Phase I page copy, SEO fields, pricing and FAQs
// from Reagan_Crossing_SEO_AEO_GEO_Page_Pack.docx, Part 2 (repo root).
//
// Through the live API, as an admin — not Supabase. Same pattern as
// update-centro-content.mjs: logs in, reads the current record at SLUG, and
// saves with PATCH /admin/properties/:id, carrying `expectedUpdatedAt` so it
// refuses to overwrite an edit made meanwhile. Dry run by default; --commit
// to write.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-reagan-crossing-phase-1.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-reagan-crossing-phase-1.mjs --commit
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-reagan-crossing-phase-1.mjs --with-pricing
//
// Merges into the live record rather than replacing it. Untouched on purpose:
// address, floorPlans.buildings (the unit inventory — Prime Tracker owns it),
// covers, gallery, siteModel, tenants (the logo strip) and seo.latitude/
// longitude. None of those are confirmed by the page pack (see below), and
// guessing them would plant a wrong fact in both the page and its schema.
//
// Left out of this pass entirely — the page pack flags each with [confirm] or
// marks it a data conflict (Part 1, "Data conflicts to resolve before
// publishing") and this script does not invent a replacement:
//   TODO: exact frontage split between the two phases (pack: confirm)
//   TODO: traffic count/year/source on Ronald Reagan Blvd (pack: two figures, pick one)
//   TODO: total development size and whether listing areas are land or building SF
//   TODO: acreage scope — whether 15.69 acres is Phase I alone or the whole site
//   TODO: unit totals/availability — one source needed, hero counter still shows 0
//   TODO: the Apple HQ2 "12-minute drive" claim — verify or drop (this page doesn't carry it, Phase II's does)
//   TODO: nearby-neighborhood drive times (Travisso, Crystal Falls, MetroRail)
//   TODO: which of the two YouTube videos shows this phase
//   TODO: tenant names on "businesses already open" — that section reads live
//         unit data (floorPlans.buildings[].unitList[].tenant), which this
//         script does not touch, so nothing here needs sign-off
//   TODO: lat/long and the Google Maps URL for the JSON-LD Place node
//
// The FAQ in the pack included "How is Phase I different from Phase II?" —
// dropped here on request: the two pages should not need to explain each
// other to stand on their own, and the comparison read as the one place the
// pages were answering for one another instead of about themselves.
import { writeFileSync } from 'node:fs'

const COMMIT = process.argv.includes('--commit')
// Rate Master pricing. Held back until the client confirms unit-to-phase
// assignment (the pack infers it from unit numbers: 300s = Building 3) and
// cap-rate tenant names; `--with-pricing` sends both tables.
const WITH_PRICING = process.argv.includes('--with-pricing')
const priced = (withPrices, without) => (WITH_PRICING ? withPrices : without)
// Tenant names need the client's sign-off before they go public — same
// convention as update-centro-content.mjs.
const SHOW_TENANT_NAMES = false
const SLUG = 'reagan-crossing-phase-1'
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`

const FAQS = [
  ['Where is Reagan Crossing Phase I?', 'Reagan Crossing Phase I is at 15101 Ronald Reagan Blvd, Leander, TX 78641, on the signalized corner of Ronald Reagan Blvd and Journey Parkway.'],
  ['What is in Reagan Crossing Phase I?', 'Phase I has 37,000 SF of medical and professional office, 45,000 SF of retail, 6,000 SF of drive-thru space and a 10,000 SF daycare on 15.69 acres.'],
  ['Can I lease or buy space at Reagan Crossing Phase I?', priced(
    'Both. Retail space sells from $956,700 ($450/SF) or leases from $34/SF/yr plus $13 NNN. Pad sites are available for lease.',
    'Both. Retail space is available to buy or lease, and pad sites are available for lease. Contact the team for current pricing.',
  )],
  ['What businesses can open at Reagan Crossing Phase I?', 'Zoning allows retail, restaurant, service, daycare, office and hotel uses. The office space suits medical and professional tenants.'],
  ['Can I buy a leased investment property at Reagan Crossing Phase I?', priced(
    'Yes. Two leased units are for sale at a 5.5% cap rate on 10-year NNN leases, priced from $1,183,096 to $1,885,454.',
    'Yes. Leased units are for sale to investors on NNN terms. Contact the team for current pricing.',
  )],
  ['Is there parking at Reagan Crossing Phase I?', 'Yes. Every building at Reagan Crossing Phase I has on-site parking.'],
  ['How do I book a tour of Reagan Crossing Phase I?', 'Use the Enquire form or message The Prime Developer on WhatsApp at +1 512-761-8025.'],
  // Dropped on request: "How is Reagan Crossing Phase I different from
  // Phase II?" The pack's own anti-duplication rule (Part 1) already asks
  // each page to stand on its own; a cross-phase comparison FAQ was the one
  // place that rule slipped.
].map(([question, answer]) => ({ question, answer }))

const unit = (unit, type, size, salePrice, salePsf, lease, nnn, annualRent) =>
  ({ unit, type, size, salePrice, salePsf, lease, nnn, annualRent })
const cap = (unit, tenant, businessType, size, price, capRate, leaseTerm, rent, nnn) =>
  ({ unit, ...(SHOW_TENANT_NAMES ? { tenant } : {}), businessType, size, price, capRate, leaseTerm, rent, nnn })

const patch = (detail) => {
  const { pricing, ...rest } = fullPatch(detail)
  return WITH_PRICING ? { ...rest, pricing } : rest
}

const fullPatch = (detail) => ({
  kicker: 'Mixed-Use · 15101 Ronald Reagan Blvd, Leander, TX 78641',
  tagline: 'Retail, office and daycare space on a signalized corner in Leander',
  overview: {
    ...detail.overview,
    eyebrow: 'Premier Mixed-Use',
    heading: 'Retail, office and daycare space in Leander, plus cap rate properties for income',
    body: [
      'Reagan Crossing Phase I is a 15.69-acre mixed-use retail, office, drive-thru and daycare development at 15101 Ronald Reagan Blvd in Leander, TX, developed by The Prime Developer. It sits on the signalized corner of Ronald Reagan Blvd and Journey Parkway, the first phase of Reagan Crossing in Leander.',
      'Phase I combines 37,000 SF of medical and professional office, 45,000 SF of retail, 6,000 SF of drive-thru space and a 10,000 SF daycare. Retail space is available to buy or lease, and pad sites are open for lease. Office, retail and drive-thru space continues next door in [Reagan Crossing Phase II](/properties/reagan-crossing-phase-2).',
      `For investors, two Phase I units are already leased to operating businesses on 10-year NNN leases ${priced('at a 5.5% cap rate', 'at a fixed cap rate')}. They suit buyers looking for commercial real estate investment near Austin, or who want to buy commercial property to lease out. [See all investment properties](/investors).`,
    ].join('\n\n'),
    // Tokens resolve from the property's own unit inventory, the same as
    // every other property page — not guessed here. See units.js/collectUnits.
    stats: [
      { value: '15.69', label: 'Acres' },
      { value: '{totalUnits}', label: 'Total units' },
      { value: '{availableUnits}', label: 'Available units' },
    ],
  },
  highlights: {
    ...detail.highlights,
    heading: 'A signalized corner on Ronald Reagan Blvd',
    body: 'Phase I holds a hard corner at a signalized intersection, with a curb cut across Ronald Reagan Blvd. It faces more than 2,500 newly built homes within 1.5 miles.',
    bigStats: [
      { value: '6,000', label: 'SF drive-thru' },
      { value: '10,000', label: 'SF daycare' },
    ],
    cards: [
      { title: 'Own or lease', body: priced(
        'Retail space from $956,700 to buy, or $47/SF/yr all-in to lease.',
        'Retail space to buy or lease on Ronald Reagan Blvd.',
      ) },
      { title: 'Homes next door', body: '2,500+ newly built homes within 1.5 miles give tenants a ready customer base.' },
      { title: 'Daycare and families', body: 'A 10,000 SF daycare anchors the phase and brings parents twice a day.' },
    ],
    // The highlights card pairing a specific vehicle count with Ronald Reagan
    // Blvd is left out: the pack gives two conflicting TxDOT figures
    // (~23,000 VPD 2022 vs 18,000 VPD) and asks for one figure with a year
    // and source before either goes on the page.
  },
  floorPlans: {
    ...detail.floorPlans,
    intro: {
      heading: 'Site overview and floor plans',
      body: 'Phase I wraps the Journey Parkway corner with retail, office, drive-thru and daycare buildings. Select a building to see its units, sizes and who is already open there.',
    },
    // `buildings` itself is untouched — it is the unit inventory and Prime
    // Tracker owns it (see sync-centro-from-tracker.mjs for the equivalent
    // flow). The pack lists only Building 3 and flags "[add the other
    // Phase I buildings]"; this script cannot add buildings it has no data for.
  },
  pricing: {
    units: {
      heading: 'Retail space for sale or lease',
      intro: 'Retail space starts at $956,700 to buy, or $47/SF/yr all-in to lease ($34 base + $13 NNN).',
      rows: [
        unit('303', 'Retail', '2,126', '$956,700', '$450', '$34', '$13', '$99,922'),
      ],
    },
    capRate: {
      heading: 'Cap rate investment properties',
      intro: "Own an income-producing unit with a tenant already in place. These cap rate properties pay 5.5% on 10-year leases, and the tenants pay the NNN costs. [See all investment properties](/investors).",
      showTenantNames: SHOW_TENANT_NAMES,
      rows: [
        cap('702', 'Seven Oaks Coffee', 'Coffee shop', '1,804', '$1,183,096', '5.50%', '10 yrs', '$65,070', '$23,452'),
        cap('700, 701', 'Manyavar', 'Apparel retail', '3,050', '$1,885,454', '5.50%', '10 yrs', '$103,700', '$39,650'),
      ],
    },
  },
  location: {
    ...detail.location,
    eyebrow: 'Zoning Opportunities',
    heading: "Built for Leander's growth",
    sub: '',
    body: [
      'Zoning covers retail, restaurants, services, daycare, office and hotel uses, so Phase I can serve families, commuters and the clinics that follow new homes. The city plans to widen Ronald Reagan Blvd to six lanes, adding capacity at the Journey Parkway corner.',
      "The phase sits in the middle of [Leander's commercial real estate growth](/leander), giving small businesses an affordable alternative to higher-priced office space closer to Austin.",
    ].join('\n\n'),
  },
  establishedSites: { ...detail.establishedSites, heading: 'Businesses already open at Reagan Crossing Phase I' },
  neighborhoods: {
    heading: 'Nearby neighborhoods',
    intro: 'Phase I serves the fast-growing neighborhoods along Ronald Reagan Blvd in north Leander, and sits up the road from [Centro Plaza](/projects/centro-plaza).',
    mapQuery: '15101 Ronald Reagan Blvd, Leander, TX 78641',
    items: [
      { name: 'Travisso', note: 'Master-planned community along Ronald Reagan Blvd.' },
      { name: 'Crystal Falls', note: 'Established Leander neighborhood with golf and parks.' },
      { name: 'Leander MetroRail Station', note: 'Commuter rail link to downtown Austin.' },
      // Drive times to each place were struck from the card copy — the pack
      // marks all three "[confirm minutes]" and none is confirmed yet.
    ],
  },
  videosHeading: 'See Reagan Crossing',
  // `videos` untouched — the pack flags "[confirm which phase each shows]"
  // for both of the two YouTube videos on the old page, so this script does
  // not assign either one to Phase I.
  videos: detail.videos ?? [],
  faqHeading: 'Reagan Crossing Phase I FAQs',
  faqs: FAQS,
  resourceLinks: (detail.resourceLinks ?? []).map((link) => {
    if (link.label === 'Location') return { ...link, label: 'Map' }
    if (/loopnet/i.test(link.label)) {
      return { ...link, label: 'LoopNet', url: 'https://www.loopnet.com/Listing/15101-Ronald-Reagan-Blvd-Leander-TX/37710740/' }
    }
    return link
  }),
  closing: {
    body: 'Talk to The Prime Developer team about retail, office and daycare space in Leander, from pricing and availability to a site tour.',
  },
  seo: {
    title: 'Reagan Crossing Leander Phase I | Retail, Office & Daycare',
    description: 'Reagan Crossing Phase I is a 15.69-acre mixed-use site at 15101 Ronald Reagan Blvd, Leander, TX, with retail, medical office, drive-thru and daycare space.',
    ogTitle: 'Reagan Crossing Leander Phase I | Retail, Office & Daycare',
    ogDescription: 'Retail, medical office, drive-thru and daycare space at Ronald Reagan Blvd and Journey Parkway, Leander TX.',
    twitterDescription: 'Retail, office, drive-thru and daycare space on Ronald Reagan Blvd, Leander TX.',
    ogImageAlt: 'Reagan Crossing Phase I buildings at dusk, Ronald Reagan Blvd, Leander TX',
    heroAlt: 'Reagan Crossing Phase I buildings at dusk, Ronald Reagan Blvd, Leander TX',
    geoRegion: 'US-TX',
    geoPlacename: 'Leander',
    // latitude/longitude intentionally not set here — see the untouched-fields
    // note at the top. usePropertyHead and propertySchema both gate on
    // Number.isFinite, so leaving these out of the patch keeps whatever (if
    // anything) the record already carries, rather than planting a guess.
    placeDescription: '15.69-acre first phase of Reagan Crossing with 37,000 SF of medical and professional office, 45,000 SF of retail, 6,000 SF of drive-thru space and a 10,000 SF daycare.',
    amenities: ['On-site parking', 'Signalized intersection at Journey Parkway', 'Drive-thru space', 'Daycare on site'],
  },
})

// ── API ──────────────────────────────────────────────────────────────────
const email = process.env.PRIME_ADMIN_EMAIL
const password = process.env.PRIME_ADMIN_PASSWORD
if (!email || !password) throw new Error('Set PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')

async function call(path, { token, ...init } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const property = await call(`/admin/properties/${SLUG}`, { token })

const preview = patch(property.detail ?? {})
console.log(`${SLUG} (updatedAt ${property.updatedAt})`)
for (const k of Object.keys(preview)) {
  const before = JSON.stringify(property.detail?.[k] ?? null)
  const after = JSON.stringify(preview[k])
  console.log(`  detail.${k}: ${before === after ? 'unchanged' : before === 'null' ? 'added' : 'changed'}`)
}

if (!COMMIT) {
  console.log('\nDry run — nothing written. Re-run with --commit.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `reagan-crossing-phase-1-content-backup-${stamp}.json`
writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))
console.log(`\nbacked up previous state to ${backup}`)

await call(`/admin/properties/${property.id}`, {
  token,
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    detail: { ...property.detail, ...patch(property.detail ?? {}) },
    expectedUpdatedAt: property.updatedAt,
  }),
})

console.log('Saved — Reagan Crossing Phase I carries the page-pack copy.')
