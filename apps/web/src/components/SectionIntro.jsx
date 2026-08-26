import { renderEmphasis } from '../lib/emphasis'

/**
 * The section opener the landing page repeats five times: an accent kicker
 * flanked by rules, a display heading, and a lede.
 *
 * Shared rather than restated per section because the five differ only in
 * alignment and measure, and hand-rolling each one is how a page ends up with
 * five kickers at four tracking values. The design draws the kicker; that is
 * what earns it a place here.
 *
 * `align="center"` gives the kicker a rule on both sides — a centred label
 * with a rule on one side only reads as an alignment mistake rather than a
 * flourish.
 */
export default function SectionIntro({
  eyebrow,
  heading,
  paragraph,
  align = 'left',
  headingClass = '',
  className = '',
  children,
}) {
  const centred = align === 'center'

  return (
    <div className={`${centred ? 'flex flex-col items-center text-center' : ''} ${className}`}>
      {eyebrow && (
        <p className="flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
          {centred && <span aria-hidden className="h-px w-8 bg-accent/45" />}
          {eyebrow}
          <span aria-hidden className="h-px w-8 bg-accent/45" />
        </p>
      )}

      {heading && (
        <h2
          className={`mt-5 font-display font-bold leading-[1.1] tracking-[-0.02em] text-content ${
            centred ? 'max-w-[22ch]' : 'max-w-[18ch]'
          } ${headingClass}`}
          style={{ fontSize: 'clamp(1.75rem, 3.1vw, 2.85rem)' }}
        >
          {/* Emphasis is saffron here rather than the accent blue the rest of
              the site uses: on this page the blue is the interaction colour —
              every button and link is wearing it — so a blue word inside a
              heading reads as a link that cannot be clicked. */}
          {renderEmphasis(heading, 'text-ember')}
        </h2>
      )}

      {paragraph && (
        <p
          className={`mt-5 font-body text-[15px] leading-[1.75] text-content/60 ${
            centred ? 'max-w-[62ch]' : 'max-w-[58ch]'
          }`}
        >
          {paragraph}
        </p>
      )}

      {children}
    </div>
  )
}
