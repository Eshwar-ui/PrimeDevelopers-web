import { useMemo } from 'react'
import { motion } from 'motion/react'
import { rise } from '../lib/motion'
import CountUp from './CountUp'
import { sized } from '../lib/images'
import fallbackHeroImage from '../assets/property-1.webp'

/** Portfolio photography with a dark overlay and live availability figures. */

// `buildings` is the total-unit column, not a count of buildings. The admin
// still labels the field "Buildings" from a schema that changed underneath it,
// and every public surface already reads it as the unit total — PropertyHero
// prints it as "Total", the homepage teaser prints it with `unitsLabel`
// ("units"), and PropertyDetailPage divides `sold` by it to get the reserved
// percentage. Naming it correctly here rather than carrying the misnomer into
// a label a visitor would read.
const TOTAL_UNITS_KEY = 'buildings'

/**
 * The portfolio in four figures, each one derived rather than authored.
 *
 * Nothing here is a CMS field, and that is the point: a hand-typed "12
 * Properties" is wrong the day a thirteenth is added, and nobody notices
 * because the number still looks like a number. These count what is actually
 * in the list.
 *
 * Every figure is dropped when it would be zero. A portfolio with no unit
 * counts entered yet shows the property count alone rather than a row of
 * confident noughts, which reads as a business with nothing in it rather than
 * as a CMS that has not been filled in.
 */
function portfolioStats(properties) {
  const sum = (key) => properties.reduce((total, p) => total + (Number(p[key]) || 0), 0)

  const units = sum(TOTAL_UNITS_KEY)
  const available = sum('available')
  const sold = sum('sold')

  // The same formula PropertyDetailPage uses for a single listing, applied to
  // the whole list. Sharing the arithmetic is what stops one page saying 62%
  // reserved while another says 58% off the same rows.
  const reservedPct = units > 0 ? Math.round((sold / units) * 100) : 0

  return [
    { value: properties.length.toLocaleString(), label: 'Properties' },
    units > 0 && { value: units.toLocaleString(), label: 'Units in total' },
    available > 0 && { value: available.toLocaleString(), label: 'Available now' },
    units > 0 && sold > 0 && { value: `${reservedPct}%`, label: 'Reserved' },
  ].filter(Boolean)
}

export default function PropertiesHero({ properties = [], children }) {
  const stats = useMemo(() => portfolioStats(properties), [properties])
  const heroImage = properties.find((property) => property.image)?.image || fallbackHeroImage

  return (
    <section
      id="properties-hero"
      data-band="dark"
      // Padding, not height. The old fold set a floor of 58rem so the map had
      // somewhere to live; this section is as tall as its copy and its figures,
      // which on a laptop puts the collection grid within reach of the first
      // scroll instead of a screen and a half below it.
      className="relative isolate overflow-hidden bg-base px-gutter pb-20 pt-32 text-content md:pb-24 md:pt-36"
      style={{ '--color-content': '#e9f0f3', '--color-accent': '#60b6dc', '--color-line': 'rgba(255,255,255,0.2)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <img
          src={sized(heroImage, 'full')}
          alt=""
          fetchPriority="high"
          onError={(event) => {
            if (event.currentTarget.src.endsWith(fallbackHeroImage)) return
            event.currentTarget.src = fallbackHeroImage
          }}
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#071116]/65" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,17,22,0.35)_0%,transparent_45%,var(--color-base)_100%)]" />
      </div>
      <div className="mx-auto max-w-[1560px]">
        {children}

        {/* ── The portfolio, in figures ─────────────────────────
            Hairlines come from the 1px grid gap showing the wrapper's own
            ground through, rather than from a border on each cell. That is
            what makes the rules survive the wrap: at two columns the divisions
            land between the pairs, at four they run the length of the row, and
            neither layout needs to know which cell is first. A per-cell
            `border-l` cannot do that — it leaves a rule hanging off the third
            item the moment the row breaks. */}
        {stats.length > 1 && (
          <motion.dl
            variants={rise}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-10% 0px' }}
            // Glass, and the `gap-px` trick above is what makes it possible to
            // do properly: the blur belongs on the panel, once, so there is a
            // single sheet of glass rather than four tiles each blurring their
            // own patch of the photograph. The cells only tint.
            //
            // The hairlines move from the solid line colour to `white/10` for
            // the same reason — an opaque rule between two translucent cells
            // reads as a seam in the glass instead of an edge cut into it.
            //
            // `ring` rather than `border`: a border would sit inside
            // `overflow-hidden` and get clipped at the corner radius, and the
            // thin bright edge is most of what sells the material.
            className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-panel bg-white/10 shadow-[0_32px_70px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/15 backdrop-blur-xl backdrop-saturate-150 md:mt-20 md:grid-cols-4"
          >
            {stats.map((stat) => (
              // Tint only, no blur of its own — see the panel above. Kept dark
              // rather than the usual white wash because the panel sits over a
              // photograph of a building: a light tint would drop the numerals
              // towards the contrast floor exactly where the picture is
              // brightest.
              <div key={stat.label} className="flex flex-col items-center gap-1.5 bg-[#0b1216]/55 px-4 py-7">
                <dt className="order-2 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/70">
                  {stat.label}
                </dt>
                <dd className="numeral order-1 m-0 font-display text-[clamp(1.9rem,3.4vw,2.75rem)] font-bold leading-none tracking-[-0.02em] text-content">
                  <CountUp value={stat.value} />
                </dd>
              </div>
            ))}
          </motion.dl>
        )}
      </div>
    </section>
  )
}
