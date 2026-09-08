import { useMemo } from 'react'
import { motion } from 'motion/react'
import { rise } from '../lib/motion'
import CountUp from './CountUp'

/**
 * The /properties opener: the portfolio stated in figures.
 *
 * This replaced a full-fold map — a synthetic street network drawn in SVG with
 * the towns pinned onto it by real Web Mercator projection. The arrangement was
 * true and the drawing was honest about being texture, but the fold did not
 * work: the streets sat at low opacity on a near-black ground and read as a
 * smudge rather than as a map, and the pins carrying the only real information
 * were pushed under the fold by the copy above them. A picture that has to be
 * explained is not doing the job a picture is for.
 *
 * The figures do what the map was reaching for and could not reach. "We hold a
 * portfolio of this size, this much of it is spoken for, this much is free
 * today" is the shape of the business, and it is legible in one pass at any
 * width, in either theme, with nothing to render badly.
 *
 * ── On sizing ──────────────────────────────────────────────────────────────
 *
 * No `dvh` anywhere, and no viewport-height floor. The old fold carried both
 * because it was a fixed one-screen composition: the copy and the pin band
 * competed for one column of pixels, so a short window had to shrink the type
 * rather than push the pins off the bottom, and a `min-h` of 58rem kept the map
 * from collapsing on a 1366×768 laptop. With the map gone there is no fold to
 * defend — the section is as tall as what it holds, and the grid of listings
 * below now starts roughly 400px further up the page.
 *
 * That is DESIGN.md §2's own rule applied rather than inherited: a `dvh` term
 * belongs only where a heading shares a fixed one-screen fold with something
 * beneath it. Left in place here it would shrink the headline on short windows
 * to make room for nothing.
 */

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

  return (
    <section
      id="properties-hero"
      data-band="light"
      // Padding, not height. The old fold set a floor of 58rem so the map had
      // somewhere to live; this section is as tall as its copy and its figures,
      // which on a laptop puts the collection grid within reach of the first
      // scroll instead of a screen and a half below it.
      className="bg-base px-gutter pb-20 pt-32 text-content md:px-gutter-lg md:pb-24 md:pt-36"
    >
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
            className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-panel bg-[var(--color-line)] md:mt-20 md:grid-cols-4"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1.5 bg-base px-4 py-7">
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
