/**
 * Phased developments.
 *
 * Some projects ship in parts — "POW Lewisville Phase I" and "POW Lewisville
 * Phase II" are two property records describing one development. A visitor on
 * either page should be able to step across to the other.
 *
 * The relationship is read out of the names rather than stored, because the
 * names already carry it and nothing in the CMS has to be re-entered for this
 * to work. The rule is deliberately strict: a property only joins a phase group
 * if its name *ends* with `Phase <number>`. Grouping on a shared prefix instead
 * would be the obvious shortcut and it is wrong — "Rio Ranch 1 Acre Lots" and
 * "Rio Ranch Commercial Lots" share a prefix and are two different products,
 * not two phases of one, and pairing them would invent a relationship the
 * business never claimed.
 *
 * If phases ever need to span differently-named records, this is the one place
 * to swap for an explicit CMS field.
 */

// Trailing separator is optional and tolerated so "Foo — Phase 2" and
// "Foo, Phase 2" group with "Foo Phase 2".
const PHASE_RE = /^(.+?)[\s,–—-]*\bphase\s+([ivxlcdm]+|\d+)\.?$/i

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 }

/**
 * `"POW Lewisville Phase II"` → `{ base: 'pow lewisville', label: 'Phase II', order: 2 }`.
 * Anything without a trailing phase returns null, which is most properties.
 */
export function parsePhase(name) {
  const match = (name ?? '').trim().match(PHASE_RE)
  if (!match) return null

  const [, rawBase, token] = match
  const base = rawBase.trim().replace(/\s+/g, ' ').toLowerCase()
  // A record named only "Phase I" has nothing to group *on*; without this it
  // would collect every other bare phase into one meaningless set.
  if (!base) return null

  const lower = token.toLowerCase()
  const order = /^\d+$/.test(lower) ? Number(lower) : ROMAN[lower]
  if (!order) return null

  // The label keeps the author's own numbering — a site that writes "Phase 2"
  // should not be shown "Phase II" because this file preferred roman.
  return { base, label: `Phase ${token.toUpperCase()}`, order }
}

/**
 * Every published phase of the development `current` belongs to, in order,
 * including `current` itself.
 *
 * Returns an empty array when there is nothing to switch between. That covers
 * the ordinary case of an unphased property, and one real case in the live
 * data: "Reagan Crossing Phase II" is named as a phase but is the only one
 * published, and a control offering a single destination is worse than no
 * control — it implies a choice that does not exist.
 */
export function phaseSiblings(properties, current) {
  const self = parsePhase(current?.name)
  if (!self) return []

  const group = (properties ?? [])
    .map((property) => ({ property, phase: parsePhase(property.name) }))
    .filter(({ phase }) => phase?.base === self.base)
    .sort((a, b) => a.phase.order - b.phase.order)

  if (group.length < 2) return []

  return group.map(({ property, phase }) => ({
    slug: property.slug,
    label: phase.label,
    isCurrent: property.slug === current.slug,
  }))
}
