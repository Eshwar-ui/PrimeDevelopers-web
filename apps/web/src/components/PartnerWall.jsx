import { motion, useReducedMotion } from 'motion/react'
import { useSection } from '../context/ContentContext'
import { sized, srcSetFor } from '../lib/images'
import logoMark from '../assets/prime-logomark.svg'

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
function LogoTile({ logo, index, sizes }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: (index % 5) * 0.04 }}
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
 * Where the last, partial row starts so it sits centred under the full rows
 * above it.
 *
 * This was two hardcoded ternaries — `index === 8 ? 'col-start-3' : index === 9
 * ? 'col-start-4'` — which only lined up for a field of exactly ten marks. The
 * wall is CMS-managed and currently holds twenty-one, so any count the client
 * lands on has to compose. Returns null when the last row is full and nothing
 * needs moving.
 */
const lastRowStart = (count) => {
  const remainder = count % FIELD_COLUMNS
  if (remainder === 0) return null
  return { first: count - remainder, column: Math.floor((FIELD_COLUMNS - remainder) / 2) + 1 }
}

function LogoField({ logos, side, indexOffset = 0 }) {
  const last = lastRowStart(logos.length)
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
            className="relative z-10 mx-auto flex min-h-[calc(100svh-5rem)] flex-col items-center justify-center gap-7 px-6 py-20 text-center md:px-10"
          >
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent md:text-xs">
              Our Partners
            </p>
            <img
              src={logoMark}
              alt="Prime Developers"
              decoding="async"
              className="h-[min(16rem,40vh)] w-auto max-w-[72vw]"
            />
          </motion.div>

          <div className="relative z-10 grid grid-cols-3 gap-3 px-5 pb-8 sm:grid-cols-5 lg:hidden">
            {visibleLogos.map((logo, index) => (
              <LogoTile
                key={logo.image + '-mobile-' + index}
                logo={logo}
                index={index}
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
