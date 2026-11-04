import { useRef } from 'react'
import { renderEmphasis } from '../lib/emphasis'
import { useTextReveal } from '../hooks/useTextReveal'

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
 *
 * The heading and lede reveal themselves on scroll. Doing it here rather than
 * in the five callers is the same argument that put the kicker here: five
 * hand-rolled reveals is how a page ends up with five staggers at four
 * durations. It also means a section gets the motion by using the component it
 * was already using, and the only sections that animate their type are the ones
 * whose type is worth animating.
 *
 * The eyebrow is deliberately left alone. It is four words of 11px type between
 * two hairlines, and splitting it would animate the rules along with it.
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
  const scope = useRef(null)

  // Keyed to the strings for the reason Properties and Services spell out: the
  // copy arrives from the CMS after mount, so a split built on the first pass
  // is built over an empty heading and never runs again.
  useTextReveal(scope, [heading, paragraph])

  return (
    <div
      ref={scope}
      className={`${centred ? 'flex flex-col items-center text-center' : ''} ${className}`}
    >
      {eyebrow && (
        <p className="flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
          {centred && <span aria-hidden className="h-px w-8 bg-accent/45" />}
          {eyebrow}
          <span aria-hidden className="h-px w-8 bg-accent/45" />
        </p>
      )}

      {heading && (
        <h2
          // Remounts the heading whenever the copy changes, which is what makes
          // it safe to hand this node to SplitText at all. SplitText replaces
          // the children with its own spans, so the text node React created is
          // gone — React's next update writes into a node that is no longer in
          // the document, and the revert that follows restores the *previous*
          // string over the new one. A changed key throws the element away
          // instead, and the split is rebuilt on copy that is actually current.
          key={heading}
          data-text-reveal
          // The top margin spaces the heading off the eyebrow, so it is only
          // owed when there is an eyebrow to space it off. Unconditional, it
          // became 20px of orphaned margin at the very top of every section
          // that ships without one — the academy teaser and the updates rail
          // both do — stacked directly onto the section's own padding, where it
          // read as the gap above the heading being wrong rather than as a
          // margin belonging to anything.
          className={`font-display font-bold leading-[1.1] tracking-[-0.02em] text-content ${
            eyebrow ? 'mt-5' : ''
          } ${centred ? 'max-w-[22ch]' : 'max-w-[18ch]'} ${headingClass}`}
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
          // Same reason as the heading above.
          key={paragraph}
          data-text-reveal="lines"
          // A beat behind the heading rather than with it. Started together,
          // the lede's first line rises alongside the heading's last word and
          // the two read as one block of movement; a fifth of a second apart,
          // the heading lands and the lede answers it.
          data-text-reveal-delay="0.2"
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
