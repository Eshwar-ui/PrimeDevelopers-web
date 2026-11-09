// Apply the POW Leander page copy, SEO fields, pricing, FAQs and (when on hand)
// the Drive photography from the 2026-11 handoff (pow-leander-claude-code-handoff,
// source doc https://claude.ai/artifact/9YgUohXrNT3AxZiudt57q7).
//
// Through the live API, as an admin — same pattern as update-centro-content.mjs:
// logs in, reads the record at SLUG, uploads any prepared images through
// /uploads/image and saves with PATCH /admin/properties/:id, carrying
// `expectedUpdatedAt` so it refuses to overwrite an edit made meanwhile. Dry run
// by default; --commit to write. Writes a backup of the record before committing.
//
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-pow-leander-content.mjs
//   PRIME_ADMIN_EMAIL=… PRIME_ADMIN_PASSWORD=… node scripts/update-pow-leander-content.mjs --commit
//   … --with-pricing                 also sends the Rate Master tables and priced copy
//   POW_PHOTO_DIR=<dir> …            photo folder (default pow-leander-web-photos/, from prepare-pow-leander-photos.mjs)
//
// Merges into the live record. Untouched on purpose: address, floorPlans.buildings
// (the unit inventory — Prime Tracker owns it), the headline totals
// (buildings/sold/available, which drive the hero strip and the {totalUnits} /
// {availableUnits} tokens below), siteModel and socials.
//
// Unconfirmed in the handoff, so left out rather than guessed:
//   TODO: lat/long — geo.position, Place `geo` and `hasMap` stay off until set
//   TODO: Rate Master sheet is labelled "Leander Flex" — confirm it is POW Leander
//         → pricing tables and every priced line are held behind --with-pricing
//   TODO: tenant names (22 Yards, Bawarchi, Perfect Posture, Three Wheels Strength)
//         need sign-off → SHOW_TENANT_NAMES stays false; business types shown instead
//   TODO: unit sizes in the FAQ (old site said 1,019–2,280 SF) — kept as given
//   TODO: "grade-level" on the overhead doors — card titled "Overhead doors" until confirmed
//   TODO: "35,000+ vehicles a day on Ronald Reagan Blvd" — card left out until confirmed
//   TODO: "2,500+ residential lots nearby" — sentence left out until confirmed
//   TODO: SF project size, ceiling height, parking count — stats left out
//   TODO: unit totals — staging 33/81, old site 27 of 40, Rate Master 28 for sale;
//         one source (Prime Tracker sync) must set buildings/sold/available
//   TODO: Buildings 1–5 records and plans (only PLANS_Leander_B2/B4.jpg exist), and
//         one unit record per Rate Master row — needs building assignment + status
//   TODO: that each YouTube video shows POW Leander; drone videos still to upload
//   TODO: flyer PDF (broken on old site) and a floor-plans PDF URL; Crexi if listed
//   TODO: tenant logos (22.png, threewheels.png, bawarchi.jpg, lego.png = unknown)
//   TODO: nearby places and any drive times — copy kept free of minutes
//   TODO: /leander and /office-warehouse-condos don't exist yet, so those anchors are
//         plain text; /investors doesn't exist, so it points at /cap-properties
//   TODO: photos — not in the repo. Export from the Drive folder (LCA Visual Studios)
//         to WebP ~2000px / <200KB under the names in FILES and GALLERY, then re-run
//         with PHOTO_DIR. Until then the record's current images stay.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMIT = process.argv.includes('--commit')
const WITH_PRICING = process.argv.includes('--with-pricing')
const priced = (withPrices, without) => (WITH_PRICING ? withPrices : without)
const SHOW_TENANT_NAMES = false
const named = (name, fallback) => (SHOW_TENANT_NAMES ? name : fallback)

const SLUG = 'pow-leander'
const API = `${(process.env.PRIME_API ?? 'https://dtw8rs0oq8bpp.cloudfront.net').replace(/\/$/, '')}/api`
const ADDRESS = '15901 Ronald Reagan Blvd, Leander, TX 78641'
const FOLDER = 'projects/pow-leander/drive'
// Defaults to the output of prepare-pow-leander-photos.mjs; a different folder
// only via POW_PHOTO_DIR, so a PHOTO_DIR left set for another script can't leak in.
const PHOTO_DIR = process.env.POW_PHOTO_DIR ?? (existsSync('pow-leander-web-photos') ? 'pow-leander-web-photos' : '')

