import { Fragment } from 'react'

// Tighter than the block stagger around it — words are read as one phrase, so
// the sweep across them has to feel like a single gesture, not a queue.
export const WORD_STAGGER = 0.052

// Counts what MaskedHeading will actually render, so anything timed to land
// after the last word — the homepage flag, a trailing rule — stays correct for
// whatever heading the CMS carries rather than guessing at a fixed delay.
export const wordCount = (text) =>
  text ? text.trimEnd().replace(/\*/g, '').split(/\s+/).filter(Boolean).length : 0

/**
 * Splits a CMS heading into individually-masked words that rise into frame.
 *
 * Per-word rather than per-line because the line breaks are the browser's, not
 * the content's — the headline re-wraps at every breakpoint, and a mask cut to
 * measured line boxes would be wrong the moment the viewport changed.
 *
 * Carries the same `*emphasis*` convention as renderEmphasis, so a heading
 * reads identically whether it animates or not. `accentClass` is what decides
 * whether that emphasis shows: the homepage hero passes nothing, where the
 * flourish would fight a headline already set in full display caps.
 */
export default function MaskedHeading({ text, startIndex = 0, accentClass = '' }) {
  if (!text) return null

  let n = startIndex
  return text
    .trimEnd()
    .split('\n')
    .map((line, li, lines) => (
      <Fragment key={li}>
        {/* A capturing split alternates plain and emphasised segments, and
            drops the asterisks on the way through. */}
        {line.split(/\*(.+?)\*/g).flatMap((segment, si) => {
          const accented = si % 2 === 1
          return segment
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => {
              // Counted across lines and segments, not per line, so a two-line
              // heading keeps one continuous sweep instead of restarting at
              // each break.
              const delay = n++ * WORD_STAGGER
              return (
                <Fragment key={n}>
                  {/* pb/-mb pair: overflow-hidden would otherwise shave
                      descenders and the underside of the cap line. */}
                  <span className="inline-block overflow-hidden pb-[0.08em] align-bottom -mb-[0.08em]">
                    <span
                      className={`word-rise inline-block ${accented ? accentClass : ''}`}
                      style={{ animationDelay: `${delay}s` }}
                    >
                      {word}
                    </span>
                  </span>{' '}
                </Fragment>
              )
            })
        })}
        {li < lines.length - 1 && <br />}
      </Fragment>
    ))
}
