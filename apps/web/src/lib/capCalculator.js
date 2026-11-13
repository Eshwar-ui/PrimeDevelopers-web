// The CAP / NNN investment calculator — the client's "Loan Price Sheet" as code.
//
// Every row here is a row of CAP_Loan_Price_Sheet.xlsx (sent 13 Nov 2026), in
// the sheet's own order and with the sheet's own formula, so a number on the
// site can be checked against the spreadsheet cell for cell. The row numbers
// in the comments are the sheet's. The test file pins BrickerZ Club (column J)
// and Spot Fusion Kitchen (column C) to the cent.
//
// One deliberate departure: the sheet's cash-on-cash is `=(cash flow / down
// payment) / 100` on a cell already formatted as a percentage, which prints
// −0.07% for a deal that is really −7.44%. That `/100` is dropped here. Every
// other formula is the sheet's, including the ones that are a matter of
// choice (simple rather than compound rent growth in year 5, the one-time
// closing cost inside year-1 cash flow) — see docs/cap-calculator-plan.md for
// the questions still open with the client.
//
// Percentages are stored and passed the way listings store `capRate`: 6.5
// means 6.5%, not 0.065. Results are plain numbers; formatting is the page's.

const isNumber = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * The sheet's assumptions block (B5–B13) and its dropdown lists (`Lists`).
 * Shipped defaults, overridden per field by `cap_listings.calculator` once an
 * editor saves the calculator settings in the admin.
 */
export const CALCULATOR_DEFAULTS = {
  enabled: true,
  rates: [6.5, 6.75, 7], // Lists!A2:A4
  terms: [20, 25, 30], // Lists!B2:B4
  // The sheet fixes 25% down. One option hides the control; add more in the
  // admin to let visitors choose.
  downPayments: [25], // B7
  defaultRate: 6.5, // B5
  defaultTerm: 25, // B6
  defaultDown: 25, // B7
  escalation: 3, // B8 — annual rent escalation
  appreciation: 3, // B9
  closingCost: 1, // B10 — % of purchase price
  landValue: 20, // B11 — % of price that is land, not depreciated
  depreciationYears: 39, // B12 — commercial straight-line
  holdYears: 5, // B13
}

// Slider bounds. Sliders replace the sheet's dropdowns, so these are wider than
// its lists (6.5-7%, 20-30 years) while still opening on the sheet's values.
export const SLIDERS = {
  rate: { min: 4, max: 10, step: 0.25 },
  term: { min: 10, max: 30, step: 1 },
  down: { min: 10, max: 50, step: 1 },
  price: { minShare: 0.5, maxShare: 1.5, step: 1000 },
}

const SCALARS = ['escalation', 'appreciation', 'closingCost', 'landValue', 'depreciationYears', 'holdYears']

/** A clean, sorted, de-duplicated option list, or the shipped one if nothing usable is left. */
function cleanOptions(list, fallback, { max = Infinity } = {}) {
  const values = Array.isArray(list) ? list.filter((n) => isNumber(n) && n >= 0 && n <= max) : []
  const unique = [...new Set(values)].sort((a, b) => a - b)
  return unique.length ? unique : fallback
}

/**
 * The calculator's settings: what the admin saved, over the shipped defaults,
 * made safe to compute with.
 *
 * An editor can leave a field blank (the admin's NumberField stores null) or
 * delete every option from a list; either falls back to the shipped value
 * rather than producing NaN on a public page. A default that is not among its
 * options snaps to the nearest one, so the control always opens on a choice
 * it actually offers.
 */
