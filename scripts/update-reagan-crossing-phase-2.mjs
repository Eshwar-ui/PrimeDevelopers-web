// Apply the Reagan Crossing Phase II page copy, SEO fields, pricing and FAQs
// from Reagan_Crossing_SEO_AEO_GEO_Page_Pack.docx, Part 3 (repo root).
//
// Same pattern as update-reagan-crossing-phase-1.mjs and
// update-centro-content.mjs — see that file's header for the login/PATCH/
// dry-run mechanics. Dry run by default; --commit to write.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-reagan-crossing-phase-2.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-reagan-crossing-phase-2.mjs --commit
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-reagan-crossing-phase-2.mjs --with-pricing
//
// Merges into the live record rather than replacing it. Untouched on purpose:
// address, floorPlans.buildings (the unit inventory), covers, gallery,
// siteModel, tenants (the logo strip) and seo.latitude/longitude — see
// update-reagan-crossing-phase-1.mjs's header for why.
//
// Left out of this pass, same reasoning as Phase I's script:
//   TODO: Phase II's own street address — the pack has two addresses in play
//         (15101 on both old pages, 15301 on the Phase II LoopNet listing)
//         and asks to confirm whether Phase II has one of its own before
//         publishing. Not set here; the record keeps whatever it already has.
//   TODO: frontage split, traffic count/year/source, total development size,
//         unit totals/availability (hero counter), lat/long and Maps URL —
//         same open items as Phase I, see that script's header
//   TODO: which YouTube video shows this phase
//   TODO: the Apple HQ2 "12-minute drive" claim and the unsourced
//         "fastest-growing" claim — the pack says drop or source both; this
//         script drops both rather than guess a source
//   TODO: Indigo Ridge's distance in minutes ("2.7 miles, confirm")
//   TODO: tenant names on "businesses already open" — reads live unit data,
//         untouched by this script, so nothing here needs sign-off
//
// The FAQ in the pack included "How is Phase II different from Phase I?" —
// dropped here on request, same as Phase I's script.
import { writeFileSync } from 'node:fs'

