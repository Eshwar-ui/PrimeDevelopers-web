import ArrowRight from './ArrowRight'

// Label styling is shared by both variants — the whole point of this component
// is that a call to action reads the same wherever it appears.
const LABEL = 'font-body text-[15px] font-bold uppercase tracking-[0.04em]'

// h-14 rather than a padding pair: the solid variant's height comes from its
// size-11 disc plus py-1.5, which the outline variant has no disc to inherit.
// Stating the number is what keeps a pair of them sitting on one line.
const HEIGHT = 'h-14'

// Shared by the two filled variants — same lozenge, different pigment. Stated
// once so a solid pill and an inverted one cannot drift into two subtly
// different shapes.
const LOZENGE =
  'primary-button-flood group relative inline-flex items-center gap-4 overflow-hidden rounded-full py-1.5 pl-7 pr-1.5 outline-none transition-[color,transform,box-shadow] duration-200 ease-brand hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none'

/**
 * The site's primary call to action: a CG Blue lozenge with a white arrow disc
 * riding its trailing edge. Shared rather than restated per page so the hero
 * and the interior pages can't drift apart.
 *
 * `outline` is the same pill with the fill and the disc taken away — for the
 * second of a pair, where two arrow discs side by side would read as two
 * primary actions rather than a choice between them.
 *
 * `invert` is the charcoal lozenge the homepage hero draws, for a CTA standing
 * on photography rather than on a page ground. Every colour in it is a pigment
 * — charcoal, white — never a role token: a photograph does not change with the
 * theme, so a foreground that did would invert itself off the image in dark
 * mode. Its focus indicator is an `outline` rather than a `ring`, because a
 * ring's offset has to be painted in the colour behind the button, and behind
 * this one there is a photograph.
 */
export default function PrimePill({
  href,
  onClick,
  children,
  className = '',
  variant = 'solid',
}) {
  if (variant === 'outline') {
    return (
      <a
        href={href}
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-full border border-content/25 px-8 text-content outline-none transition-[color,border-color,background-color,transform] duration-200 ease-brand hover:-translate-y-0.5 hover:border-accent hover:bg-accent/5 hover:text-accent active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-3 focus-visible:ring-offset-base motion-reduce:transform-none ${HEIGHT} ${LABEL} ${className}`}
      >
        {children}
      </a>
    )
  }

  if (variant === 'invert') {
    return (
      <a
        href={href}
        onClick={onClick}
        className={`${LOZENGE} bg-charcoal text-white shadow-[0_18px_38px_-18px_rgba(0,0,0,0.9)] hover:shadow-[0_26px_50px_-16px_rgba(0,0,0,0.75)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white ${className}`}
      >
        <span className={LABEL}>{children}</span>
        {/* Inverts along with the flood. `--button-flood` is bone, so a disc
            that stayed white would dissolve into it halfway through the hover
            and take the arrow's counter-shape with it; swapping the disc to
            charcoal keeps the mark legible across the whole transition. */}
        <span className="flex size-11 items-center justify-center rounded-full bg-white text-charcoal transition-[background-color,color,transform] duration-200 ease-brand group-hover:bg-charcoal group-hover:text-white group-hover:translate-x-0.5 group-focus-visible:bg-charcoal group-focus-visible:text-white group-active:scale-95 motion-reduce:transform-none">
          <ArrowRight className="size-4 -rotate-45 transition-transform duration-200 ease-brand group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-active:translate-x-0 motion-reduce:transform-none" />
        </span>
      </a>
    )
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={`${LOZENGE} bg-[linear-gradient(96deg,#0073a4_0%,#1aa1d2_100%)] text-white shadow-[0_12px_26px_-16px_rgba(0,115,164,0.95)] hover:shadow-[0_18px_34px_-14px_rgba(0,115,164,0.82)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-3 focus-visible:ring-offset-base ${className}`}
    >
      <span className={LABEL}>{children}</span>
      {/* charcoal, not `text-content`: the disc is hardcoded white in both
          themes, so its foreground has to be a pigment rather than a role token
          — under dark mode `--color-content` lifts to near-white and the arrow
          all but vanishes into the disc. */}
      <span className="flex size-11 items-center justify-center rounded-full bg-white text-charcoal transition-transform duration-200 ease-brand group-hover:translate-x-0.5 group-active:scale-95 motion-reduce:transform-none">
        <ArrowRight className="size-4 -rotate-45 transition-transform duration-200 ease-brand group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-active:translate-x-0 motion-reduce:transform-none" />
      </span>
    </a>
  )
}
