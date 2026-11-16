import { motion } from 'motion/react'
import Prose from './Prose'
import { sized } from '../lib/images'
import { cardRise, cardStagger, inViewOnce } from '../lib/motion'
import { unitStatusMeta } from '../lib/unitStatus'

// Land sold by the lot (Rio Ranch), from `detail.lots`:
//
//   { heading, intro, note, sitePlan: { src, alt }, rows: [{ lot, acres, landSf,
//     pricePerSf?, price?, status }] }
//
// One record per lot, as numbers, so availability and price change in one
// place and the page does the formatting. Price fields are optional: the
// content script leaves them off while prices are unapproved (SHOW_LOT_PRICES),
// and a field no lot carries is not shown at all, rather than as a column of
// dashes. `status` reuses the unit statuses; a lot with none reads as available.

const acres = (n) => (Number.isFinite(n) ? n.toFixed(2) : '')
const sf = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '')
const usd = (n) => (Number.isFinite(n) ? `$${n.toLocaleString('en-US')}` : '')

const FIELDS = [
  ['acres', 'Acres', acres],
  ['landSf', 'Land area (SF)', sf],
  ['pricePerSf', 'Price per SF', usd],
  ['price', 'Price', usd],
]

export default function PropertyLots({ lots }) {
  const rows = (lots?.rows ?? []).filter((row) => row?.lot)
  if (!rows.length) return null
  const fields = FIELDS.filter(([key]) => rows.some((row) => Number.isFinite(row[key])))

  return (
    <div className="pt-8 md:pt-12">
      {lots.heading && (
        <h2 className="max-w-[24ch] text-balance font-display font-bold leading-[1.08] tracking-[-0.02em] text-content [font-size:clamp(1.9rem,3.4vw,3rem)]">
          {lots.heading}
        </h2>
      )}
      {lots.intro && (
        <div className="mt-6 max-w-[68ch] font-body text-[16px] leading-[1.7] text-content/70">
          <Prose text={lots.intro} />
        </div>
      )}

      {lots.sitePlan?.src && (
        <figure className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface">
          <img
            src={sized(lots.sitePlan.src, 'full')}
            alt={lots.sitePlan.alt || ''}
            loading="lazy"
            decoding="async"
            className="h-auto w-full object-contain"
          />
        </figure>
      )}

      <motion.ul
        variants={cardStagger}
        initial="hidden"
        whileInView="show"
        viewport={inViewOnce}
        className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {rows.map((row) => {
          const status = unitStatusMeta(row.status)
          return (
            <motion.li
              key={row.lot}
              variants={cardRise}
              className="min-w-0 rounded-2xl border border-line bg-surface px-6 py-5 shadow-[0_18px_45px_-38px_rgba(20,28,33,.45)]"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-display text-[1.5rem] font-bold leading-none tracking-[-0.02em] text-content">
                  <span className="sr-only">Lot </span>
                  {row.lot}
                </p>
                <span
                  className={`rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.12em] ${status.pill}`}
                >
                  {status.label}
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
                {fields.map(([key, label, format]) => (
                  <div key={key} className="min-w-0">
                    <dt className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-content/60">{label}</dt>
                    <dd className="mt-1 font-body text-[16px] font-medium tabular-nums text-content">
                      {format(row[key]) || '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.li>
          )
        })}
      </motion.ul>

      {lots.note && (
        <div className="mt-6 max-w-[68ch] font-body text-[14px] leading-[1.7] text-content/60">
          <Prose text={lots.note} />
        </div>
      )}
    </div>
  )
}
