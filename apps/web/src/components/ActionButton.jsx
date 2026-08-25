/**
 * The compact button the cards on the landing page are built from.
 *
 * Distinct from [`PrimePill`](./PrimePill.jsx), which is the page-level call to
 * action at `h-14` with an arrow disc riding its edge. These sit inside cards,
 * two or three to a row, and at that size the disc stops reading as a mark and
 * starts reading as clutter. Same family, smaller register.
 *
 * Both tones are role tokens, not pigments, so the pair still separates when
 * the theme flips — `accent` carries its own foreground, and `ghost` borrows
 * the section's.
 */
// `group` so a caller can hang a hover on an icon it passes as a child — the
// arrow on the featured panel's primary action is the reason.
const BASE =
  'group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 font-body text-[13px] font-bold outline-none transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-brand active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transform-none'

const TONES = {
  // `text-white` rather than `text-invert-fg`: the accent fill is CG Blue in
  // both themes, so its foreground has to be fixed too. A role token here goes
  // near-black on the blue the moment the theme flips.
  accent: 'bg-accent text-white hover:bg-prime-deep hover:-translate-y-0.5 shadow-[0_10px_24px_-14px_var(--color-accent)]',
  // The solid pairing with `accent` — the comp draws it white on the dark
  // property cards. Role tokens, not `bg-white`: the card under it is
  // `bg-surface`, which is white in the light theme, and a white button on a
  // white card is an invisible button. `invert` flips to charcoal there and
  // carries its own foreground with it.
  invert: 'bg-invert text-invert-fg hover:-translate-y-0.5 hover:opacity-90 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9)]',
  ghost:
    'border border-content/20 text-content hover:border-accent hover:bg-accent/10 hover:text-accent hover:-translate-y-0.5',
}

export default function ActionButton({
  as = 'a',
  tone = 'accent',
  children,
  className = '',
  ...props
}) {
  const Tag = as
  return (
    <Tag className={`${BASE} ${TONES[tone] ?? TONES.accent} ${className}`} {...props}>
      {children}
    </Tag>
  )
}
