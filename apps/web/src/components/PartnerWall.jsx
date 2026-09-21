import { motion, useReducedMotion } from 'motion/react'
import { useSection } from '../context/ContentContext'
import { sized, srcSetFor } from '../lib/images'
import logoMark from '../assets/prime-logomark.svg'
import wordmark from '../assets/prime-wordmark.svg'

const TILE_TONES = [
  'bg-white',
  'bg-white',
  'bg-white',
  'bg-white',
]

/**
 * `sizes` is required rather than defaulted, because this tile renders at two
 * wildly different scales and a single width could only ever be right for one
 * of them: ~8vw as background texture in `LogoField`, and a third of the
 * screen in the wall proper. Every mark used to be fetched at 600px for both —
 * on a 1440px display that is a 115px slot being handed a 600px file.
 */
function LogoTile({ logo, index, sizes, columns }) {
  const reduced = useReducedMotion()

  /**
   * `once: false` is the whole behaviour: the tile opens as it is scrolled
   * onto and closes again when it leaves, rather than animating a single time
   * and staying put. The `-10%` margin is what keeps that from firing on the
   * pixel a tile clips the edge — it has to be properly on screen to open, and
   * properly gone to close, so a small scroll nudge near the boundary does not
   * flicker it.
   *
   * Dropped entirely under `prefers-reduced-motion`, rather than shortened.
   * A one-shot entrance is a reasonable thing to keep for someone sensitive to
   * motion; content that re-animates every time it passes the fold is not.
   */
  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: false, margin: '-10% 0px' },
        transition: {
          // 0.85s rather than 0.8s: a quad ease is within a rounding error of
          // its end value at about 95% of the run, so the tile *looks* done a
          // little before the clock does. 0.85 puts that visual settle on 800ms.
          duration: 0.85,
          // A quadratic ease-out, not the expo the rest of the file uses.
          // Expo spends its budget almost immediately — measured on this tile,
          // `[0.22, 1, 0.36, 1]` over 0.9s was already half faded at 100ms and
          // visually settled by 300ms, so the long tail was time the eye never
          // saw and lengthening the duration did nothing. A quad spreads the
          // change across the whole run, which is what actually reads as slow
          // and smooth.
          ease: [0.25, 0.46, 0.45, 0.94],
          // Position in its own row, so each row deals itself out left to
          // right and the grid as a whole runs 1 → n in order.
          //
          // This was `index % 5` against grids of three and four columns, so
          // the ramp reset mid-row: on the phone's three columns the delays
          // ran 0, .04, .08 / .12, .16, 0 — the sixth tile landed before the
          // fourth and fifth, which is the out-of-order shuffle you could see.
          //
          // Keyed to the row rather than to the absolute index because every
          // tile animates on its own entry into view, not on a shared
          // timeline: `index * step` would leave the twentieth tile sitting
          // blank for over a second after it was already on screen.
          delay: (index % columns) * 0.1,
        },
      }

  return (
    <motion.div
      {...reveal}
      className={'flex aspect-square items-center justify-center rounded-xl border border-white/80 p-2.5 shadow-[0_14px_32px_-22px_rgba(0,0,0,.55)] ' + TILE_TONES[index % TILE_TONES.length]}
    >
      <img
        src={sized(logo.image, 'logo')}
        srcSet={srcSetFor(logo.image, 'logo')}
        sizes={sizes}
        alt={logo.alt ?? ''}
        loading="lazy"
        decoding="async"
        className="max-h-[68%] max-w-[76%] object-contain"
      />
    </motion.div>
  )
}

const FIELD_COLUMNS = 4

/**
 * Where the last, partial row starts so it sits against the field's outer
 * edge — flush left in the left field, flush right in the right field.
 *
 * Outer rather than centred because the two fields are a pair framing the
 * lockup: a centred stub floats in the middle of its own field and reads as a
 * row that fell short, where one aligned to the outer edge keeps the block's
 * silhouette and lets the ragged edge face the mark.
 *
 * This was two hardcoded ternaries — `index === 8 ? 'col-start-3' : index === 9
 * ? 'col-start-4'` — which only lined up for a field of exactly ten marks. The
 * wall is CMS-managed and currently holds twenty-one, so any count the client
 * lands on has to compose. Returns null when the last row is full and nothing
 * needs moving.
 */
const lastRowStart = (count, side) => {
  const remainder = count % FIELD_COLUMNS
  if (remainder === 0) return null
  // Left is column 1, which is where the grid would flow it anyway; right has
  // to be pushed out far enough that the stub *ends* on the last column.
  return {
    first: count - remainder,
    column: side === 'right' ? FIELD_COLUMNS - remainder + 1 : 1,
  }
}

