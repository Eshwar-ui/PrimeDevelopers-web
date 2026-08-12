import ArrowRight from './ArrowRight'

// Label styling is shared by both variants — the whole point of this component
// is that a call to action reads the same wherever it appears.
const LABEL = 'font-body text-[15px] font-bold uppercase tracking-[0.04em]'

// h-14 rather than a padding pair: the solid variant's height comes from its
// size-11 disc plus py-1.5, which the outline variant has no disc to inherit.
// Stating the number is what keeps a pair of them sitting on one line.
const HEIGHT = 'h-14'

/**
 * The site's primary call to action: a CG Blue lozenge with a white arrow disc
 * riding its trailing edge. Shared rather than restated per page so the hero
 * and the interior pages can't drift apart.
 *
 * `outline` is the same pill with the fill and the disc taken away — for the
 * second of a pair, where two arrow discs side by side would read as two
 * primary actions rather than a choice between them.
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
        className={`inline-flex items-center justify-center rounded-full border border-content/25 px-8 text-content transition-colors duration-300 hover:border-accent hover:text-accent ${HEIGHT} ${LABEL} ${className}`}
      >
        {children}
      </a>
    )
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={`group inline-flex items-center gap-4 rounded-full bg-[linear-gradient(96deg,#0073a4_0%,#1aa1d2_100%)] py-1.5 pl-7 pr-1.5 text-white shadow-[0_12px_26px_-16px_rgba(0,115,164,0.95)] transition-shadow duration-300 hover:shadow-[0_16px_32px_-14px_rgba(0,115,164,0.8)] ${className}`}
    >
      <span className={LABEL}>{children}</span>
      {/* charcoal, not `text-content`: the disc is hardcoded white in both
          themes, so its foreground has to be a pigment rather than a role token
          — under dark mode `--color-content` lifts to near-white and the arrow
          all but vanishes into the disc. */}
      <span className="flex size-11 items-center justify-center rounded-full bg-white text-charcoal">
        <ArrowRight className="size-4 -rotate-45 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </a>
  )
}
