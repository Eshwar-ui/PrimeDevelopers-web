/**
 * A property announced before it has units to sell (`detail.status:
 * 'coming-soon'`, set in the CMS). Its totals are all zero, which every
 * availability line would otherwise read as "Fully reserved".
 */
export const isComingSoon = (property) => property?.detail?.status === 'coming-soon'

/** "12 available", "Fully reserved", or "Coming soon". */
export const availabilityLabel = (property) => {
  if (isComingSoon(property)) return 'Coming soon'
  return property?.available > 0 ? `${property.available} available` : 'Fully reserved'
}