const COMMIT = process.argv.includes('--commit')
// Rate Master pricing. Held back until the client confirms unit-to-phase
// assignment (the pack infers it from unit numbers: 900s/1100s/1200s =
// Buildings 9/11/12) and cap-rate tenant names; `--with-pricing` sends both
// tables.
const WITH_PRICING = process.argv.includes('--with-pricing')
const priced = (withPrices, without) => (WITH_PRICING ? withPrices : without)
const SHOW_TENANT_NAMES = false
const SLUG = 'reagan-crossing-phase-2'
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`

const FAQS = [
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
  // Dropped on request: "How is Reagan Crossing Phase II different from
  // Phase I?" — mirrors the same removal in update-reagan-crossing-phase-1.mjs.
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
  kicker: 'Mixed-Use · Ronald Reagan Blvd at Journey Pkwy, Leander, TX 78641',
  tagline: 'Offices to own, ground-floor retail and drive-thru space in Leander',
  overview: {
    ...detail.overview,
    eyebrow: 'Modern Office & Retail',
    heading: 'Medical and professional offices, retail and drive-thru space in Leander',
    body: [
      'Reagan Crossing Phase II is a mixed-use office, retail and drive-thru development on Ronald Reagan Blvd at Journey Parkway in Leander, TX, developed by The Prime Developer. It is the second phase of Reagan Crossing, next to [Reagan Crossing Phase I](/properties/reagan-crossing-phase-1).',
      `The buildings stack 21,000 SF of ground-floor retail under 21,000 SF of medical and professional offices, with 12,000 SF of drive-thru space and more than 269 parking spaces. ${priced(
        'Offices start at $550,120 to buy',
        'Offices are available to buy',
      )}, a rare chance to own office space in [Leander](/leander) instead of renting.`,
      `Four Phase II units are already leased on 10-year NNN leases ${priced('at a 5.5% cap rate, from $997,364', 'at a fixed cap rate')}. They are [cap rate properties](/investors) for buyers who want an NNN investment property in the Austin area with a tenant in place.`,
    ].join('\n\n'),
    // Tokens resolve from the property's own unit inventory — not guessed.
    stats: [
      { value: '21,000', label: 'SF retail' },
      { value: '{totalUnits}', label: 'Total units' },
      { value: '{availableUnits}', label: 'Available units' },
    ],
  },
  highlights: {
    ...detail.highlights,
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
      // "Visibility" card dropped — the pack pairs it with a vehicle count
      // the Phase I pack already flags as two conflicting TxDOT figures, and
      // this card repeats the same unconfirmed number rather than a new one.
    ],
  },
  floorPlans: {
    ...detail.floorPlans,
    intro: {
      heading: 'Site overview and floor plans',
      body: 'Phase II is four buildings, 9 to 12, with retail on the ground floor and offices above. Select a building to see its units, sizes and who is already open there.',
    },
    // `buildings` untouched — unit inventory, Prime Tracker owns it.
  },
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
  location: {
    ...detail.location,
    eyebrow: 'Location & Amenities',
    heading: 'A family-friendly corner of Leander',
    sub: '',
    body: [
      'Phase II gives small professional firms an affordable place to own an office close to home. Families from the surrounding neighborhoods already use the daycare and shops in Phase I next door.',
      // The old page's "fastest-growing" and "12-minute drive from Apple
      // HQ2" claims are dropped: the pack asks for a Census/City of Leander
      // source on the first and a verified drive time on the second, and
      // this script does not supply either.
    ].join('\n\n'),
  },
  establishedSites: { ...detail.establishedSites, heading: 'Businesses already open at Reagan Crossing Phase II' },
  neighborhoods: {
    heading: 'Near Indigo Ridge',
    intro: '',
    mapQuery: 'Ronald Reagan Blvd at Journey Pkwy, Leander, TX 78641',
    items: [
      { name: 'Indigo Ridge', note: 'Residential community nearby.' },
      { name: 'Reagan Crossing Phase I', note: 'Daycare, retail and drive-thru on the same corner.' },
      { name: 'Leander MetroRail Station', note: 'Commuter rail link to downtown Austin.' },
      // "2.7 miles" for Indigo Ridge and the MetroRail drive time are both
      // marked "[confirm]" in the pack and left off the card copy.
    ],
  },
  videosHeading: 'See Reagan Crossing',
  // `videos` untouched — same "[confirm which phase each shows]" flag as
  // Phase I's script.
  videos: detail.videos ?? [],
  faqHeading: 'Reagan Crossing Phase II FAQs',
  faqs: FAQS,
  resourceLinks: (detail.resourceLinks ?? []).map((link) => {
    if (link.label === 'Location') return { ...link, label: 'Map' }
    if (/loopnet/i.test(link.label)) {
      return { ...link, label: 'LoopNet', url: 'https://www.loopnet.com/Listing/15301-Ronald-Reagan-Blvd-Leander-TX/35365268/' }
    }
    return link
  }),
  closing: {
    body: 'Talk to The Prime Developer team about owning or leasing office, retail and drive-thru space in Leander, from pricing to a site tour.',
  },
  seo: {
    title: 'Reagan Crossing Phase II Leander | Office, Retail & Drive-Thru',
    description: 'Reagan Crossing Phase II in Leander, TX has office units for sale from $550,120, ground-floor retail and 12,000 SF of drive-thru space on Ronald Reagan Blvd.',
    ogTitle: 'Reagan Crossing Phase II Leander | Office, Retail & Drive-Thru',
    ogDescription: 'Medical and professional offices for sale, ground-floor retail and 12,000 SF of drive-thru space on Ronald Reagan Blvd, Leander TX.',
    twitterDescription: 'Offices for sale, retail and drive-thru space on Ronald Reagan Blvd, Leander TX.',
    ogImageAlt: 'Reagan Crossing Phase II office and retail buildings, Ronald Reagan Blvd, Leander TX',
    heroAlt: 'Reagan Crossing Phase II office and retail buildings, Ronald Reagan Blvd, Leander TX',
    geoRegion: 'US-TX',
    geoPlacename: 'Leander',
    // latitude/longitude intentionally not set — see the untouched-fields
    // note at the top.
    placeDescription: 'Second phase of Reagan Crossing with 21,000 SF of ground-floor retail, 21,000 SF of medical and professional office upstairs and 12,000 SF of drive-thru space.',
    amenities: ['On-site parking (269+ spaces)', 'Drive-thru space (12,000 SF)', 'Signalized intersection at Journey Parkway'],
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
const backup = `reagan-crossing-phase-2-content-backup-${stamp}.json`
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

console.log('Saved — Reagan Crossing Phase II carries the page-pack copy.')