// Slot → prepared file name and alt text (Drive source in the comment).
const FILES = {
  hero: ['pow-leander-office-warehouse-exterior.webp', 'POW Leander office warehouse building with stone facade and overhead doors, Leander TX'], // Buildings/LcaVisualStudios-79.jpg
  og: ['pow-leander-og-1200x630.jpg', 'POW Leander office warehouse and flex units, Leander TX'], // 1200×630 crop of the hero
  aerial: ['pow-leander-aerial-ronald-reagan-blvd.webp', 'Aerial view of the POW Leander buildings beside Ronald Reagan Blvd'], // DroneShotsPhotos/LEN-Building-DRONE-Photos2.jpg
  flexRow: ['pow-leander-flex-units-overhead-doors.webp', 'Row of flex units with overhead doors and glass entrances at POW Leander'], // Buildings/LcaVisualStudios-3.jpg
  site: ['pow-leander-site-aerial.webp', 'Aerial of the POW Leander site and parking'], // DroneShotsPhotos/LEN-Building-DRONE-Photos3.jpg
  bawarchi: ['pow-leander-tenant-bawarchi.webp', named('Bawarchi Indian restaurant building at POW Leander', 'Indian restaurant building at POW Leander')], // LEN-110-Bawarchi/LcaVisualStudios-4.jpg
  britepro: ['pow-leander-tenant-britepro.webp', named('BritePro home theater and audio video store at POW Leander', 'Home theater and audio video store at POW Leander')], // LEN-325-335/LcaVisualStudios-62.jpg
  fitness: ['pow-leander-tenant-fitness-center.webp', 'Fitness enrollment center storefront at POW Leander'], // LEN-380-390/LcaVisualStudios-30.jpg
  overheadDoor: ['pow-leander-overhead-door-unit.webp', 'Flex unit with overhead door and glass-front entrance'], // LEN-445-455/LcaVisualStudios-96.jpg
  map: ['pow-leander-location-map.webp', 'Map of POW Leander and nearby neighborhoods in Leander TX'], // Leander_Map-1.jpg
}
// pow-leander-gallery-01…13.webp. TODO: alt text written from the Drive file
// names only — check each against its photograph when the exports land.
const GALLERY = [
  'Office warehouse building at POW Leander, Leander TX', // Buildings/LcaVisualStudios-110
  'Flex unit frontages along a POW Leander building', // Buildings/LcaVisualStudios-81
  'POW Leander building with overhead doors and glass entrances', // Buildings/LcaVisualStudios-52
  'Stone facade and storefronts at POW Leander', // Buildings/LcaVisualStudios-51
  'POW Leander office warehouse exterior', // Buildings/LcaVisualStudios.jpg
  'Aerial of POW Leander on Ronald Reagan Blvd', // DroneShotsPhotos 1
  'Aerial of the POW Leander buildings and parking', // DroneShotsPhotos 5
  'Aerial of POW Leander and the surrounding Leander neighborhoods', // DroneShotsPhotos 6
  'Overhead view of the POW Leander site', // DroneShotsPhotos 8
  'Units 320 and 330 at POW Leander', // LEN-330-320/LcaVisualStudios-45
  'Units 340 and 350 at POW Leander', // LEN-340-350/LcaVisualStudios-42
  'Units 360 and 370 at POW Leander', // LEN-360-370/LcaVisualStudios-33
  'Units 480 and 490 at POW Leander', // LEN-480-490/LcaVisualStudios-6
].map((alt, i) => [`pow-leander-gallery-${String(i + 1).padStart(2, '0')}.webp`, alt])
// One storefront per LEN-<units> folder not already pictured above (110,
// 325-335, 380-390, 445-455, 330-320, 340-350, 360-370, 480-490 are). The page
// has no unit records yet, so these join the gallery; once units exist they
// become the unit-card photos. Drive's "LEN-420-230" folder shows units 420 and
// 430 on the glass, so its alt says 430. LEN-440-450 uses -16, not -20 (lift in frame).
const UNIT_GROUPS = ['300-310', '305-315', '345-335', '355-365', '375-385-395', '400-410', '405-415', '420-230', '425-435', '440-450', '470', '470-460', '475-465', '485-495']
const unitsAlt = (group) => {
  const units = (group === '420-230' ? '420-430' : group).split('-')
  const list = units.length === 1 ? units[0] : `${units.slice(0, -1).join(', ')} and ${units.at(-1)}`
  return `Unit${units.length > 1 ? 's' : ''} ${list} storefront at POW Leander`
}
const UNITS = UNIT_GROUPS.map((g) => [`pow-leander-unit-${g}.webp`, unitsAlt(g)])

