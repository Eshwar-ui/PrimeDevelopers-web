// Create the two Reagan Crossing property records from
// Reagan_Crossing_SEO_AEO_GEO_Page_Pack.docx (repo root) — they do not exist
// in the CMS yet. Confirmed by listing every record through
// GET /admin/properties on 2026-11-05: six properties, none named Reagan
// Crossing, published or not.
//
// Created **unpublished**. The page pack itself lists nine data conflicts to
// resolve before publishing (Part 1, "Data conflicts to resolve before
// publishing") — address, frontage, traffic count, total size, acreage scope,
// unit totals, the Apple HQ2 claim, an unsourced growth claim, and tenant
// names — and none of those are resolved here. This script writes only what
// the pack states as fact; see the per-field TODOs below for what it leaves
// out and why. Flip `published` to `true` in the admin editor once the open
// items are resolved and photography is on hand — neither record gets an
// `image` or `gallery` here, because none has been prepared or confirmed yet.
//
// Dry run by default — prints the two payloads and does nothing else.
// --commit creates whichever of the two slugs isn't already in the CMS; a
// slug that already exists is left alone (skip, not overwrite — re-run this
// safely as many times as needed).
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/create-reagan-crossing.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/create-reagan-crossing.mjs --commit
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/create-reagan-crossing.mjs --commit --with-pricing
//
// Once both exist, update-reagan-crossing-phase-1.mjs and
// update-reagan-crossing-phase-2.mjs carry the same copy forward for later
// edits (they PATCH; this script only POSTs a record into existence once).
//
// The FAQ in the pack included a "How is Phase I/II different from the
// other?" question on each page — dropped on request, same as in the two
// update-*.mjs scripts.
const COMMIT = process.argv.includes('--commit')
const WITH_PRICING = process.argv.includes('--with-pricing')
const priced = (withPrices, without) => (WITH_PRICING ? withPrices : without)
const SHOW_TENANT_NAMES = false
// The CloudFront-fronted API — confirmed live and reachable 2026-11-05.
// `prime-developers-api.onrender.com` (apps/web/.env.production's
// VITE_API_BASE_URL) 401'd on login and 500'd on every /properties call
// during that same check; this project appears to have moved its real
// backend behind CloudFront/nginx without updating that file. Worth a look
// independent of this script.
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`

const unit = (unit, type, size, salePrice, salePsf, lease, nnn, annualRent) =>
  ({ unit, type, size, salePrice, salePsf, lease, nnn, annualRent })
const cap = (unit, tenant, businessType, size, price, capRate, leaseTerm, rent, nnn) =>
  ({ unit, ...(SHOW_TENANT_NAMES ? { tenant } : {}), businessType, size, price, capRate, leaseTerm, rent, nnn })
const faq = (pairs) => pairs.map(([question, answer]) => ({ question, answer }))

// ── Phase I ──────────────────────────────────────────────────────────────
const PHASE_1_ADDRESS = '15101 Ronald Reagan Blvd, Leander, TX 78641'

const phase1Detail = (() => {
  const full = {
    kicker: 'Mixed-Use · 15101 Ronald Reagan Blvd, Leander, TX 78641',
    tagline: 'Retail, office and daycare space on a signalized corner in Leander',
    overview: {
      eyebrow: 'Premier Mixed-Use',
      heading: 'Retail, office and daycare space in Leander, plus cap rate properties for income',
      body: [
        'Reagan Crossing Phase I is a 15.69-acre mixed-use retail, office, drive-thru and daycare development at 15101 Ronald Reagan Blvd in Leander, TX, developed by The Prime Developer. It sits on the signalized corner of Ronald Reagan Blvd and Journey Parkway, the first phase of Reagan Crossing in Leander.',
        'Phase I combines 37,000 SF of medical and professional office, 45,000 SF of retail, 6,000 SF of drive-thru space and a 10,000 SF daycare. Retail space is available to buy or lease, and pad sites are open for lease. Office, retail and drive-thru space continues next door in [Reagan Crossing Phase II](/properties/reagan-crossing-phase-2).',
        `For investors, two Phase I units are already leased to operating businesses on 10-year NNN leases ${priced('at a 5.5% cap rate', 'at a fixed cap rate')}. They suit buyers looking for commercial real estate investment near Austin, or who want to buy commercial property to lease out. [See all investment properties](/investors).`,
      ].join('\n\n'),
      // Tokens resolve from the property's own unit inventory once units
      // exist on this record (see floorPlans.buildings below — empty for
      // now). "{totalUnits}"/"{availableUnits}" read as 0 until then, which
      // is correct: there is no inventory on this record yet.
      stats: [
        { value: '15.69', label: 'Acres' },
        { value: '{totalUnits}', label: 'Total units' },
        { value: '{availableUnits}', label: 'Available units' },
      ],
    },
    highlights: {
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
        // No "vehicles per day" card — the pack gives two conflicting TxDOT
        // figures (~23,000 VPD 2022 vs 18,000 VPD) and asks for one with a
        // year and source before either goes on the page.
      ],
    },
    floorPlans: {
      intro: {
        heading: 'Site overview and floor plans',
        body: 'Phase I wraps the Journey Parkway corner with retail, office, drive-thru and daycare buildings. Select a building to see its units, sizes and who is already open there.',
      },
      // Empty on purpose. The pack lists only Building 3 and flags "[add the
      // other Phase I buildings]" — this script has no unit inventory to
      // enter, and the units module (see units.js) is the single source of
      // truth for it once it does. The floor-plans section renders nothing
      // until buildings.length > 0 (PropertyDetailPage.jsx), so this is a
      // safe, honest empty state rather than a placeholder.
      buildings: [],
    },
    ...(WITH_PRICING
      ? {
          pricing: {
            units: {
              heading: 'Retail space for sale or lease',
              intro: 'Retail space starts at $956,700 to buy, or $47/SF/yr all-in to lease ($34 base + $13 NNN).',
              rows: [unit('303', 'Retail', '2,126', '$956,700', '$450', '$34', '$13', '$99,922')],
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
        }
      : {}),
    location: {
      eyebrow: 'Zoning Opportunities',
      heading: "Built for Leander's growth",
      body: [
        'Zoning covers retail, restaurants, services, daycare, office and hotel uses, so Phase I can serve families, commuters and the clinics that follow new homes. The city plans to widen Ronald Reagan Blvd to six lanes, adding capacity at the Journey Parkway corner.',
        "The phase sits in the middle of [Leander's commercial real estate growth](/leander), giving small businesses an affordable alternative to higher-priced office space closer to Austin.",
      ].join('\n\n'),
    },
    establishedSites: { heading: 'Businesses already open at Reagan Crossing Phase I' },
    neighborhoods: {
      heading: 'Nearby neighborhoods',
      intro: 'Phase I serves the fast-growing neighborhoods along Ronald Reagan Blvd in north Leander, and sits up the road from [Centro Plaza](/projects/centro-plaza).',
      mapQuery: PHASE_1_ADDRESS,
      items: [
        { name: 'Travisso', note: 'Master-planned community along Ronald Reagan Blvd.' },
        { name: 'Crystal Falls', note: 'Established Leander neighborhood with golf and parks.' },
        { name: 'Leander MetroRail Station', note: 'Commuter rail link to downtown Austin.' },
        // Drive times struck — the pack marks all three "[confirm minutes]".
      ],
    },
    videosHeading: 'See Reagan Crossing',
    // Empty — the pack flags "[confirm which phase each shows]" for both of
    // the old page's two YouTube videos, so neither is assigned here.
    videos: [],
    faqHeading: 'Reagan Crossing Phase I FAQs',
    faqs: faq([
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
      // Dropped on request: "How is Phase I different from Phase II?"
    ]),
    resourceLinks: [
      { label: 'Map', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PHASE_1_ADDRESS)}` },
      { label: 'LoopNet', url: 'https://www.loopnet.com/Listing/15101-Ronald-Reagan-Blvd-Leander-TX/37710740/' },
      // No Flyer/Floor plan PDFs — none prepared yet.
    ],
    closing: {
      body: 'Talk to The Prime Developer team about retail, office and daycare space in Leander, from pricing and availability to a site tour.',
    },
    seo: {
      title: 'Reagan Crossing Leander Phase I | Retail, Office & Daycare',
      description: 'Reagan Crossing Phase I is a 15.69-acre mixed-use site at 15101 Ronald Reagan Blvd, Leander, TX, with retail, medical office, drive-thru and daycare space.',
      ogTitle: 'Reagan Crossing Leander Phase I | Retail, Office & Daycare',
      ogDescription: 'Retail, medical office, drive-thru and daycare space at Ronald Reagan Blvd and Journey Parkway, Leander TX.',
      twitterDescription: 'Retail, office, drive-thru and daycare space on Ronald Reagan Blvd, Leander TX.',
      // No ogImage/heroAlt image fields — no photography uploaded yet.
      geoRegion: 'US-TX',
      geoPlacename: 'Leander',
      // No latitude/longitude — ungeocoded; usePropertyHead and
      // propertySchema both gate on Number.isFinite, so omitting these
      // simply drops geo.position/hasMap from the page rather than planting
      // a guessed coordinate.
      placeDescription: '15.69-acre first phase of Reagan Crossing with 37,000 SF of medical and professional office, 45,000 SF of retail, 6,000 SF of drive-thru space and a 10,000 SF daycare.',
      amenities: ['On-site parking', 'Signalized intersection at Journey Parkway', 'Drive-thru space', 'Daycare on site'],
    },
  }
  return full
})()

