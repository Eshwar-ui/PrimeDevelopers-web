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
  'group inline-flex w-full sm:w-auto min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 font-body text-[13px] font-bold outline-none transition-[background-color,border-color,color,transform,translate,scale,rotate,box-shadow] duration-200 ease-brand active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transform-none'

const TONES = {
  // Brand CG Blue as a fixed pigment, not the `accent` role token. Under the
  // dark theme `accent` lifts to #63b4dc — right for blue *text* on a dark
  // ground, wrong for a fill: white on it measured ~2.2:1 and read as a washed
  // out pill, and `prime-deep` (its hover) lifts too, so hovering made it
  // paler. #0073a4 carries white at 5.2:1 in both themes and deepens on hover.
  //
  // Depth from three layers rather than one soft glow: a top-down sheen and a
  // 1px inner highlight so the face reads as lit, a tight contact shadow so it
  // sits on the card, and a blue drop shadow that grows with the hover lift.
  accent:
    'bg-[#0073a4] bg-[linear-gradient(180deg,rgb(255_255_255/0.14)_0%,rgb(255_255_255/0)_55%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(0_0_0/0.3),0_10px_22px_-12px_rgb(0_115_164/0.9)] hover:-translate-y-0.5 hover:bg-[#00628c] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_2px_4px_rgb(0_0_0/0.3),0_16px_30px_-14px_rgb(0_115_164/1)] active:translate-y-0',
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
