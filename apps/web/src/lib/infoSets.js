// Which properties have a page at `/properties/:slug/info`.
//
// Split out from the pages themselves so a component can ask the *question*
// without pulling the answer's payload. `AvailableUnits` gates its "View
// photos" button on this: importing the default sets to do the same job put
// ~9KB of image lists, captions, contacts and legal copy into the main bundle
// — on the critical path of every visit — to decide whether to draw a button.
//
// Two sources, in order. A property whose record carries `detail.info` (set
// from the admin's Info page tab) answers for itself, on its `published` flag.
// One that doesn't falls back to the slugs with a default shipped in code —
// kept honest by the dev-time assertion at the foot of
// `data/centroPlazaInfo.js`.
export const INFO_SLUGS = new Set(['centro-plaza'])

export const hasInfoPage = (property) => {
  const stored = property?.detail?.info
  if (stored && typeof stored === 'object') return stored.published !== false
  return INFO_SLUGS.has(property?.slug)
}
