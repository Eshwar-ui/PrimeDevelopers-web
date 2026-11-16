import { imageAlt } from './images'
import { formatUnitLabel, getBuildings, getUnitImages, getUnits } from './units'

/**
 * Every photograph a property holds, on one page.
 *
 * The property page's carousel shows one frame at a time, which is right for
 * a section halfway down a listing and wrong for someone who came to look:
 * with 100+ frames, "show me everything" is a page, not a strip of chips.
 *
 * Two kinds of photograph are gathered here: the property's own gallery (site
 * and exterior photography), and each unit's shoot, grouped by building. A
 * frame that appears in both is shown once, in the property group.
 */
export function collectGroups(property) {
  if (!property) return []
  const seen = new Set()
  const take = (src) => {
    if (!src || seen.has(src)) return false
    seen.add(src)
    return true
  }

  const groups = []
  const site = [property.image, ...(property.gallery ?? [])]
    .filter(take)
    .map((src) => ({ src, alt: imageAlt(property, src), caption: property.name }))
  if (site.length) groups.push({ key: 'property', label: 'The property', images: site })

  for (const building of getBuildings(property)) {
    const images = getUnits(building).flatMap((unit) => {
      // A sold unit's tenant may be a private owner (see PropertyDetailPage's
      // establishedAlt), so only a leased unit names its business.
      const unitName = `Unit ${formatUnitLabel(unit.label)}`
      const tenant = unit.status === 'leased' && String(unit.tenant ?? '').trim()
      const caption = [building.building, unitName, tenant].filter(Boolean).join(' · ')
      return getUnitImages(unit)
        .filter(take)
        .map((src) => ({
          src,
          alt: imageAlt(property, src) || `${tenant || unitName}, ${building.building ?? ''} at ${property.name}`,
          caption,
        }))
    })
    if (images.length) {
      groups.push({ key: `b-${building.building}`, label: building.building || 'Units', images })
    }
  }
  return groups
}


/** Every photograph, flat, each carrying the group it belongs to. */
export const flattenGroups = (groups) =>
  groups.flatMap((g) => g.images.map((image) => ({ ...image, groupKey: g.key, groupLabel: g.label })))
