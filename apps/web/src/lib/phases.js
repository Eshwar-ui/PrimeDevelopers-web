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
 * The name as stored, phase included. The public site shows names with the
 * phase taken off (ContentContext's `publicName`) and keeps the original as
 * `fullName`; the admin gets the stored name as `name` and no `fullName`.
 */
export const storedName = (property) => property?.fullName ?? property?.name

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
 * the ordinary case of an unphased property, and a property named as a phase
 * that is the only one published — a control offering a single destination is
 * worse than no control, because it implies a choice that does not exist.
 */
/**
 * The portfolio as a visitor should see it listed: one entry per development.
 *
 * The phases of a development are separate records — each has its own page,
 * buildings and units, and the hero's phase switch moves between them — but in
 * a list of properties they are one property. The entry is the earliest phase,
 * so a card opens on Phase I and the switch leads on from there, carrying the
 * buildings, sold and available counts of every phase added together so the
 * card describes the whole development rather than the part it opens on.
 *
 * Order is kept: a development sits where its first phase sorts. Properties
 * with no phase pass through untouched.
 */
export function collapsePhases(properties) {
  const groups = new Map()
  const entries = []
  for (const property of properties ?? []) {
    const phase = parsePhase(storedName(property))
    if (!phase) {
      entries.push({ property })
      continue
    }
    const group = groups.get(phase.base)
    if (group) {
      group.push({ property, order: phase.order })
      continue
    }
    const members = [{ property, order: phase.order }]
    groups.set(phase.base, members)
    entries.push({ members })
  }

  return entries.map(({ property, members }) => {
    if (property) return property
    if (members.length === 1) return members[0].property
    const sorted = [...members].sort((a, b) => a.order - b.order)
    const sum = (key) => sorted.reduce((total, { property: p }) => total + (Number(p[key]) || 0), 0)
    return {
      ...sorted[0].property,
      buildings: sum('buildings'),
      sold: sum('sold'),
      available: sum('available'),
    }
  })
}

export function phaseSiblings(properties, current) {
  const self = parsePhase(storedName(current))
  if (!self) return []

  const group = (properties ?? [])
    .map((property) => ({ property, phase: parsePhase(storedName(property)) }))
    .filter(({ phase }) => phase?.base === self.base)
    .sort((a, b) => a.phase.order - b.phase.order)

  if (group.length < 2) return []

  return group.map(({ property, phase }) => ({
    slug: property.slug,
    label: phase.label,
    isCurrent: property.slug === current.slug,
  }))
}
