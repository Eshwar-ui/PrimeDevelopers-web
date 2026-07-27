// Single source of truth for the four leasing-map unit statuses — shared
// between the admin editor (status dropdown) and the public interactive grid
// (chip color + legend), so the two never drift apart.
export const UNIT_STATUSES = [
  { value: 'available', label: 'Available', swatch: 'bg-[var(--color-status-available)]', chip: 'bg-[var(--color-status-available)] text-void' },
  { value: 'leased', label: 'Leased', swatch: 'bg-[var(--color-status-leased)]', chip: 'bg-[var(--color-status-leased)] text-void' },
  { value: 'coming-soon', label: 'Coming Soon', swatch: 'bg-ember', chip: 'bg-ember text-void' },
  { value: 'sold', label: 'Sold', swatch: 'bg-accent-soft', chip: 'bg-accent-soft text-void' },
]

export const unitStatusMeta = (value) => UNIT_STATUSES.find((s) => s.value === value) ?? UNIT_STATUSES[0]