function LogoField({ logos, side, indexOffset = 0 }) {
  const last = lastRowStart(logos.length, side)
  return (
    <div
      className={
        'pointer-events-none absolute inset-y-0 hidden w-[35%] overflow-hidden lg:block ' +
        (side === 'left' ? 'left-0 bg-gradient-to-r from-void via-void/90 to-transparent' : 'right-0 bg-gradient-to-l from-void via-void/90 to-transparent')
      }
    >
      <div
        className="absolute inset-0 opacity-55"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
          maskImage: side === 'left' ? 'linear-gradient(90deg, black 0%, transparent 92%)' : 'linear-gradient(270deg, black 0%, transparent 92%)',
        }}
      />
      <div className="relative grid h-full grid-cols-4 content-center gap-3 px-6 py-8 md:gap-3 md:px-8">
        {logos.map((logo, index) => (
          <div
            key={logo.image + '-' + index}
            style={last && index === last.first ? { gridColumnStart: last.column } : undefined}
          >
            <LogoTile
              logo={logo}
              index={index + indexOffset}
              columns={FIELD_COLUMNS}
              // The field is `w-[35%]` in four columns with gaps and padding,
              // so a tile is under 8vw. These are decoration behind the copy
              // and never read as marks — nothing here justifies a large file.
              sizes="8vw"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PartnerWall() {
  const { logos = [] } = useSection('marquee')
  const reduced = useReducedMotion()
  const visibleLogos = logos.filter((logo) => logo.image)

  if (!visibleLogos.length) return null

  const half = Math.ceil(visibleLogos.length / 2)
  const leftLogos = visibleLogos.slice(0, half)
  const rightLogos = visibleLogos.slice(half)

  return (
    <section id="partners" className="relative min-h-[calc(100svh-5rem)] overflow-hidden bg-void px-0 py-0">
      <div className="relative min-h-[calc(100svh-5rem)] overflow-hidden">
        <div className="relative min-h-[calc(100svh-5rem)] overflow-hidden">
          {/* Half the wall either side of the mark, not the whole list on
              one side. Handed all twenty-one, a four-column field is six rows
              deep — taller than the band — so the marks ran off the bottom of
              the right edge and the left half of the section was empty.

              `ceil` puts the odd mark on the left, which is the side that is
              read first. */}
          <LogoField logos={leftLogos} side="left" />
          <LogoField logos={rightLogos} side="right" indexOffset={leftLogos.length} />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{
              backgroundImage: 'radial-gradient(circle at center, rgba(0,115,164,.16), transparent 38%)',
            }}
          />

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            // Desktop-only furniture. From `lg` this is the centrepiece the
            // two logo fields are arranged around, and the full height is what
            // gives it room. Below `lg` there are no fields — the marks are in
            // the grid underneath — so the lockup framed nothing and simply
            // cost the reader a whole screen before the first partner. No
            // padding either at that size, so the wrapper collapses to nothing
            // and the grid starts at the top of the section.
            className="relative z-10 mx-auto flex flex-col items-center justify-center gap-7 px-6 text-center md:px-10 lg:min-h-[calc(100svh-5rem)] lg:py-20"
          >
            {/* Kept as a heading, but out of the picture: the band is meant to
                be the lockup alone.

                Not deleted outright, because the lockup is artwork — strip
                this and the section has no text at all, so it drops out of the
                page outline and a screen reader reaches a run of partner logos
                with nothing saying what they are. `sr-only` is absolutely
                positioned, so it leaves the flex flow entirely and the lockup
                centres on its own. */}
            <h2 className="sr-only">Our Partners</h2>
            {/* Mark and wordmark as one stacked lockup, so the two move
                together and the space between them belongs to the lockup
                rather than to the section's `gap-7`.

                1rem, and fixed rather than fluid so it reads the same at every
                size the mark takes. It is deliberately tighter than the
                `gap-7` above it: at 2rem the lockup's own two halves sat
                further apart than the lockup sat from the heading, which
                grouped the mark with the heading instead of with its wordmark.

                Note this is inside the brand guide's 31px logomark exclusion
                zone. That zone governs the mark against *other* content; the
                wordmark is the other half of the same lockup, so the two are
                spaced as one object — but it is a judgement call the brand
                owner should confirm. */}
            <div className="hidden flex-col items-center gap-4 lg:flex" style={{ '--mark-h': 'min(16rem, 40vh)' }}>
              <img
                src={logoMark}
                // Decorative. The wordmark below is the accessible name now,
                // and an alt here would have a screen reader read it twice.
                alt=""
                decoding="async"
                className="h-[var(--mark-h)] w-auto max-w-[72vw]"
              />
              {/* The official wordmark artwork rather than type. Its "E" is
                  three bars, not a glyph, so no combination of weight and
                  tracking in Rubik reaches it — set as text this read as a
                  near-miss of the brand instead of the brand.

                  `prime-wordmark.svg` is `prime-logo.svg` with the two
                  logomark paths dropped and the viewBox pulled tight to what
                  is left (142.2 1.8 433.2 140.1, measured with getBBox), so
                  the letterforms are the drawn originals, untouched.

                  Width comes off the mark's height through the logomark's own
                  aspect — 929.04/1080 — which is what holds the two exactly
                  the same width at every size the mark takes. */}
              <img
                src={wordmark}
                alt="Prime Developer"
                decoding="async"
                className="w-[calc(var(--mark-h)*0.86022)] max-w-[72vw]"
              />
            </div>
          </motion.div>

          {/* `pt-10` because the lockup above collapses to nothing below `lg`:
              without it the first row of marks butts against the top edge of
              the section.

              The rows below the first screen are reached by scrolling, and the
              tiles animate themselves in and out as that happens — see the
              viewport config in `LogoTile`. */}
          <div className="relative z-10 grid grid-cols-3 gap-3 px-5 pb-8 pt-10 sm:grid-cols-5 lg:hidden">
            {visibleLogos.map((logo, index) => (
              <LogoTile
                key={logo.image + '-mobile-' + index}
                logo={logo}
                index={index}
                // The phone's three columns. This grid widens to five at `sm`,
                // where the cascade stops being row-aligned — a tablet-width
                // band either side of a phone, and a stagger that runs three
                // across five still reads as a sweep rather than a reset.
                columns={3}
                // `grid-cols-3`, then `sm:grid-cols-5`, and gone from `lg` —
                // so the widest this is ever asked to be is a fifth of a
                // 1023px viewport.
                sizes="(min-width: 640px) 20vw, 33vw"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
