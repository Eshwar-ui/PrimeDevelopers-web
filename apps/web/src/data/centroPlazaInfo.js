/**
 * The Centro Plaza info page, as shipped in code — the fallback for a property
 * whose record has no `detail.info` yet. See lib/propertyInfo.js.
 *
 * Lifted from the standalone launchpad page the client had been sending
 * prospects to (theprimedeveloper.info/m/Centro-Plaza). Once anyone saves the
 * Info page tab in the admin, the property row carries its own copy and this
 * file stops being read for that slug.
 *
 * ── On the image URLs ────────────────────────────────────────────────────────
 * Most still point at the bucket the launchpad page uploaded to. Nothing else
 * on the site loads from a third-party origin, and `sized()` can only resize
 * Supabase URLs, so these arrive as full-size PNGs — the largest is 4.5MB —
 * which is why every one of them is lazy-loaded. Replacing one from the admin
 * uploads it to Supabase, after which it is resized and served as WebP like
 * everything else. The building photographs below already are.
 */

import { INFO_SLUGS } from '../lib/infoSets'
import { MEDIA_BASE } from '../lib/images'

const BUCKET = 'https://storage.googleapis.com/bitly-image-upload/'
// The property's own photography, filed by building in the gallery.
const BUILDINGS = `${MEDIA_BASE}/images/projects/centro-plaza/drive/buildings/`

const building = (n, photo, plan, planAlt) => ({
  label: `Building ${n}`,
  photo: photo ? BUILDINGS + photo : '',
  photoAlt: photo ? `Exterior of Building ${n} at Centro Plaza` : '',
  plan: plan ? BUCKET + plan : '',
  planAlt: planAlt ?? '',
  note: '',
})