const PHASE_1 = {
  name: 'Reagan Crossing Phase I',
  slug: 'reagan-crossing-phase-1',
  address: PHASE_1_ADDRESS,
  category: 'Retail',
  // Left at 0 rather than guessed — the pack flags unit totals/availability
  // as unresolved (one source needed; the old page's own counter showed 0).
  // `detail.specs` below overrides what the properties-grid card shows in
  // the meantime (see specsFor() in PropertiesPage.jsx), so the card still
  // reads sensibly rather than "0 units · 0 reserved · 0 available".
  buildings: 0,
  sold: 0,
  available: 0,
  published: false,
  detail: { ...phase1Detail, specs: ['15.69 acres', 'Retail · Office · Daycare', 'Signalized corner'] },
}

// ── Phase II ─────────────────────────────────────────────────────────────
// Same address as Phase I. The pack's own recommendation (Part 1, "Data
// conflicts"): "Use 15101 for the development; confirm whether Phase II has
// its own address" — both old pages agreed on 15101; only the Phase II
// LoopNet listing disagrees, at 15301. Not resolved here; flagged, not guessed.
const PHASE_2_ADDRESS = PHASE_1_ADDRESS

const phase2Detail = (() => {
  const full = {
    kicker: 'Mixed-Use · Ronald Reagan Blvd at Journey Pkwy, Leander, TX 78641',
    tagline: 'Offices to own, ground-floor retail and drive-thru space in Leander',
    overview: {
      eyebrow: 'Modern Office & Retail',
      heading: 'Medical and professional offices, retail and drive-thru space in Leander',
      body: [
        'Reagan Crossing Phase II is a mixed-use office, retail and drive-thru development on Ronald Reagan Blvd at Journey Parkway in Leander, TX, developed by The Prime Developer. It is the second phase of Reagan Crossing, next to [Reagan Crossing Phase I](/properties/reagan-crossing-phase-1).',
        `The buildings stack 21,000 SF of ground-floor retail under 21,000 SF of medical and professional offices, with 12,000 SF of drive-thru space and more than 269 parking spaces. ${priced('Offices start at $550,120 to buy', 'Offices are available to buy')}, a rare chance to own office space in [Leander](/leander) instead of renting.`,
        `Four Phase II units are already leased on 10-year NNN leases ${priced('at a 5.5% cap rate, from $997,364', 'at a fixed cap rate')}. They are [cap rate properties](/investors) for buyers who want an NNN investment property in the Austin area with a tenant in place.`,
      ].join('\n\n'),
      stats: [
        { value: '21,000', label: 'SF retail' },
        { value: '{totalUnits}', label: 'Total units' },
        { value: '{availableUnits}', label: 'Available units' },
      ],
    },
    highlights: {
      heading: 'Office and drive-thru space on Ronald Reagan Blvd',
      body: 'Phase II gives medical, dental and professional firms upstairs offices they can own, above retail and drive-thru tenants that bring daily traffic. The corner sits at the signalized Journey Parkway intersection.',
      bigStats: [
        { value: '12,000', label: 'SF drive-thru' },
        { value: '269', label: 'Parking spaces' },
      ],
      cards: [
        { title: 'Own your office', body: priced(
          'Offices from $550,120 ($340/SF), or lease from $42/SF/yr all-in.',
          'Offices to own or lease, above ground-floor retail.',
        ) },
        { title: 'Drive-thru ready', body: '12,000 SF of drive-thru space for coffee, food and quick-service brands.' },
        { title: 'Parking', body: 'More than 269 spaces shared across the buildings.' },
      ],
    },
    floorPlans: {
      intro: {
        heading: 'Site overview and floor plans',
        body: 'Phase II is four buildings, 9 to 12, with retail on the ground floor and offices above. Select a building to see its units, sizes and who is already open there.',
      },
      buildings: [],
    },
    ...(WITH_PRICING
      ? {
          pricing: {
            units: {
              heading: 'Office and retail units for sale or lease',
              intro: 'Offices start at $550,120 to buy, or $42/SF/yr all-in to lease ($32 base + $10 NNN).',
              rows: [
                unit('1109', 'Office', '1,618', '$550,120', '$340', '$32', '$10', '$67,956'),
                unit('1216', 'Office', '1,618', '$550,120', '$340', '$32', '$10', '$67,956'),
                unit('1209', 'Office', '2,067', '$702,780', '$340', '$32', '$10', '$86,814'),
                unit('1116', 'Office', '2,109', '$843,600', '$400', '$34', '$10', '$92,796'),
                unit('902 A', 'Retail', '1,276', '$701,800', '$550', '$38', '$13', '$65,076'),
              ],
            },
            capRate: {
              heading: 'Cap rate investment properties',
              intro: 'Own an income-producing unit with a tenant already in place. These units pay 5.5% on 10-year leases, and the tenants pay the NNN costs. [See all investment properties](/investors).',
              showTenantNames: SHOW_TENANT_NAMES,
              rows: [
                cap('902-B', "Jeremiah's Ice Cream", 'Ice cream shop', '1,219', '$997,364', '5.50%', '10 yrs', '$54,855', '$15,847'),
                cap('1108', 'Smoke Shop', 'Specialty retail', '1,968', '$1,145,018', '5.50%', '10 yrs', '$62,976', '$25,584'),
                cap('1201', 'Shrishti USA', 'Specialty retail', '1,927', '$1,226,273', '5.50%', '10 yrs', '$67,445', '$25,051'),
                cap('1101, 1102', 'Fion Liquor', 'Liquor store', '2,834', '$1,648,873', '5.50%', '10 yrs', '$90,688', '$36,842'),
              ],
            },
          },
        }
      : {}),
    location: {
      eyebrow: 'Location & Amenities',
      heading: 'A family-friendly corner of Leander',
      body: 'Phase II gives small professional firms an affordable place to own an office close to home. Families from the surrounding neighborhoods already use the daycare and shops in Phase I next door.',
      // The old page's "fastest-growing" and "12-minute drive from Apple
      // HQ2" claims are both dropped — the pack asks for a Census/City of
      // Leander source on the first and a verified drive time on the
      // second, and neither is supplied here.
    },
    establishedSites: { heading: 'Businesses already open at Reagan Crossing Phase II' },
    neighborhoods: {
      heading: 'Near Indigo Ridge',
      mapQuery: 'Ronald Reagan Blvd at Journey Pkwy, Leander, TX 78641',
      items: [
        { name: 'Indigo Ridge', note: 'Residential community nearby.' },
        { name: 'Reagan Crossing Phase I', note: 'Daycare, retail and drive-thru on the same corner.' },
        { name: 'Leander MetroRail Station', note: 'Commuter rail link to downtown Austin.' },
        // "2.7 miles" for Indigo Ridge and the MetroRail drive time are both
        // marked "[confirm]" in the pack — left off the card copy.
      ],
    },
    videosHeading: 'See Reagan Crossing',
    videos: [],
    faqHeading: 'Reagan Crossing Phase II FAQs',
    faqs: faq([
      ['Where is Reagan Crossing Phase II?', 'Reagan Crossing Phase II is on Ronald Reagan Blvd at Journey Parkway, Leander, TX 78641, next to Reagan Crossing Phase I.'],
      ['What is in Reagan Crossing Phase II?', 'Phase II has 21,000 SF of ground-floor retail, 21,000 SF of medical and professional office upstairs and 12,000 SF of drive-thru space, with more than 269 parking spaces.'],
      ['Can I lease or buy space at Reagan Crossing Phase II?', priced(
        'Both. Office units sell from $550,120 ($340/SF) and lease from $32/SF/yr plus $10 NNN. Retail unit 902 A sells for $701,800 or leases at $38/SF/yr plus $13 NNN.',
        'Both. Office and ground-floor retail are available to buy or lease. Contact the team for current pricing.',
      )],
      ['Does Reagan Crossing Phase II have drive-thru space?', 'Yes. Phase II includes 12,000 SF of drive-thru space, and pad sites are available for lease.'],
      ['Can I buy a leased investment property at Reagan Crossing Phase II?', priced(
        'Yes. Four leased units are for sale at a 5.5% cap rate on 10-year NNN leases, priced from $997,364 to $1,648,873.',
        'Yes. Leased units are for sale to investors on NNN terms. Contact the team for current pricing.',
      )],
      ['How do I book a tour of Reagan Crossing Phase II?', 'Use the Enquire form or message The Prime Developer on WhatsApp at +1 512-761-8025.'],
      // Dropped on request: "How is Phase II different from Phase I?"
    ]),
    resourceLinks: [
      { label: 'Map', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PHASE_2_ADDRESS)}` },
      { label: 'LoopNet', url: 'https://www.loopnet.com/Listing/15301-Ronald-Reagan-Blvd-Leander-TX/35365268/' },
    ],
    closing: {
      body: 'Talk to The Prime Developer team about owning or leasing office, retail and drive-thru space in Leander, from pricing to a site tour.',
    },
    seo: {
      title: 'Reagan Crossing Phase II Leander | Office, Retail & Drive-Thru',
      description: 'Reagan Crossing Phase II in Leander, TX has office units for sale from $550,120, ground-floor retail and 12,000 SF of drive-thru space on Ronald Reagan Blvd.',
      ogTitle: 'Reagan Crossing Phase II Leander | Office, Retail & Drive-Thru',
      ogDescription: 'Medical and professional offices for sale, ground-floor retail and 12,000 SF of drive-thru space on Ronald Reagan Blvd, Leander TX.',
      twitterDescription: 'Offices for sale, retail and drive-thru space on Ronald Reagan Blvd, Leander TX.',
      geoRegion: 'US-TX',
      geoPlacename: 'Leander',
      placeDescription: 'Second phase of Reagan Crossing with 21,000 SF of ground-floor retail, 21,000 SF of medical and professional office upstairs and 12,000 SF of drive-thru space.',
      amenities: ['On-site parking (269+ spaces)', 'Drive-thru space (12,000 SF)', 'Signalized intersection at Journey Parkway'],
    },
  }
  return full
})()

const PHASE_2 = {
  name: 'Reagan Crossing Phase II',
  slug: 'reagan-crossing-phase-2',
  address: PHASE_2_ADDRESS,
  category: 'Retail',
  buildings: 0,
  sold: 0,
  available: 0,
  published: false,
  detail: { ...phase2Detail, specs: ['4 buildings', 'Office · Retail · Drive-thru', 'Signalized corner'] },
}

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
  if (!res.ok && res.status !== 404) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  if (res.status === 404) return null
  return body ? JSON.parse(body) : null
}

const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})

for (const record of [PHASE_1, PHASE_2]) {
  const existing = await call(`/admin/properties/${record.slug}`, { token })
  if (existing) {
    console.log(`${record.slug}: already exists (id ${existing.id}, updatedAt ${existing.updatedAt}) — skipped, not overwritten.`)
    continue
  }
  console.log(`${record.slug}: not found — will create.`)
  console.log(JSON.stringify(record, null, 2))

  if (!COMMIT) {
    console.log(`\n${record.slug}: dry run — nothing created. Re-run with --commit.\n`)
    continue
  }

  const created = await call('/admin/properties', {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  console.log(`${record.slug}: created, id ${created.id}, published=${created.published}\n`)
}
