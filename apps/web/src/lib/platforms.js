/**
 * The channels an update can come from, and the one colour each is allowed to
 * bring with it.
 *
 * Lives here rather than beside the section that renders it because the admin's
 * platform picker needs the same list. Importing it from the component would
 * pull that component — and its router links, icons and section chrome — into
 * the admin bundle to read one array of strings.
 *
 * The tints are deliberately not the official brand hexes. Instagram's magenta,
 * WhatsApp's green and YouTube's red are all specified against white, and each
 * falls apart on one of our two grounds — the green washes out on the light
 * theme's white surface, the reds glare on the dark. These are the brand hues
 * pulled to a value that holds on both. They are worn by a 14px glyph and
 * nothing else; the label beside it stays in the section's own ink, which is
 * what keeps six cards from turning into a colour chart.
 */
export const PLATFORMS = {
  instagram: { label: 'Instagram', tint: '#d6336c' },
  facebook: { label: 'Facebook', tint: '#2b7cd3' },
  whatsapp: { label: 'WhatsApp', tint: '#1faa53' },
  linkedin: { label: 'LinkedIn', tint: '#1a6fb5' },
  youtube: { label: 'YouTube', tint: '#d93025' },
  // Inherits the surrounding ink: X's mark is black on white and white on
  // black, so it is the one glyph here with no colour of its own to keep.
  x: { label: 'X', tint: 'currentColor' },
  // Not a platform — our own writing, which the stream treats as one more
  // source so the journal and the socials sort against each other.
  article: { label: 'Journal', tint: 'var(--color-accent)' },
}

export const PLATFORM_KEYS = Object.keys(PLATFORMS)

/** Falls back to `article`, which is the only source that is always ours. */
export const platformMeta = (key) =>
  PLATFORMS[(key ?? '').trim().toLowerCase()] ?? PLATFORMS.article