export function calculatorSettings(stored) {
  const raw = stored && typeof stored === 'object' ? stored : {}
  const settings = { ...CALCULATOR_DEFAULTS, enabled: raw.enabled !== false }

  settings.rates = cleanOptions(raw.rates, CALCULATOR_DEFAULTS.rates, { max: 100 })
  settings.terms = cleanOptions(raw.terms, CALCULATOR_DEFAULTS.terms, { max: 100 }).filter((n) => n > 0)
  if (!settings.terms.length) settings.terms = CALCULATOR_DEFAULTS.terms
  settings.downPayments = cleanOptions(raw.downPayments, CALCULATOR_DEFAULTS.downPayments, { max: 100 })

  for (const key of SCALARS) {
    if (isNumber(raw[key]) && raw[key] >= 0) settings[key] = raw[key]
  }
  // Both are divisors or loop bounds; zero would be meaningless rather than
  // merely unusual.
  if (!(settings.depreciationYears > 0)) settings.depreciationYears = CALCULATOR_DEFAULTS.depreciationYears
  if (!(settings.holdYears > 0)) settings.holdYears = CALCULATOR_DEFAULTS.holdYears
  settings.holdYears = Math.round(settings.holdYears)

  const nearest = (list, value) =>
    list.reduce((best, n) => (Math.abs(n - value) < Math.abs(best - value) ? n : best), list[0])
  settings.defaultRate = nearest(settings.rates, isNumber(raw.defaultRate) ? raw.defaultRate : CALCULATOR_DEFAULTS.defaultRate)
  settings.defaultTerm = nearest(settings.terms, isNumber(raw.defaultTerm) ? raw.defaultTerm : CALCULATOR_DEFAULTS.defaultTerm)
  settings.defaultDown = nearest(settings.downPayments, isNumber(raw.defaultDown) ? raw.defaultDown : CALCULATOR_DEFAULTS.defaultDown)

  return settings
}

/**
 * The monthly payment on a loan: Excel's `-PMT(rate, periods, principal)`.
 * `rate` is per period. A zero rate is straight division, which PMT handles
 * and the closed form does not.
 */
export function pmt(rate, periods, principal) {
  if (!(periods > 0)) return 0
  if (rate === 0) return principal / periods
  return (principal * rate) / (1 - (1 + rate) ** -periods)
}

/**
 * What is still owed after `paid` payments: Excel's `FV(rate, paid, payment,
 * -principal)`, as the sheet uses it in row 38.
 */
export function loanBalance(rate, paid, payment, principal) {
  if (rate === 0) return principal - payment * paid
  const growth = (1 + rate) ** paid
  return principal * growth - payment * ((growth - 1) / rate)
}

/**
 * Every row of the sheet for one listing and one choice of terms.
 *
 * `listing` needs `price` and `rent` (yearly); `sf` only feeds the per-SF
 * rows. Returns null when either of the two is missing, so the page can leave
 * the calculator off a listing that cannot be run rather than show zeros.
 *
 * `choice` is `{ rate, term, down }` in percent / years / percent.
 */
