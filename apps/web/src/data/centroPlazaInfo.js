/**
 * The Centro Plaza media set, lifted from the standalone launchpad page the
 * client has been sending prospects to (theprimedeveloper.info/m/Centro-Plaza).
 *
 * Kept here as a module rather than in the CMS on purpose: this is a fixed,
 * curated marketing set — a site plan, a floor plan per building, two rate
 * flyers and the photography — not something an admin adds to weekly. The
 * property record in Supabase stays the source of truth for the *listing*; this
 * is the collateral that sits behind it.
 *
 * ── On the image URLs ────────────────────────────────────────────────────────
 * `image` still points at the bucket the launchpad page uploaded to. Nothing
 * else on the site loads from a third-party origin, so this is the one thing
 * here worth replacing: drop the files into `src/assets/centro-plaza/`, add
 * them to `scripts/seed.js` the way the hero slides and partner logos are
 * handled, and swap the URLs below for the Supabase ones. Every call site runs
 * them through `sized()` already, so the moment they are served from Supabase
 * they get resized and content-negotiated to WebP with no further change.
 * Until then they are full-size PNGs — the largest is 4.5MB — which is exactly
 * why every one of them is lazy-loaded.
 */

const BUCKET = 'https://storage.googleapis.com/bitly-image-upload/'