// Word for word in the visible FAQ and the FAQPage markup — both read this list.
const FAQS = [
  ['Where is POW Leander?', '15901 Ronald Reagan Blvd, Leander, TX 78641, on a signalized hard corner along the Ronald Reagan Blvd corridor.'],
  ['Can I buy or lease a unit at POW Leander?', priced(
    'Both. Flex units sell from $429,000 (1,650 SF) and lease from $26/SF/yr plus $7 NNN. Units can also be built to suit.',
    'Both. Flex units are available to buy or lease, and units can also be built to suit. Contact the team for current pricing.',
  )],
  ['What can I use the space for?', 'Gyms, workshops, car services, batting cages, showrooms, luxury storage, offices and similar businesses. Zoning also covers retail, restaurants and services.'],
  // TODO: unconfirmed — the old site said 1,019–2,280 SF.
  ['What size are the units?', 'Flex units run from 1,650 to 2,369 SF and retail units from 1,579 to 2,679 SF across five buildings.'],
  ['What features do the units have?', 'Overhead doors (14 × 14 ft on larger units, 12 × 14 ft on smaller ones), private restrooms, glass-front entrances, mezzanines up to 50% of the floor plan, 24/7 access and optional 3-phase power.'],
  ['Are there investment properties for sale?', priced(
    'Yes. Leased units with tenants in place are for sale from $715,000 at 5.5% to 6% cap rates.',
    'Yes. Leased units with tenants in place are for sale to investors. Contact the team for current pricing.',
  )],
  ['How do I book a tour?', 'Use the Enquire form or message the team on WhatsApp at +1 512-761-8025.'],
].map(([question, answer]) => ({ question, answer }))

const unitRow = (unit, type, size, salePrice, salePsf, lease, nnn, annualRent) =>
  ({ unit, type, size, salePrice, salePsf, lease, nnn, annualRent })
const cap = (unit, tenant, businessType, size, price, capRate, leaseTerm, rent, nnn) =>
  ({ unit, ...(SHOW_TENANT_NAMES ? { tenant } : {}), businessType, size, price, capRate, leaseTerm, rent, nnn })

const patch = (detail, img) => {
  const { pricing, ...rest } = fullPatch(detail, img)
  return WITH_PRICING ? { ...rest, pricing } : rest
}