export function capNumbers(listing, settings, choice) {
  // `choice.price` is the purchase price a visitor has dragged the slider to;
  // the rent stays the deal's, so the CAP rate moves with the price.
  const price = isNumber(choice?.price) && choice.price > 0 ? choice.price : listing?.price
  const rent = listing?.rent
  if (!isNumber(price) || price <= 0 || !isNumber(rent) || rent < 0) return null

  const s = settings ?? calculatorSettings(null)
  const rate = isNumber(choice?.rate) ? choice.rate : s.defaultRate
  const term = isNumber(choice?.term) && choice.term > 0 ? choice.term : s.defaultTerm
  const down = isNumber(choice?.down) ? Math.min(Math.max(choice.down, 0), 100) : s.defaultDown
  const sf = isNumber(listing.sf) && listing.sf > 0 ? listing.sf : null
  const hold = s.holdYears

  const monthlyRate = rate / 100 / 12
  const payments = term * 12

  const downPayment = price * (down / 100) // row 26
  const loan = price - downPayment // row 27
  const monthlyPayment = pmt(monthlyRate, payments, loan) // row 30
  const annualDebt = monthlyPayment * 12 // row 31
  // Row 24 is "Expenses excluding mortgage", 0 for every tenant: on a NNN
  // lease the tenant carries taxes, insurance and maintenance, so NOI is the
  // rent. The listing's `nnn` figure is what the tenant pays, not the owner.
  const expenses = 0
  const noi = rent - expenses // row 32
  const closingCost = price * (s.closingCost / 100) // row 33
  const cashFlowYear1 = noi - annualDebt - closingCost // row 34
  // Not on the sheet: the same year without the one-time closing cost, which
  // is what every year after the first looks like before rent escalates.
  const cashFlowOngoing = noi - annualDebt
  const cashOnCash = downPayment > 0 ? cashFlowYear1 / downPayment : null // row 35, without the `/100`
  const capRate = rent / price // row 36

  // Row 37: `(rentSF + rentSF × 3% × (hold − 1)) × SF`. The SF cancels, so it
  // is written on the rent directly and still works on a listing with no size.
  const noiAtHold = rent * (1 + (s.escalation / 100) * (hold - 1))

  // Row 38. A hold longer than the loan has nothing left to pay off; FV past
  // the last payment would go negative, so the count stops at the term.
  const paid = Math.min(hold * 12, payments)
  const balanceAtHold = Math.max(0, loanBalance(monthlyRate, paid, monthlyPayment, loan))
  const principalPaid = loan - balanceAtHold

  const appreciation = price * ((1 + s.appreciation / 100) ** hold - 1) // row 39
  const depreciation = ((price - price * (s.landValue / 100)) / s.depreciationYears) * hold // row 40

  return {
    rate,
    term,
    down,
    hold,
    price,
    rent,
    pricePerSf: sf ? price / sf : null, // row 20
    rentPerSf: sf ? rent / sf : null, // row 21
    monthlyRent: rent / 12, // row 22
    downPayment,
    loan,
    monthlyPayment,
    annualDebt,
    noi,
    closingCost,
    cashAtClose: downPayment + closingCost,
    cashFlowYear1,
    cashFlowOngoing,
    cashOnCash,
    capRate,
    noiAtHold,
    balanceAtHold,
    principalPaid,
    appreciation,
    depreciation,
    // The sheet's 5-year rows assume the lease is still running at the end of
    // the hold. Of the seventeen deals only N & S (3 years) has a shorter
    // lease; the page says renewal is assumed when this is true.
    assumesRenewal: isNumber(listing.leaseTerm) && listing.leaseTerm < hold,
  }
}

/** Should the listing page offer the calculator for this deal at all? */
export const canRunNumbers = (listing, settings) =>
  Boolean(settings?.enabled) && listing?.status !== 'sold' && capNumbers(listing, settings, {}) !== null

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** "BrickerZ Club · Unit 203, 204" — how a deal is named in a picker or on a lead. */
export const capDealName = (listing) =>
  `${listing?.tenant ?? ''}${listing?.units ? ` · Unit ${listing.units}` : ''}`.trim()

/**
 * The scenario a visitor ran, as flat fields for a lead's `context`.
 *
 * Strings, already formatted, because the leads admin prints context values
 * as they are and sales reads them as written: "$442,567", not 442567.2. The
 * API caps context at 20 fields, so the terms travel as one field rather than
 * three.
 */
export function capScenarioContext(listing, numbers) {
  if (!listing || !numbers) return null
  return {
    calculatorDeal: capDealName(listing),
    // The price the visitor ran, which the price slider lets differ from the
    // listing's — the one figure sales cannot work out from the deal name.
    calculatorPrice: usd.format(numbers.price),
    calculatorTerms: `${numbers.rate}% · ${numbers.term} yrs · ${numbers.down}% down`,
    calculatorCashAtClose: usd.format(numbers.cashAtClose),
    calculatorMonthlyPayment: usd.format(numbers.monthlyPayment),
  }
}