/** Groups render in this order, each as its own band. */
export const CENTRO_PLAZA_INFO = {
  slug: 'centro-plaza',
  name: 'Centro Plaza',
  kicker: 'Mixed Development',
  address: '14300 Ronald W Reagan Blvd, Leander, TX 78641',
  summary:
    'Ten buildings of retail, office and flex space on Ronald Reagan Blvd — the full media set: site plan, availability, floor plans building by building, and the development as built.',

  // The hero ground, named by `id` rather than by URL so it stays one image
  // with one caption and one alt text — it appears in the gallery below too,
  // and a second copy of the URL here would be a second thing to update when
  // these move off the launchpad bucket.
  //
  // The frontage rather than the aerial, on resolution alone: the aerial is the
  // better establishing shot but it is only 1240px wide, and a full-bleed hero
  // runs to 1920 and beyond, so it would be upscaled by half again and land
  // visibly soft. This one is 2500px and downscales into the same slot. Swap
  // the id if a higher-resolution aerial ever turns up.
  heroImageId: 'bldg-1-front',

  facts: [
    { value: '10', label: 'Buildings' },
    { value: '1,000', label: 'Sq ft minimum' },
    { value: '2026', label: 'Year built' },
    { value: 'NNN', label: 'Lease type' },
  ],

  groups: [
    {
      id: 'overview',
      tag: 'The Site',
      heading: 'Site plan & availability',
      body: 'Where each building sits, what is still available, and how the plaza reads against everything already trading on Ronald Reagan Blvd.',
      // `wide` items are landscape and take two columns on desktop; the rest are
      // portrait sheets that read badly when stretched.
      images: [
        { id: 'site-plan', src: BUCKET + 'Iq78k8Q8iBf', alt: 'Centro Plaza site plan — buildings 1 to 10 shaded by availability', caption: 'Site plan — availability by building' },
        { id: 'availability', src: BUCKET + 'Iq6phDObC4M', alt: 'Aerial of Centro Plaza with available square footage per building and current tenants labelled', caption: 'Available space & current tenants', wide: true },
        { id: 'area-map', src: BUCKET + 'Ipadj1wMhIn', alt: 'Aerial map showing Centro Plaza and surrounding retail along Ronald W Reagan Blvd', caption: 'The surrounding trade area', wide: true },
      ],
    },
    {
      id: 'photography',
      tag: 'As Built',
      heading: 'The development',
      body: 'Centro Plaza as it stands today — frontages, elevations and the plaza from above.',
      // Photographs, so the tiles crop to a fixed rhythm and every row lines
      // up. Nothing is lost to the crop: the plate opens the full frame.
      layout: 'photo',
      images: [
        { id: 'aerial', src: BUCKET + 'IocnjEXMQTn', alt: 'Aerial view of Centro Plaza looking along Ronald W Reagan Blvd', caption: 'The plaza from above', feature: true },
        { id: 'bldg-3-teapioca', src: BUCKET + 'Ip4ihCi4dvy', alt: 'Building 3 exterior facade with Teapioca signage', caption: 'Building 3 — exterior facade' },
        { id: 'bldg-2-front', src: BUCKET + 'Ip27jtqPQob', alt: 'Building 2 frontage with the fine wine and liquor store and smoke shop units', caption: 'Building 2 — frontage', feature: true },
        { id: 'bldg-4-lease', src: BUCKET + 'IocnjIJjdCx', alt: 'Building 4 with for-lease signage in the storefront glazing', caption: 'Building 4 — available units' },
        { id: 'corner-leased', src: BUCKET + 'IocnjhIT3zO', alt: 'Brick and stucco corner unit at Centro Plaza with leased signage', caption: 'Corner unit' },
        { id: 'ste-106', src: BUCKET + 'Ip27ju6O0Hh', alt: 'Corner suite 106 at Centro Plaza, leased to an Indian restaurant', caption: 'Suite 106' },
        { id: 'rear-elevation', src: BUCKET + 'Iocnj07ygqr', alt: 'Rear elevation at Centro Plaza showing service doors and access ramps', caption: 'Rear elevation' },
        { id: 'rear-corner', src: BUCKET + 'IocnjAIFVYx', alt: 'Rear corner of a Centro Plaza building in brown siding and stone', caption: 'Rear corner' },
        { id: 'side-elevation', src: BUCKET + 'IocnjJ9vfP5', alt: 'Side elevation of a Centro Plaza building with stepped access and railings', caption: 'Side elevation' },
        { id: 'bldg-1-front', src: BUCKET + 'Ip27jKDxke6', alt: 'Building 1 frontage with The Williamson County Bagel Company signage', caption: 'Building 1 — frontage' },
      ],
    },
    {
      id: 'floor-plans',
      tag: 'Floor Plans',
      heading: 'Building by building',
      body: 'Unit numbering, square footage and current status for every building on the site.',
      images: [
        { id: 'fp-1', src: BUCKET + 'Iq6gfbtpQi8', alt: 'Building 1 floor plan showing units 101 to 103 with square footage and status', caption: 'Building 1' },
        { id: 'fp-2', src: BUCKET + 'Iq6jhW2NJWT', alt: 'Building 2 floor plan showing units 201 to 206 with square footage and status', caption: 'Building 2' },
        { id: 'fp-6', src: BUCKET + 'Iq8aijPGoAn', alt: 'Building 6 floor plan showing units 601 to 620 with square footage and status', caption: 'Building 6' },
        { id: 'fp-7', src: BUCKET + 'Iq6niD4mEI8', alt: 'Building 7 floor plan showing units 701 to 720 with square footage and status', caption: 'Building 7' },
        { id: 'fp-8', src: BUCKET + 'Iq6pkVy2cPc', alt: 'Building 8 floor plan showing units 801 to 820 with square footage and status', caption: 'Building 8' },
        { id: 'fp-9', src: BUCKET + 'Iq6qkbmDeLw', alt: 'Building 9 floor plan showing units 901 to 908 with square footage and status', caption: 'Building 9' },
        { id: 'fp-10', src: BUCKET + 'Iq6ihfwWE2y', alt: 'Building 10 floor plan showing units 1001 to 1009 with square footage and status', caption: 'Building 10' },
      ],
    },
    {
      id: 'investment',
      tag: 'Investment',
      heading: 'Leased-unit summaries',
      body: 'Tenanted units offered with the lease in place. Figures are the ones published on each sheet.',
      images: [
        { id: 'cap-b1-101', src: BUCKET + 'Iq6oh8KoxLc', alt: 'Summary sheet for Centro Building 1 unit 101, leased to Spot Fusion Kitchen', caption: 'Building 1 · Unit 101 — Spot Fusion Kitchen' },
        { id: 'cap-b6-605', src: BUCKET + 'Iq6qkO0fdGn', alt: 'Summary sheet for Centro Building 6 unit 605, a kids activity studio', caption: 'Building 6 · Unit 605 — Kids Activity Studio' },
      ],
    },
  ],

  // Third-party listings the client already maintains. Kept as-is rather than
  // resolved: they are short links the sales team hands out, and following them
  // to their targets here would mean this list silently rots when one is
  // repointed.
  links: [
    { label: 'Crexi listing', href: 'https://theprimedeveloper.info/47sHl7S' },
    { label: 'LoopNet listing', href: 'https://bit.ly/4sb5fNT' },
    { label: 'Property flyer', href: 'https://theprimedeveloper.info/4bdwq3D' },
    { label: 'Floor plans (PDF)', href: 'https://theprimedeveloper.info/4ae1e3Q' },
    { label: 'Location', href: 'https://bit.ly/4f8VBEG' },
  ],

  contacts: [
    { name: 'Malik Gilakattula', phone: '+1 (512) 761-8025', tel: '+15127618025' },
    { name: 'Raju Padigala', phone: '+1 (512) 866-3485', tel: '+15128663485' },
  ],
  email: 'sales@theprimedeveloper.com',
}

/** Keyed by slug so the route can serve more properties as sets are added. */
export const PROPERTY_INFO = {
  [CENTRO_PLAZA_INFO.slug]: CENTRO_PLAZA_INFO,
}

/**
 * Every image in one list, in the order they appear on the page.
 *
 * The lightbox steps through the whole set rather than one band at a time, so
 * it needs a flat index — and deriving it here keeps that index and the render
 * order from ever drifting apart.
 */
export const flattenImages = (info) =>
  info.groups.flatMap((group) => group.images.map((image) => ({ ...image, group: group.heading })))
