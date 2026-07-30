// Single source of truth for the four leasing-map unit statuses — shared
// between the admin editor (status dropdown), the public 2D grid (chip color +
// legend), the DOM unit list and the 3D viewer's WebGL materials, so none of
// them can drift apart.
//
// `hex` exists because a WebGL material cannot read a Tailwind class string.
// `mutedHex` is what a unit desaturates to when a status filter excludes it —
// filtered units recede rather than vanish, so the building keeps its shape.
export const UNIT_STATUSES = [
  {
    value: 'available',
    label: 'Available',
    swatch: 'bg-[var(--color-status-available)]',
    chip: 'bg-[var(--color-status-available)] text-void',
    hex: '#3ecf7e',
    mutedHex: '#33443c',
  },
  {
    value: 'leased',
    label: 'Leased',
    swatch: 'bg-[var(--color-status-leased)]',
    chip: 'bg-[var(--color-status-leased)] text-void',
    hex: '#e2665c',
    mutedHex: '#4a3634',
  },
  {
    value: 'coming-soon',
    label: 'Coming Soon',
    swatch: 'bg-ember',
    chip: 'bg-ember text-void',
    hex: '#fca42e',
    mutedHex: '#4a3f2d',
  },
  {
    value: 'sold',
    label: 'Sold',
    swatch: 'bg-accent-soft',
    chip: 'bg-accent-soft text-void',
    hex: '#3e9bc7',
    mutedHex: '#2e3f47',
  },
]

// Geometry that is present in the model but is not a leasable unit — roads,
// parking bays, landscaping, water. Never interactive, never highlighted.
export const SCENERY_HEX = '#8b949a'

export const unitStatusMeta = (value) => UNIT_STATUSES.find((s) => s.value === value) ?? UNIT_STATUSES[0]
