// Single source of truth for the three interior finish tiers — shared between
// the tier grid, the typology detail page, the finished-unit gallery filter,
// and the admin editor's tier select, so none of them can drift apart. Mirrors
// the shape of `lib/unitStatus.js`'s status metadata.

export const TIERS = ['Basic', 'Mid-range', 'High-end']

const META = {
  Basic: {
    chip: 'bg-content/8 text-content/70',
  },
  'Mid-range': {
    chip: 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-accent',
  },
  'High-end': {
    chip: 'bg-[color-mix(in_srgb,var(--color-ember)_16%,transparent)] text-ember',
  },
}

export const tierMeta = (tier) => META[tier] ?? META.Basic

// `optionSlugs` on a gallery entry is a comma-separated string in the CMS,
// edited as a single text field the same way `academy.terms[].related` is —
// not an array, so an admin can type it without wrestling with a repeater for
// what is usually two or three slugs.
export const parseSlugList = (value = '') =>
  value.split(',').map((slug) => slug.trim()).filter(Boolean)
