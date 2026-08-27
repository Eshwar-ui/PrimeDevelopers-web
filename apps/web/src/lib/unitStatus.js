// Single source of truth for the four leasing-map unit statuses — shared
// between the admin editor (status dropdown), the public 2D grid (chip color +
// legend), the DOM unit list and the 3D viewer's WebGL materials, so none of
// them can drift apart.
//
// `hex` exists because a WebGL material cannot read a Tailwind class string.
// `mutedHex` is what a unit desaturates to when a status filter excludes it —
// filtered units recede rather than vanish, so the building keeps its shape.
//
// `chip` is the solid badge — the status as a block of colour. `pill` is the
// quiet form the availability list uses: the same hue at low alpha behind it and
// carrying the type, so a column of twenty rows reads as a list with statuses
// rather than as twenty coloured blocks. Mixed against `transparent` rather than
// a fixed white so the tint sits correctly on either theme's ground.
export const UNIT_STATUSES = [
  {
    value: 'available',
    label: 'Available',
    swatch: 'bg-[var(--color-status-available)]',
    chip: 'bg-[var(--color-status-available)] text-void',
    pill: 'bg-[color-mix(in_srgb,var(--color-status-available)_16%,transparent)] text-[var(--color-status-available)]',
    hex: '#3ecf7e',
    mutedHex: '#33443c',
  },
  {
    value: 'leased',
    label: 'Leased',
    swatch: 'bg-[var(--color-status-leased)]',
    chip: 'bg-[var(--color-status-leased)] text-void',
    pill: 'bg-[color-mix(in_srgb,var(--color-status-leased)_16%,transparent)] text-[var(--color-status-leased)]',
    hex: '#e2665c',
    mutedHex: '#4a3634',
  },
  {
    value: 'coming-soon',
    label: 'Coming Soon',
    swatch: 'bg-ember',
    chip: 'bg-ember text-void',
    pill: 'bg-[color-mix(in_srgb,var(--color-ember)_16%,transparent)] text-ember',
    hex: '#fca42e',
    mutedHex: '#4a3f2d',
  },
  {
    value: 'sold',
    label: 'Sold',
    swatch: 'bg-accent-soft',
    chip: 'bg-accent-soft text-void',
    pill: 'bg-[color-mix(in_srgb,var(--color-accent-soft)_16%,transparent)] text-accent-soft',
    hex: '#3e9bc7',
    mutedHex: '#2e3f47',
  },
]

// Geometry that is present in the model but is not a leasable unit — roads,
// parking bays, landscaping, water. Never interactive, never highlighted.
export const SCENERY_HEX = '#8b949a'

// A tagged road on a whole-site model: interactive (a visitor can see which
// road a building fronts) but never status-coloured or leasable, so it needs
// its own fixed colour rather than borrowing a unit status. Distinct from
// SCENERY_HEX so a tagged road doesn't read as untagged scenery.
export const ROAD_HEX = '#5b7a8c'

// A tagged building on a whole-site model, before a visitor has drilled into
// one of its units. Warmer than the road colour so the two read as different
// kinds of thing at a glance, not just different shades of grey.
export const BUILDING_HEX = '#9c8558'

export const unitStatusMeta = (value) => UNIT_STATUSES.find((s) => s.value === value) ?? UNIT_STATUSES[0]