const fullPatch = (detail, img) => ({
  kicker: 'Flex · Office Warehouse · 15901 Ronald Reagan Blvd, Leander, TX 78641',
  tagline: 'Office warehouse and flex units to buy, lease or build to suit in Leander',
  // Property-page hero only; `property.image` (listing cards) is left alone.
  ...(img.hero ? { covers: { ...detail.covers, detailHero: img.hero } } : {}),
  overview: {
    ...detail.overview,
    eyebrow: 'Prime Office Warehouses Leander',
    heading: 'Office warehouse and flex space for sale in Leander, built to work hard',
    body: [
      'POW Leander (Prime Office Warehouses Leander) is a five-building office warehouse and flex development at 15901 Ronald Reagan Blvd in Leander, TX. Units are available to buy, lease or build to suit, so a growing business can own its space instead of paying rising rent.',
      // TODO: /leander doesn't exist yet — restore as [flex space for sale in Leander](/leander).
      "Every unit pairs a front office with open warehouse space behind an overhead door. Owners get private restrooms, glass-front entrances, mezzanines of up to 50% of the floor plan, 24/7 access and optional 3-phase power. If you're comparing flex space for sale in Leander, this is one of the few new projects on the Ronald Reagan corridor.",
      named(
        'The site already has a working business community. 22 Yards, a strength gym and Bawarchi Indian Cuisine have signed on, bringing daily fitness and dining traffic.',
        'The site already has a working business community. Fitness, sports and dining businesses have signed on, bringing daily traffic.',
      ),
    ].join('\n\n'),
    // TODO: "SF project size" left out until confirmed. Unit counts resolve from
    // the same totals as the hero strip.
    stats: [
      { value: '{totalUnits}', label: 'Total units' },
      { value: '{availableUnits}', label: 'Available units' },
    ],
  },
  highlights: {
    ...detail.highlights,
    heading: 'Built for gyms, workshops, showrooms and more',
    // TODO: /office-warehouse-condos doesn't exist yet — restore the link on
    // "gym, auto shop or showroom space" once it does.
    body: [
      'POW Leander suits businesses that need a door to the street and room to work: gyms, contractor and auto shops, car services, batting cages, showrooms and luxury storage. Looking for gym, auto shop or showroom space you can own? Each unit gives you a working warehouse and a professional front office under one roof.',
      // The handoff's spec list; the page has no list renderer, so it reads as a line.
      'Every unit: office and warehouse layout with a glass-front entrance, a private restroom, optional 3-phase power and on-site parking — to buy, lease or build to suit.',
    ].join('\n\n'),
    // TODO: ceiling height and parking count unconfirmed — no big stats yet.
    bigStats: [],
    cards: [
      // TODO: confirm grade level, then title it "Grade-level overhead doors".
      { title: 'Overhead doors', body: 'Drive-in doors on every unit: 14 ft wide × 14 ft high on larger units and 12 × 14 ft on smaller ones.' },
      { title: 'Mezzanine allowance', body: 'Add a mezzanine of up to 50% of the base floor plan for storage or offices.' },
      { title: '24/7 access', body: 'Owners and staff can get in any time, day or night.' },
      // TODO: "High traffic — more than 35,000 vehicles a day pass on Ronald
      // Reagan Blvd" held back until the figure is confirmed.
    ],
  },
  floorPlans: {
    ...detail.floorPlans,
    intro: {
      heading: 'Floor plans and available units',
      // TODO: /office-warehouse-condos doesn't exist yet — restore the link on "office warehouse condos".
      body: 'POW Leander has five buildings with shell flex units, finished flex units and retail end-caps. Select a building to see its plan, then compare units below. Prefer to buy? Our office warehouse condos give you equity instead of rent.',
    },
  },
  pricing: {
    units: {
      heading: 'Units for sale or lease',
      intro: 'Shell flex units start at $429,000 ($260/SF) to buy, or $33/SF/yr all-in to lease ($26 base + $7 NNN). Finished units are move-in ready from $544,500, and retail end-caps lease from $46/SF/yr all-in ($36 + $10 NNN).',
      rows: [
        unitRow('210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 460, 470, 475', 'Flex shell', '1,650', '$429,000', '$260', '$26', '$7', '$54,450'),
        unitRow('420, 430, 440, 450', 'Flex finished', '1,650', '$544,500', '$330', '$26', '$7', '$54,450'),
        unitRow('290', 'Flex shell', '2,249', '$584,740', '$260', '$26', '$7', '$74,217'),
        unitRow('295, 400', 'Flex shell', '2,369', '$615,940', '$260', '$26', '$7', '$78,177'),
        unitRow('205', 'Retail', '1,579', '$726,340', '$460', '$36', '$10', '$72,634'),
        unitRow('480', 'Retail', '2,679', '$1,232,340', '$460', '$36', '$10', '$123,234'),
      ],
    },
    capRate: {
      heading: 'Cap rate investment properties',
      // /investors doesn't exist; /cap-properties is the site's list of investment properties.
      intro: "Buy a unit with a tenant already paying rent. POW Leander's leased units pay 5.5% to 6% on 10-year NNN leases. See all [investment properties](/cap-properties) across our Texas projects.",
      showTenantNames: SHOW_TENANT_NAMES,
      rows: [
        cap('410', 'Perfect Posture', 'Posture / wellness studio', '1,650', '$715,000', '6.00%', '10 yrs', '$42,900', '$11,550'),
        cap('335', 'Three Wheels Strength', 'Strength gym', '1,650', '$715,000', '6.00%', '10 yrs', '$42,900', '$11,550'),
        cap('501', 'Bawarchi Indian Cuisine', 'Indian restaurant', '5,850', '$3,217,455', '5.50%', '10 yrs', '$198,900', '$40,950'),
      ],
    },
  },
  location: {
    ...detail.location,
    eyebrow: "Leander's Business Hub",
    heading: "A hard corner in one of Texas's fastest-growing cities",
    sub: '',
    body: [
      // TODO: "More than 2,500 residential lots are planned or built nearby, so the
      // customers and workforce are moving in around the site." — add once confirmed.
      'POW Leander sits on a hard corner at a signalized intersection on Ronald Reagan Blvd, with heavy morning commuter traffic passing the door.',
      // TODO: /leander doesn't exist yet — restore as [Leander's commercial real estate growth](/leander).
      "Zoning covers retail, restaurants, services, offices and hotels, which gives owners room to change use as they grow. For small businesses priced out of central Austin, it's a lower-cost way to own space in the middle of Leander's commercial real estate growth.",
    ].join('\n\n'),
  },
  establishedSites: { ...detail.establishedSites, heading: 'Businesses already open at POW Leander' },
  neighborhoods: {
    heading: "Near Leander's newest neighborhoods",
    // TODO: /leander doesn't exist yet — restore the link on "office space for lease in Leander".
    intro: 'Ronald Reagan Blvd connects POW Leander to new neighborhoods across Leander, Cedar Park and Liberty Hill. Need office space for lease in Leander close to where your customers live? This is it.',
    mapQuery: ADDRESS,
    // TODO: confirm each place, and drive times before any minutes are added.
    items: [
      { name: 'Indigo Ridge', note: 'New residential community about 2.7 miles away.' },
      { name: 'Northline, Leander', note: "Leander's new mixed-use town center." },
      { name: 'Leander MetroRail Station', note: 'Commuter rail link to downtown Austin.' },
      { name: 'Austin Community College San Gabriel Campus', note: 'Growing college campus serving Leander and Liberty Hill.' },
    ],
  },
  videosHeading: 'See POW Leander',
  // TODO: confirm each shows POW Leander; add DRONE-2 / DRONE-3 once on YouTube.
  videos: ['kiHEcxuHqBY', 'ouA2c7FdYLk', 'aIZYFBGO1OQ', 'c5szqNDA-XI', 'yQa0GV0GpTg'].map((id, i) => ({
    url: `https://www.youtube.com/watch?v=${id}`,
    title: `POW Leander video ${i + 1}`,
  })),
  faqHeading: 'POW Leander FAQs',
  faqs: FAQS,
  // TODO: Flyer (PDF broken on old site), Floor plans PDF and Crexi — add once uploaded/listed.
  resourceLinks: [
    { label: 'Map', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`, thumbnail: '' },
    { label: 'LoopNet', url: 'https://www.loopnet.com/Listing/15901-Ronald-Reagan-Blvd-Leander-TX/25111340/', thumbnail: '' },
  ],
  closing: {
    body: 'Talk to The Prime Developer team about flex and office warehouse units in Leander, from pricing and availability to a site tour.',
  },
  seo: {
    ...detail.seo,
    title: 'POW Leander | Office Warehouse & Flex Units | The Prime Developer',
    description: priced(
      'POW Leander has office warehouse and flex units for sale or lease at 15901 Ronald Reagan Blvd, Leander, TX. Buy from $429,000. Enquire today.',
      'POW Leander has office warehouse and flex units for sale or lease at 15901 Ronald Reagan Blvd, Leander, TX. Enquire today.',
    ),
    ogTitle: 'POW Leander | Office Warehouse & Flex Units',
    ogDescription: 'Office warehouse and flex units to buy or lease on Ronald Reagan Blvd in Leander, TX.',
    twitterDescription: 'Flex and office warehouse units on Ronald Reagan Blvd, Leander. Buy or lease.',
    ...(img.og ? { ogImage: img.og } : {}),
    ogImageAlt: 'POW Leander office warehouse buildings on Ronald Reagan Blvd, Leander TX',
    heroAlt: FILES.hero[1],
    geoRegion: 'US-TX',
    geoPlacename: 'Leander',
    // latitude/longitude: TODO — left as the record has them (none today).
    alternateName: 'Prime Office Warehouses Leander',
    placeDescription: 'Five-building office warehouse and flex development on Ronald Reagan Blvd with units to buy, lease or build to suit.',
    amenities: ['Overhead doors', '24/7 access', 'Private restrooms', 'On-site parking'],
  },
  imageAlts: [
    ...(detail.imageAlts ?? []).filter((a) => !Object.values(img).includes(a.src)),
    ...Object.entries(img).filter(([k]) => k !== 'og').map(([k, src]) => ({ src, alt: altFor(k) })),
  ],
})

const altFor = (key) => FILES[key]?.[1] ?? [...GALLERY, ...UNITS].find(([name]) => name === key)?.[1] ?? ''

// Order matters to the page: the first three (after the hero) fill the overview
// mosaic, the next four become "Businesses already open", the rest the gallery.
const GALLERY_ORDER = ['aerial', 'flexRow', 'site', 'bawarchi', 'britepro', 'fitness', 'overheadDoor', ...GALLERY.map(([n]) => n), ...UNITS.map(([n]) => n), 'map']

// ── Images on hand ────────────────────────────────────────────────────────
const files = { ...Object.fromEntries(Object.entries(FILES).map(([k, [name]]) => [k, name])), ...Object.fromEntries([...GALLERY, ...UNITS].map(([n]) => [n, n])) }
const onHand = PHOTO_DIR ? Object.keys(files).filter((k) => existsSync(join(PHOTO_DIR, files[k]))) : []
const missing = Object.keys(files).filter((k) => !onHand.includes(k))

// Only replace the gallery once there are photographs to replace it with; the
// old site/hero slides and the template sample go with it.
const newGallery = (current, img) => {
  const shot = GALLERY_ORDER.map((k) => img[k]).filter(Boolean)
  return shot.length ? shot : current
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
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

const { accessToken: token } = await call('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const property = await call(`/admin/properties/${SLUG}`, { token })

const placeholder = Object.fromEntries(onHand.map((k) => [k, `<upload: ${files[k]}>`]))
const preview = patch(property.detail ?? {}, placeholder)
console.log(`${SLUG} (updatedAt ${property.updatedAt})`)
console.log(`  images: ${onHand.length} on hand, ${missing.length} missing${PHOTO_DIR ? '' : ' (no PHOTO_DIR)'}`)
if (missing.length) console.log(`    missing: ${missing.map((k) => files[k]).join(', ')}`)
console.log(`  gallery: ${newGallery(property.gallery, placeholder) === property.gallery ? 'unchanged' : 'replaced'}`)
for (const k of Object.keys(preview)) {
  const before = JSON.stringify(property.detail?.[k] ?? null)
  const after = JSON.stringify(preview[k])
  console.log(`  detail.${k}: ${before === after ? 'unchanged' : before === 'null' ? 'added' : 'changed'}`)
}
if (!WITH_PRICING) console.log('  pricing: held back (re-run with --with-pricing once the Rate Master sheet is confirmed)')

if (!COMMIT) {
  console.log('\nDry run — nothing uploaded or written. Re-run with --commit.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `pow-leander-content-backup-${stamp}.json`
writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), property }, null, 2))
console.log(`\nbacked up previous state to ${backup}`)

const img = {}
for (const key of onHand) {
  const name = files[key]
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
    gallery: newGallery(property.gallery, img),
    detail: { ...property.detail, ...patch(property.detail ?? {}, img) },
    expectedUpdatedAt: property.updatedAt,
  }),
})

console.log('Saved — POW Leander carries the handoff copy.')
