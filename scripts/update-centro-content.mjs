// Apply the Centro Plaza page copy, SEO fields, pricing and Drive photography
// from the 2026-10 content handoff (centro-plaza-claude-code-handoff.md).
//
// Through the live API, as an admin — not Supabase. The site reads the AWS
// copy (RDS `prime_website`); Supabase is only the source the one-off
// migration copied from, and scripts/aws/03-copy-content.sh would *replace*
// RDS from it, wiping every admin edit since. So this logs in, uploads the
// images through /uploads/image (they land in the S3 media bucket like any
// admin upload) and saves with PATCH /admin/properties/:id, carrying
// `expectedUpdatedAt` so it refuses to overwrite an edit made meanwhile.
//
// Merges into the live record rather than replacing it. Untouched on purpose:
// floorPlans.buildings (the unit inventory — Prime Tracker owns it, see
// sync-centro-from-tracker.mjs), siteModel, socials, tenants and the headline
// totals. Writes a backup of the record before committing.
//
// Values the handoff marks unconfirmed are left out, not guessed:
//   TODO: geo coordinates (seo.latitude / seo.longitude) → enables geo.position, `geo` and `hasMap`
//   TODO: tenant names in pricing.capRate need sign-off → SHOW_TENANT_NAMES stays false
//   TODO: "23,000 vehicles a day on US 183" needs confirming (unchanged from the old copy)
//   TODO: /cedar-park and /leander don't exist yet, so those anchors are plain text
//   TODO: tenant logos (detail.tenants) are still empty — no logo files on hand
//
//   PHOTO_DIR=<dir> PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-centro-content.mjs
//   PHOTO_DIR=<dir> PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-centro-content.mjs --commit
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMIT = process.argv.includes('--commit')
// The Rate Master tables list units Prime Tracker has as sold (902, 904, 401,
// 402, 404) or doesn't have at all (619, 1001, 1002), and cap rate deals the
// CAP listings mark sold / under contract. Held back until the client confirms;
// `--with-pricing` sends them.
const WITH_PRICING = process.argv.includes('--with-pricing')
// Copy that quotes those figures has to be held back with them — the FAQ
// answers also become FAQPage markup — so each such line carries a
// price-free version for the default run.
const priced = (withPrices, without) => (WITH_PRICING ? withPrices : without)
// Tenant names need the client's sign-off before they go public. The page only
// shows them when `showTenantNames` is on, but the whole record reaches the
// browser, so until then the names are left out of it rather than hidden.
const SHOW_TENANT_NAMES = false
const SLUG = 'centro-plaza'
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`
const ADDRESS = '14300 Ronald Reagan Blvd, Leander, TX 78641'
const PHOTOS = 'https://dtw8rs0oq8bpp.cloudfront.net/media/images/projects/centro-plaza/drive/buildings'

// Full-resolution exports of the Building 1 shoot from the client's Drive
// (LCA Visual Studio, Buildings/Building_01) — the same three photographs the
// page already showed at 2560px from the first drop, re-exported as WebP at
// 2560px with EXIF stripped, plus a 1200×630 crop of the frontage for the
// social card. PHOTO_DIR holds them under these names.
const FILES = {
  hero: 'centro-plaza-cedar-park-exterior.webp',
  frontage: 'centro-plaza-retail-frontage-ronald-reagan-blvd.webp',
  corner: 'centro-plaza-building-1-corner.webp',
  og: 'centro-plaza-og-1200x630.jpg',
}
const FOLDER = 'projects/centro-plaza/drive/buildings/building-01'

const FAQS = [
  ['Where is Centro Plaza?', '14300 Ronald Reagan Blvd, Leander, TX 78641, in the Cedar Park area. It is one mile north of the Ronald Reagan Blvd and RM 1431 intersection.'],
  ['Can I lease or buy space at Centro Plaza?', priced(
    'Both. Office units sell from $340/SF (from $421,260) and lease from $32/SF/yr plus $10 NNN. Retail space leases from $34/SF/yr plus $13 NNN. Leased cap rate units are also for sale from $510,883.',
    'Both. Office units are available to buy or lease, retail space is available to lease, and leased cap rate units are for sale to investors. Contact the team for current pricing.',
  )],
  ['What businesses can operate at Centro Plaza?', 'Zoning allows retail, restaurant, service, medical and office uses.'],
  ['What size spaces are available?', 'The plan includes four 8,000 SF retail buildings and six office buildings from 2,000 to 26,000 SF. Individual units vary by building.'],
  ['How big is the development?', 'Centro Plaza covers 15 acres with about 150,638 SF of buildings and 753 ft of frontage on Ronald Reagan Blvd.'],
  ['Is there parking?', 'Yes, every building has on-site parking.'],
  ['How do I book a tour?', 'Use the Enquire form or message the team on WhatsApp at +1 512-761-8025.'],
].map(([question, answer]) => ({ question, answer }))

const unit = (unit, type, size, salePrice, salePsf, lease, nnn, annualRent) =>
  ({ unit, type, size, salePrice, salePsf, lease, nnn, annualRent })
const cap = (unit, tenant, businessType, size, price, capRate, leaseTerm, rent, nnn) =>
  ({ unit, ...(SHOW_TENANT_NAMES ? { tenant } : {}), businessType, size, price, capRate, leaseTerm, rent, nnn })

// `img` maps each of FILES to its uploaded URL.
const patch = (detail, img) => {
  const { pricing, ...rest } = fullPatch(detail, img)
  return WITH_PRICING ? { ...rest, pricing } : rest
}

const fullPatch = (detail, img) => ({
  kicker: 'Mixed-Use · 14300 Ronald Reagan Blvd, Leander, TX 78641 · Cedar Park area',
  tagline: 'Retail and office space on Ronald Reagan Blvd, minutes from Cedar Park',
  // The property-page hero only: `property.image` stays as it is, so listing
  // cards elsewhere are unaffected.
  covers: { ...detail.covers, detailHero: img.hero },
  overview: {
    ...detail.overview,
    eyebrow: 'Premier Mixed-Use',
    heading: 'Retail and office space on Ronald Reagan Blvd, plus cap rate properties for income',
    body: [
      'Centro Plaza is a 15-acre mixed-use development at 14300 Ronald Reagan Blvd in Leander, TX, on the corridor that links Cedar Park and Liberty Hill. The site has 753 feet of frontage on Ronald Reagan Blvd, giving every building strong visibility and signage to passing traffic.',
      'The plan combines front-row retail with office buildings behind, so restaurants, shops, clinics and professional firms can share one address. Spaces are available to buy or lease, and the growth around Cedar Park and North Austin keeps demand for both rising.',
      // /investors doesn't exist; /cap-properties is the site's list of investment properties.
      `For investors, Centro Plaza has four cap rate properties available now: units already leased to operating businesses, so rent comes in from day one. ${priced(
        'Prices start at $510,883, with cap rates of 5.5% to 6.25% and leases of 5 to 15 years on NNN terms.',
        'The leases run on NNN terms, so tenants cover the operating costs.',
      )} They suit buyers looking for commercial real estate investment near Austin, or who want to buy commercial property to lease out and earn steady income. [See all investment properties](/cap-properties).`,
    ].join('\n\n'),
    // Tokens resolve to the same tracker totals as the hero's availability strip.
    stats: [
      { value: '150,638', label: 'SF project size' },
      { value: '{totalUnits}', label: 'Total units' },
      { value: '{availableUnits}', label: 'Available units' },
    ],
  },
  highlights: {
    ...detail.highlights,
    heading: 'Retail space for lease near Cedar Park, built for growth',
    body: 'Centro Plaza sits one mile north of the Ronald Reagan Blvd and RM 1431 intersection, one of the busiest crossroads between Cedar Park and Leander. Zoning allows retail, dining, services, medical and office uses, so businesses can open where new rooftops and traffic are already arriving.',
    bigStats: [
      { value: '57,776+', label: 'SF office space' },
      { value: '46,632+', label: 'SF retail space' },
    ],
    cards: [
      { title: 'Own or lease', body: priced(
        'Office units from $421,260 to buy, or lease from $42/SF/yr all-in.',
        'Office units to buy or lease, and retail space to lease on Ronald Reagan Blvd.',
      ) },
      { title: 'High traffic', body: 'More than 23,000 vehicles a day pass on nearby US 183.' },
      { title: 'Strong demographics', body: 'Fast-growing households and incomes across Cedar Park, Leander and North Austin.' },
      { title: 'Flexible zoning', body: 'Approved for retail, restaurant, medical, service and office uses.' },
    ],
  },
  floorPlans: {
    ...detail.floorPlans,
    intro: {
      heading: 'Site overview and floor plans',
      body: 'Centro Plaza is planned as ten buildings: retail along Ronald Reagan Blvd and office space behind it. Select a building to see its units, sizes and who is already open there.',
    },
  },
  pricing: {
    units: {
      heading: 'Units for sale or lease',
      intro: 'Office units start at $421,260 to buy, or $42/SF/yr all-in to lease ($32 base + $10 NNN). Retail space for lease starts at $47/SF/yr all-in ($34 base + $13 NNN), with units from 1,296 to 1,624 SF.',
      rows: [
        unit('1002', 'Office', '1,239', '$421,260', '$340', '$32', '$10', '$52,038'),
        unit('1001', 'Office', '1,421', '$483,140', '$340', '$32', '$10', '$59,682'),
        unit('904', 'Office', '1,452', '$580,800', '$400', '$34', '$10', '$63,888'),
        unit('902', 'Retail', '1,624', '$649,600', '$400', '$34', '$13', '$76,328'),
        unit('619', 'Office', '2,037', '$692,580', '$340', '$32', '$10', '$85,554'),
        unit('401', 'Retail', '1,296', 'Lease only', '—', '$34', '$13', '$60,912'),
        unit('402', 'Retail', '1,468', 'Lease only', '—', '$34', '$13', '$68,996'),
        unit('404', 'Retail', '1,509', 'Lease only', '—', '$34', '$13', '$70,923'),
      ],
    },
    capRate: {
      heading: 'Cap rate investment properties',
      intro: "Own an income-producing unit with a tenant already in place. Centro Plaza's cap rate properties pay 5.5% to 6.25% on leases of up to 15 years, and the tenants pay the NNN costs.",
      showTenantNames: SHOW_TENANT_NAMES,
      rows: [
        cap('605', 'Kids Activity Studio', 'Kids activity studio', '1,057', '$510,883', '6.00%', '15 yrs', '$30,653', '$13,741'),
        cap('103', 'Mughda Dallas', 'Boutique retail', '1,511', '$934,073', '5.50%', '15 yrs', '$51,374', '$19,643'),
        cap('201, 202', 'Devi Liquor', 'Liquor store', '2,763', '$1,414,656', '6.25%', '5 yrs', '$88,416', '$35,919'),
        cap('203, 204', 'BrickerZ Club', 'Entertainment club', '3,020', '$1,702,182', '5.50%', '10 yrs', '$93,620', '$39,260'),
      ],
    },
  },
  location: {
    ...detail.location,
    eyebrow: 'Zoning Opportunities',
    heading: 'Prime opportunity in a fast-growing zone',
    sub: '',
    body: [
      'The master plan calls for ten build-to-suit buildings. Four 8,000 SF retail buildings face Ronald Reagan Blvd, and six office buildings from 2,000 to 26,000 SF sit behind them. Zoning covers retail, restaurants, services, medical and office, so the mix can serve both tenants and owner-users.',
      "The site is about 8 miles north of Apple's Austin campus and 6 miles south of a new H-E-B development. It sits in the middle of Leander's commercial real estate growth, where new homes are pulling retail and services north from Cedar Park.",
    ].join('\n\n'),
  },
  establishedSites: { ...detail.establishedSites, heading: 'Businesses already open at Centro Plaza' },
  neighborhoods: {
    heading: 'Between Cedar Park, Leander and Liberty Hill',
    intro: 'Ronald Reagan Blvd is the main north–south route between Cedar Park and Liberty Hill. Centro Plaza puts businesses close to new neighborhoods, schools and shopping on both sides of the city line. Need office space for lease in Leander? This is one of the few new options on the corridor.',
    mapQuery: ADDRESS,
    items: [
      { name: 'Lakeline Mall, Cedar Park', note: 'Regional shopping and dining hub a short drive south.' },
      { name: 'H-E-B Center at Cedar Park', note: 'Arena and events venue that draws visitors from across the region.' },
      { name: 'Austin Community College San Gabriel Campus, Leander', note: 'Growing college campus serving Leander and Liberty Hill.' },
      { name: 'Leander MetroRail Station', note: 'Commuter rail link to downtown Austin.' },
    ],
  },
  videosHeading: 'See Centro Plaza',
  videos: (detail.videos ?? []).map((v, i) => ({ ...v, title: v.title || `Centro Plaza video ${i + 1}` })),
  faqHeading: 'Centro Plaza FAQs',
  faqs: FAQS,
  resourceLinks: (detail.resourceLinks ?? []).map((link) => {
    if (link.label === 'Location') return { ...link, label: 'Map' }
    if (/loopnet/i.test(link.label)) {
      return { ...link, label: 'LoopNet', url: 'https://www.loopnet.com/Listing/14300-Ronald-W-Reagan-Blvd-Leander-TX/37592604/' }
    }
    return link
  }),
  closing: {
    body: 'Talk to The Prime Developer team about retail and office space on Ronald Reagan Blvd, from pricing and availability to a site tour.',
  },
  seo: {
    title: 'Centro Plaza Cedar Park | Retail & Office Space | The Prime Developer',
    description: 'Centro Plaza is a 15-acre mixed-use development at 14300 Ronald Reagan Blvd, near Cedar Park, TX. Retail and office space for lease or sale. Enquire today.',
    ogTitle: 'Centro Plaza Cedar Park | Retail & Office Space',
    ogDescription: '15-acre mixed-use development on Ronald Reagan Blvd with retail and office space for lease or sale.',
    twitterDescription: '15-acre mixed-use development on Ronald Reagan Blvd. Units to lease or buy.',
    ogImage: img.og,
    ogImageAlt: 'Centro Plaza retail storefronts on Ronald Reagan Blvd, Cedar Park area, TX',
    heroAlt: 'Centro Plaza retail storefronts on Ronald Reagan Blvd, Cedar Park area, TX',
    geoRegion: 'US-TX',
    geoPlacename: 'Leander',
    placeDescription: '15-acre mixed-use retail and office development with 753 ft of frontage on Ronald Reagan Blvd, zoned for retail, restaurant, medical, service and office uses.',
    amenities: ['On-site parking', 'Ronald Reagan Blvd frontage (753 ft)'],
  },
  // Written from the photographs themselves. Stored as values, not URL keys —
  // see imageAlt() in apps/web/src/lib/images.js.
  imageAlts: [
    { src: img.hero, alt: 'Centro Plaza retail storefronts on Ronald Reagan Blvd, Cedar Park area, TX' },
    { src: `${PHOTOS}/building-01/LcaVisualStudios-2.jpg`, alt: 'Centro Plaza retail storefronts on Ronald Reagan Blvd, Cedar Park area, TX' },
    { src: `${PHOTOS}/centro-plaza-name-boards/LcaVisualStudios-6.jpg`, alt: 'Centro Plaza monument sign at 14300 Ronald Reagan Blvd in front of retail storefronts' },
    { src: img.corner, alt: 'Brick corner unit of Building 1 at Centro Plaza, Leander TX' },
    { src: img.frontage, alt: 'Building 1 retail frontage at Centro Plaza on Ronald Reagan Blvd' },
  ],
})

// The two gallery frames the Drive exports replace, one for one. The third
// (LcaVisualStudios-2) is `property.image` and stays, for the listing cards.
const swapGallery = (gallery, img) => {
  const swap = {
    [`${PHOTOS}/building-01/LcaVisualStudios.jpg`]: img.frontage,
    [`${PHOTOS}/building-01/LcaVisualStudios-4.jpg`]: img.corner,
  }
  return (gallery ?? []).map((src) => swap[src] ?? src)
}

// ── API ──────────────────────────────────────────────────────────────────────
const email = process.env.PRIME_ADMIN_EMAIL
const password = process.env.PRIME_ADMIN_PASSWORD
const PHOTO_DIR = process.env.PHOTO_DIR ?? ''
if (!email || !password) throw new Error('Set PRIME_ADMIN_EMAIL and PRIME_ADMIN_PASSWORD (an admin login for the site)')
if (!PHOTO_DIR) throw new Error('Set PHOTO_DIR to the directory holding the prepared images')
for (const name of Object.values(FILES)) readFileSync(join(PHOTO_DIR, name)) // fail before logging in

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

const placeholder = Object.fromEntries(Object.keys(FILES).map((k) => [k, `<upload: ${FILES[k]}>`]))
const preview = patch(property.detail ?? {}, placeholder)
const previewGallery = swapGallery(property.gallery, placeholder)

console.log(`${SLUG} (updatedAt ${property.updatedAt})`)
console.log(`  address: ${JSON.stringify(property.address)} → ${JSON.stringify(ADDRESS)}`)
console.log(`  gallery: ${previewGallery.filter((src, i) => src !== property.gallery[i]).length} of 2 photo(s) to swap for the Drive exports`)
for (const k of Object.keys(preview)) {
  const before = JSON.stringify(property.detail?.[k] ?? null)
  const after = JSON.stringify(preview[k])
  console.log(`  detail.${k}: ${before === after ? 'unchanged' : before === 'null' ? 'added' : 'changed'}`)
}

if (!COMMIT) {
  console.log('\nDry run — nothing uploaded or written. Re-run with --commit.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `centro-plaza-content-backup-${stamp}.json`
writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))
console.log(`\nbacked up previous state to ${backup}`)

const img = {}
for (const [key, name] of Object.entries(FILES)) {
  const form = new FormData()
  form.append('folder', FOLDER)
  const type = name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  form.append('file', new Blob([readFileSync(join(PHOTO_DIR, name))], { type }), name)
  img[key] = (await call('/uploads/image', { token, method: 'POST', body: form })).url
  console.log(`uploaded ${name} → ${img[key]}`)
}

await call(`/admin/properties/${property.id}`, {
  token,
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: ADDRESS,
    gallery: swapGallery(property.gallery, img),
    detail: { ...property.detail, ...patch(property.detail ?? {}, img) },
    expectedUpdatedAt: property.updatedAt,
  }),
})

console.log('Saved — Centro Plaza carries the handoff copy and the Drive photography.')
