// Shared by the two Rio Ranch content scripts (commercial lots and 1 acre lots).
// The lot records live in scripts/data/rio-ranch-lots.json — one per lot, as
// numbers — and the page formats them, so a status or a price changes there and
// nowhere else.
import { readFileSync } from 'node:fs'

// TODO: the client has not approved publishing lot prices. This one switch
// covers every priced thing on both pages: the price columns on the lot cards,
// the "How much…" FAQ (accordion and FAQPage markup, which read the same list),
// the "from $" overview stat and the priced intro wording. Flip to true once
// approved and re-run both scripts with --commit.
export const SHOW_LOT_PRICES = false
export const priced = (withPrices, without) => (SHOW_LOT_PRICES ? withPrices : without)

// TODO: both LoopNet listings use 3150 CR 258; the ZIP (78642) is assumed. Confirm
// both. The acre handoff spells it "County Road 258" — kept as "CR 258" on both
// records so the name/address/phone match across pages.
export const ADDRESS = '3150 CR 258, Liberty Hill, TX 78642'
export const MAP_QUERY = 'Ronald Reagan Blvd and CR 258, Liberty Hill, TX'

const DATA = JSON.parse(readFileSync(new URL('../data/rio-ranch-lots.json', import.meta.url), 'utf8'))

/** Lot records for 'commercial' or 'acre', price fields dropped while prices are held. */
export function lotRows(kind) {
  return DATA[kind].map(({ price, pricePerSf, status = 'available', ...lot }) => ({
    ...lot,
    status,
    ...(SHOW_LOT_PRICES ? { price, ...(pricePerSf != null ? { pricePerSf } : {}) } : {}),
  }))
}

/** All lots, prices included — for the figures quoted in priced copy. */
export const allLots = (kind) => DATA[kind]

/**
 * Hero strip totals from the lot records: `buildings` is the lot count, the
 * same three fields the {totalUnits} / {availableUnits} tokens read.
 */
export function totals(kind) {
  const lots = DATA[kind]
  const count = (s) => lots.filter((l) => (l.status ?? 'available') === s).length
  return { buildings: lots.length, available: count('available'), sold: count('sold') }
}

const acres = (n) => n.toFixed(2)
export const acreRange = (kind) => {
  const a = DATA[kind].map((l) => l.acres)
  return [acres(Math.min(...a)), acres(Math.max(...a))]
}
export const usd = (n) => `$${n.toLocaleString('en-US')}`

/** Click-to-load YouTube facades (VideoFacade). TODO: confirm each shows these lots. */
export const videos = (ids) =>
  ids.map((id, i) => ({ url: `https://www.youtube.com/watch?v=${id}`, title: `Rio Ranch video ${i + 1}` }))

/** FAQ rows; a row whose answer is null (the price answer while prices are held) is dropped. */
export const faqList = (rows) =>
  rows.filter(([, answer]) => answer).map(([question, answer]) => ({ question, answer }))
