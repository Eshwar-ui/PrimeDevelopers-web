// Brand marks for the marketplaces a property is listed on.
//
// Crexi and LoopNet are names the people this section is written for already
// know, and a broker finds "the LoopNet one" by its mark faster than by
// reading five labels. So where we hold the mark we use it, and where we do
// not the typed glyph from `resourceKinds` stands in.
//
// Resolved through `import.meta.glob` rather than a /public path on purpose:
// the map only ever contains files that are actually in the repo at build
// time, so a mark nobody has supplied yet cannot ship as a broken image. No
// runtime probe, no onError dance, no flash of a missing logo.
//
// To add one: drop `<slug>.svg` into src/assets/marketplaces/. That is all.

const FILES = import.meta.glob('../assets/marketplaces/*.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const BY_SLUG = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [
    path.split('/').pop().replace(/\.\w+$/, '').toLowerCase(),
    url,
  ]),
)

// Label → asset slug. The labels are typed by hand and have arrived as
// "Loopnet", "LoopNet" and "Loop Net", so the pattern absorbs the spacing
// and the casing rather than asking the client to be consistent.
const ALIASES = [
  [/\bcrexi\b/i, 'crexi'],
  [/\bloop\s*net\b/i, 'loopnet'],
  [/\bco\s*star\b/i, 'costar'],
  [/\bzillow\b/i, 'zillow'],
]

/** The mark for this label, or null — null is the ordinary case, not a fault. */
export const marketplaceLogo = (label) => {
  const alias = ALIASES.find(([test]) => test.test(String(label ?? '')))
  return (alias && BY_SLUG[alias[1]]) || null
}