export const CENTRO_PLAZA_INFO = {
  published: true,
  kicker: 'Mixed Development',
  name: 'Centro Plaza',
  address: '14300 Ronald W Reagan Blvd, Leander, TX 78641',
  summary:
    'Ten buildings of retail, office and flex space on Ronald Reagan Blvd — the full media set: site plan, availability, floor plans building by building, and the development as built.',

  // The frontage rather than the aerial, on resolution alone: the aerial is the
  // better establishing shot but it is only 1240px wide, and a full-bleed hero
  // runs to 1920 and beyond, so it would be upscaled by half again and land
  // visibly soft. This one is 2500px.
  heroImage: BUCKET + 'Ip27jKDxke6',

  facts: [
    { value: '10', label: 'Buildings' },
    { value: '1,000', label: 'Sq ft minimum' },
    { value: '2026', label: 'Year built' },
    { value: 'NNN', label: 'Lease type' },
  ],

  site: {
    tag: 'The Site',
    heading: 'Site plan & availability',
    body: 'Where each building sits, what is still available, and how the plaza reads against everything already trading on Ronald Reagan Blvd.',
    images: [
      { src: BUCKET + 'Iq78k8Q8iBf', alt: 'Centro Plaza site plan — buildings 1 to 10 shaded by availability', caption: 'Site plan — availability by building' },
      { src: BUCKET + 'Iq6phDObC4M', alt: 'Aerial of Centro Plaza with available square footage per building and current tenants labelled', caption: 'Available space & current tenants' },
      { src: BUCKET + 'Ipadj1wMhIn', alt: 'Aerial map showing Centro Plaza and surrounding retail along Ronald W Reagan Blvd', caption: 'The surrounding trade area' },
    ],
  },

  // Buildings 3 and 4 have photography but no published sheet, and Building 10
  // a sheet but no photograph. Each shows what exists and says what doesn't —
  // nothing is borrowed from a neighbour to fill the gap.
  buildings: {
    tag: 'Floor Plans',
    heading: 'Building by building',
    body: 'Every building on the site with its photograph and floor plan — unit numbering, square footage and current status.',
    items: [
      building(1, 'building-01/LcaVisualStudios.jpg', 'Iq6gfbtpQi8', 'Building 1 floor plan with unit numbers, square footage and status'),
      building(2, 'building-02/LcaVisualStudios-8.jpg', 'Iq6jhW2NJWT', 'Building 2 floor plan with unit numbers, square footage and status'),
      building(3, 'building-03/LcaVisualStudios-7.jpg'),
      building(4, 'building-04/LcaVisualStudios-13.jpg'),
      building(6, 'building-06/LcaVisualStudios-20.jpg', 'Iq8aijPGoAn', 'Building 6 floor plan with unit numbers, square footage and status'),
      building(7, 'building-07/LcaVisualStudios-21.jpg', 'Iq6niD4mEI8', 'Building 7 floor plan with unit numbers, square footage and status'),
      building(8, 'building-08/LcaVisualStudios-60.jpg', 'Iq6pkVy2cPc', 'Building 8 floor plan with unit numbers, square footage and status'),
      building(9, 'building-09/LcaVisualStudios-14.jpg', 'Iq6qkbmDeLw', 'Building 9 floor plan with unit numbers, square footage and status'),
      building(10, null, 'Iq6ihfwWE2y', 'Building 10 floor plan with unit numbers, square footage and status'),
    ],
  },

  gallery: {
    tag: 'As Built',
    heading: 'The development',
    body: 'Centro Plaza as it stands today — frontages, elevations and the plaza from above.',
    images: [
      { src: BUCKET + 'IocnjEXMQTn', alt: 'Aerial view of Centro Plaza looking along Ronald W Reagan Blvd', caption: 'The plaza from above' },
      { src: BUCKET + 'Ip4ihCi4dvy', alt: 'Building 3 exterior facade with Teapioca signage', caption: 'Building 3 — exterior facade' },
      { src: BUCKET + 'Ip27jtqPQob', alt: 'Building 2 frontage with the fine wine and liquor store and smoke shop units', caption: 'Building 2 — frontage' },
      { src: BUCKET + 'IocnjIJjdCx', alt: 'Building 4 with for-lease signage in the storefront glazing', caption: 'Building 4 — available units' },
      { src: BUCKET + 'IocnjhIT3zO', alt: 'Brick and stucco corner unit at Centro Plaza with leased signage', caption: 'Corner unit' },
      { src: BUCKET + 'Ip27ju6O0Hh', alt: 'Corner suite 106 at Centro Plaza, leased to an Indian restaurant', caption: 'Suite 106' },
      { src: BUCKET + 'Iocnj07ygqr', alt: 'Rear elevation at Centro Plaza showing service doors and access ramps', caption: 'Rear elevation' },
      { src: BUCKET + 'IocnjAIFVYx', alt: 'Rear corner of a Centro Plaza building in brown siding and stone', caption: 'Rear corner' },
      { src: BUCKET + 'IocnjJ9vfP5', alt: 'Side elevation of a Centro Plaza building with stepped access and railings', caption: 'Side elevation' },
      { src: BUCKET + 'Ip27jKDxke6', alt: 'Building 1 frontage with The Williamson County Bagel Company signage', caption: 'Building 1 — frontage' },
    ],
  },

  investment: {
    tag: 'Investment',
    heading: 'Leased-unit summaries',
    body: 'Tenanted units offered with the lease in place. Figures are the ones published on each sheet.',
    images: [
      { src: BUCKET + 'Iq6oh8KoxLc', alt: 'Summary sheet for Centro Building 1 unit 101, leased to Spot Fusion Kitchen', caption: 'Building 1 · Unit 101 — Spot Fusion Kitchen' },
      { src: BUCKET + 'Iq6qkO0fdGn', alt: 'Summary sheet for Centro Building 6 unit 605, a kids activity studio', caption: 'Building 6 · Unit 605 — Kids Activity Studio' },
    ],
  },

  // Third-party listings the client already maintains. Kept as short links
  // rather than resolved: the sales team repoints them, and resolving them here
  // would mean this list silently rots when one is.
  links: [
    { label: 'Crexi listing', href: 'https://theprimedeveloper.info/47sHl7S' },
    { label: 'LoopNet listing', href: 'https://bit.ly/4sb5fNT' },
    { label: 'Property flyer', href: 'https://theprimedeveloper.info/4bdwq3D' },
    { label: 'Floor plans (PDF)', href: 'https://theprimedeveloper.info/4ae1e3Q' },
    { label: 'Location', href: 'https://bit.ly/4f8VBEG' },
  ],

  contacts: [
    { name: 'Malik Gilakattula', phone: '+1 (512) 761-8025' },
    { name: 'Raju Padigala', phone: '+1 (512) 866-3485' },
  ],
  email: 'sales@theprimedeveloper.com',
}

/** Shipped defaults, keyed by property slug. */
export const DEFAULT_INFO = {
  'centro-plaza': CENTRO_PLAZA_INFO,
}

// `lib/infoSets.js` carries the same slugs without the payload, so a card can
// gate its "View photos" button without dragging this module into the main
// bundle. This keeps the two in step: adding a default here and forgetting it
// there fails on the next dev load rather than silently hiding the button.
if (import.meta.env.DEV) {
  const declared = [...INFO_SLUGS].sort().join(',')
  const actual = Object.keys(DEFAULT_INFO).sort().join(',')
  if (declared !== actual) {
    console.error(
      `[infoSets] INFO_SLUGS is out of step with DEFAULT_INFO.\n` +
        `  lib/infoSets.js: ${declared || '(empty)'}\n` +
        `  DEFAULT_INFO:    ${actual || '(empty)'}`
    )
  }
}
