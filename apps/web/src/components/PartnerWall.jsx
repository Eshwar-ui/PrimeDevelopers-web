import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import { sized, srcSetFor } from '../lib/images'
import { revealGroup } from '../lib/reveal'

/**
 * One partner mark on a white panel.
 *
 * No longer a motion component, and no longer holding its own reveal. Each
 * tile used to carry a `whileInView` of its own with a delay of
 * `(index % columns) * 0.08` — the tile's position in its own row — which
 * dealt each row out left to right but could not sequence the wall, because
 * every row that entered the viewport in the same frame started in the same
 * frame. On a desktop that is the whole wall at once, four rows deep, four
 * sweeps running side by side.
 *
 * The sequence moved up to the grid, where one trigger can put twenty tiles in
 * a line: see `revealGroup`, which deals them out in DOM order — across the
 * first row, then across the second. The `columns` prop went with it, and so
 * did the grid's one piece of duplicated knowledge, since nothing here has to
 * agree with the breakpoint any more.
 */
function LogoTile({ logo }) {
  return (
    // The lift is a class again rather than a `whileHover`. It was motion-driven
    // because the reveal owned this element's inline transform and would have
    // beaten any utility class; `revealGroup` clears its props on completion, so
    // by the time a tile can be hovered the transform is the stylesheet's again.
    <div className="flex aspect-5/3 items-center justify-center bg-white p-4 transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-1.5 hover:shadow-[0_18px_36px_-16px_rgba(0,115,164,.55)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
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
    </div>
  )
}

export default function PartnerWall() {
  const { logos = [] } = useSection('marquee')
  const visibleLogos = logos.filter((logo) => logo.image)
  const gridRef = useRef(null)

  /* The wall deals itself out, one mark after the next.
   *
   * 0.07 rather than the shared default: these are small tiles in a tight grid
   * with nothing to read on them, so the sweep is the only thing giving the
   * wall a shape, and a step that lands under the eye's own saccade reads as
   * one flicker rather than as a sequence. `revealGroup` caps the total wave
   * regardless, so a client adding a twenty-fifth logo cannot turn this into
   * two seconds of dealing.
   *
   * Depends on the logo list: it arrives from the CMS after first paint, so the
   * first run has no children to collect and has to be able to run again.
   * `revertOnUpdate` is what makes that safe — the previous tween is reverted
   * before the next is built, rather than two tweens fighting over one tile. */
  useGSAP(
    () => {
      const group = revealGroup(gridRef.current, { step: 0.07, y: 26 })
      return () => group?.kill()
    },
    { scope: gridRef, dependencies: [visibleLogos.length], revertOnUpdate: true }
  )

  if (!visibleLogos.length) return null

  return (
    <section id="partners" className="bg-void px-5 py-8 md:px-10 md:py-12">
      {/* The wall is the logos alone, but the section still needs text: without
          it there is no entry in the page outline, and a screen reader reaches
          a run of partner marks with nothing saying what they are. */}
      <h2 className="sr-only">Our Partners</h2>
      <div ref={gridRef} className="mx-auto grid max-w-300 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {visibleLogos.map((logo, index) => (
          <LogoTile key={logo.image + '-' + index} logo={logo} />
        ))}
      </div>
    </section>
  )
}
