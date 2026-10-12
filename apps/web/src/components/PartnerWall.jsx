import { motion, useReducedMotion } from 'motion/react'
import { useSection } from '../context/ContentContext'
import { sized, srcSetFor } from '../lib/images'

/**
 * `columns` is the grid's column count at the size the stagger is tuned for,
 * so each row deals itself out left to right: the delay is the tile's position
 * in its own row, not its absolute index, because every tile animates on its
 * own entry into view — `index * step` would leave the twentieth tile blank
 * for over a second after it was already on screen.
 */
function LogoTile({ logo, index, columns }) {
  const reduced = useReducedMotion()

  // Dropped entirely under `prefers-reduced-motion` rather than shortened.
  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-10% 0px' },
        transition: {
          duration: 0.85,
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: (index % columns) * 0.08,
        },
        // Through motion rather than a `hover:-translate-y` class: the reveal
        // owns this element's inline transform, and would override the class.
        // Its own transition, so the lift doesn't inherit the reveal's delay.
        whileHover: { y: -6, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
      }

  return (
    <motion.div
      {...reveal}
      className="flex aspect-5/3 items-center justify-center bg-white p-4 transition-shadow duration-300 hover:shadow-[0_18px_36px_-16px_rgba(0,115,164,.55)]"
    >
      {/* The supplied artwork is framed with its padding already balanced per
          mark, so it is allowed nearly the whole tile rather than trimmed to a
          box of its own. */}
      <img
        src={sized(logo.image, 'logo')}
        srcSet={srcSetFor(logo.image, 'logo')}
        // Five across a 75rem wall from `lg`, three from `sm`, two on a phone.
        sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
        alt={logo.alt ?? ''}
        loading="lazy"
        decoding="async"
        className="max-h-full max-w-full object-contain"
      />
    </motion.div>
  )
}

export default function PartnerWall() {
  const { logos = [] } = useSection('marquee')
  const visibleLogos = logos.filter((logo) => logo.image)

  if (!visibleLogos.length) return null

  return (
    <section id="partners" className="bg-void px-5 py-8 md:px-10 md:py-12">
      {/* The wall is the logos alone, but the section still needs text: without
          it there is no entry in the page outline, and a screen reader reaches
          a run of partner marks with nothing saying what they are. */}
      <h2 className="sr-only">Our Partners</h2>
      <div className="mx-auto grid max-w-300 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {visibleLogos.map((logo, index) => (
          <LogoTile key={logo.image + '-' + index} logo={logo} index={index} columns={5} />
        ))}
      </div>
    </section>
  )
}
