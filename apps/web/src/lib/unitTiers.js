// The size bands a unit is browsed by, and the plain-English name a card gives
// a unit of that size. Shared by the homepage teaser's filter pills and by the
// unit card itself, which names the tier in its heading — one list, so a band
// renamed in the filter cannot start disagreeing with the cards it returns.

// `name` is the card-facing size tier — the label a tenant scans for
// ("Small", "Medium"...) — separate from `label`, the filter pill's own
// wording. `all` carries no `name`: the overview tab shows every unit under
// its own tier, not one shared name.
//
// There is no "Under 500 SF" pill — the client asked for it to go. A unit
// that small still turns up under "Under 1,000 SF", which is what that label
// says anyway, rather than becoming reachable from Overview alone.
export const SIZE_TIERS = [
  { id: 'all', label: 'Overview', name: null, test: () => true },
  { id: 'sm', label: 'Under 1,000 SF', name: 'Medium', test: (sf) => sf > 0 && sf < 1000 },
  { id: 'md', label: '1,000 – 2,000 SF', name: 'Large', test: (sf) => sf >= 1000 && sf < 2000 },
  { id: 'lg', label: '2,000 – 4,000 SF', name: 'X-Large', test: (sf) => sf >= 2000 && sf < 4000 },
  { id: 'xl', label: '4,000+ SF', name: 'XX-Large', test: (sf) => sf >= 4000 },
]

// The card keeps calling a sub-500 unit "Small" even without a pill of its
// own; the name describes the unit, not the filter it was found under.
export const tierNameFor = (sf) =>
  sf > 0 && sf < 500 ? 'Small' : (SIZE_TIERS.slice(1).find((t) => t.test(sf))?.name ?? null)
