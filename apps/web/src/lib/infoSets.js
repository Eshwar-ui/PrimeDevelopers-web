// Which property slugs have a media set behind `/properties/:slug/info`.
//
// Split out from the media set itself so a component can ask the *question*
// without pulling the answer's payload. `AvailableUnits` gates its "View
// photos" button on this: importing `PROPERTY_INFO` to do the same job put the
// full 9KB of image lists, captions, contacts and legal copy into the main
// bundle — on the critical path of every visit — to decide whether to draw one
// button on a card.
//
// Kept honest by a dev-time assertion at the foot of `data/centroPlazaInfo.js`,
// which fails loudly if this list and the real set of keys ever disagree.
export const INFO_SLUGS = new Set(['centro-plaza'])

export const hasInfoSet = (slug) => INFO_SLUGS.has(slug)
