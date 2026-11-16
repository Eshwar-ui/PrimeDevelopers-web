import test from 'node:test'
import assert from 'node:assert/strict'
import { CALCULATOR_DEFAULTS, calculatorSettings, canRunNumbers, capDealName, capNumbers, capScenarioContext, loanBalance, pmt } from '../src/lib/capCalculator.js'

// Every expected value below is the cached result of the cell in
// CAP_Loan_Price_Sheet.xlsx, as Excel computed it. The sheet runs every tenant
// at 7% (row 28 is hard-coded), 25 years and 25% down.
const SHEET_TERMS = { rate: 7, term: 25, down: 25 }
const near = (actual, expected, places = 2) =>
  assert.ok(Math.abs(actual - expected) < 10 ** -places, `${actual} is not ${expected} to ${places} places`)

const brickerz = { price: 1702182, rent: 93620, sf: 3020, leaseTerm: 10, status: 'listed' } // column J
const spotFusion = { price: 942545, rent: 51840, sf: 1296, leaseTerm: 15, status: 'listed' } // column C

test('BrickerZ Club matches sheet column J to the cent', () => {
  const n = capNumbers(brickerz, calculatorSettings(null), SHEET_TERMS)
  near(n.downPayment, 425545.5) // J26
  near(n.loan, 1276636.5) // J27
  near(n.monthlyPayment, 9023.001206820827) // J30
  near(n.annualDebt, 108276.01448184992) // J31
  near(n.noi, 93620) // J32
  near(n.closingCost, 17021.82) // J33
  near(n.cashFlowYear1, -31677.834481849924) // J34
  near(n.capRate, 0.05499999412518755, 8) // J36
  near(n.noiAtHold, 104854.4) // J37
  near(n.balanceAtHold, 1163809.311774471) // J38
  near(n.appreciation, 271113.4623401223) // J39
  near(n.depreciation, 174582.76923076922) // J40
})

test('Spot Fusion Kitchen matches sheet column C to the cent', () => {
  const n = capNumbers(spotFusion, calculatorSettings(null), SHEET_TERMS)
  near(n.monthlyPayment, 4996.283988717385) // C30
  near(n.cashFlowYear1, -17540.85786460862) // C34
  near(n.noiAtHold, 58060.8) // C37
  near(n.balanceAtHold, 644433.2320318678) // C38
  near(n.appreciation, 150122.98236109337) // C39
  near(n.depreciation, 96671.28205128205) // C40
  near(n.pricePerSf, 727.2723765432099, 6) // C20
  near(n.rentPerSf, 40, 6) // C21
  near(n.monthlyRent, 4320) // C22
})

test('cash-on-cash is the real percentage, not the sheet’s /100', () => {
  const n = capNumbers(brickerz, calculatorSettings(null), SHEET_TERMS)
  // The sheet's J35 is -0.0007444053451828282 — one hundredth of this.
  near(n.cashOnCash, -0.07444053451828282, 10)
})

test('ongoing cash flow leaves out the one-time closing cost', () => {
  const n = capNumbers(brickerz, calculatorSettings(null), SHEET_TERMS)
  near(n.cashFlowOngoing, n.cashFlowYear1 + n.closingCost)
  near(n.cashAtClose, n.downPayment + n.closingCost)
  near(n.principalPaid, n.loan - n.balanceAtHold)
})

test('the shipped defaults are the sheet’s assumptions block', () => {
  const s = calculatorSettings(null)
  assert.equal(s.defaultRate, 6.5)
  assert.equal(s.defaultTerm, 25)
  assert.equal(s.defaultDown, 25)
  assert.deepEqual(s.rates, [6.5, 6.75, 7])
  assert.deepEqual(s.terms, [20, 25, 30])
  assert.equal(s.holdYears, 5)
  // An empty choice runs at the defaults.
  const n = capNumbers(brickerz, s, {})
  assert.equal(n.rate, 6.5)
  assert.equal(n.term, 25)
})

test('admin blanks and junk fall back to the shipped values', () => {
  const s = calculatorSettings({ rates: [], terms: [0, null, 'x'], escalation: null, holdYears: 0, depreciationYears: 0, defaultRate: 9 })
  assert.deepEqual(s.rates, CALCULATOR_DEFAULTS.rates)
  assert.deepEqual(s.terms, CALCULATOR_DEFAULTS.terms)
  assert.equal(s.escalation, 3)
  assert.equal(s.holdYears, 5)
  assert.equal(s.depreciationYears, 39)
  // 9% is not on offer, so the control opens on the nearest rate that is.
  assert.equal(s.defaultRate, 7)
})

test('saved settings override the defaults', () => {
  const s = calculatorSettings({ rates: [7.25, 6], downPayments: [30, 20, 25, 30], defaultDown: 30, closingCost: 2, enabled: false })
  assert.deepEqual(s.rates, [6, 7.25])
  assert.deepEqual(s.downPayments, [20, 25, 30])
  assert.equal(s.defaultDown, 30)
  assert.equal(s.closingCost, 2)
  assert.equal(s.enabled, false)
})

test('a listing without a price or rent cannot be run', () => {
  const s = calculatorSettings(null)
  assert.equal(capNumbers({ price: null, rent: 1000 }, s, {}), null)
  assert.equal(capNumbers({ price: 500000 }, s, {}), null)
  assert.equal(capNumbers({ price: 0, rent: 1000 }, s, {}), null)
  // No size only blanks the per-SF rows.
  const n = capNumbers({ price: 500000, rent: 30000 }, s, {})
  assert.equal(n.pricePerSf, null)
  assert.equal(n.rentPerSf, null)
  near(n.noiAtHold, 30000 * 1.12)
})

test('a zero rate and an all-cash purchase do not divide by zero', () => {
  near(pmt(0, 300, 300000), 1000)
  near(loanBalance(0, 60, 1000, 300000), 240000)
  const s = calculatorSettings({ rates: [0, 6.5], downPayments: [100] })
  const cash = capNumbers(brickerz, s, { rate: 0, term: 25, down: 100 })
  assert.equal(cash.loan, 0)
  assert.equal(cash.monthlyPayment, 0)
  assert.equal(cash.balanceAtHold, 0)
  near(cash.cashFlowOngoing, brickerz.rent)
})

test('a hold longer than the loan has nothing left to pay off', () => {
  const s = calculatorSettings({ holdYears: 30, terms: [20] })
  const n = capNumbers(brickerz, s, { rate: 7, term: 20, down: 25 })
  assert.equal(n.balanceAtHold, 0)
  near(n.principalPaid, n.loan)
})

test('a lease shorter than the hold is flagged as assuming renewal', () => {
  const s = calculatorSettings(null)
  assert.equal(capNumbers({ ...brickerz, leaseTerm: 3 }, s, {}).assumesRenewal, true)
  assert.equal(capNumbers({ ...brickerz, leaseTerm: 5 }, s, {}).assumesRenewal, false)
  assert.equal(capNumbers({ ...brickerz, leaseTerm: null }, s, {}).assumesRenewal, false)
})

test('sold deals, disabled settings and unrunnable deals get no calculator', () => {
  const s = calculatorSettings(null)
  assert.equal(canRunNumbers(brickerz, s), true)
  assert.equal(canRunNumbers({ ...brickerz, status: 'under-contract' }, s), true)
  assert.equal(canRunNumbers({ ...brickerz, status: 'sold' }, s), false)
  assert.equal(canRunNumbers(brickerz, calculatorSettings({ enabled: false })), false)
  assert.equal(canRunNumbers({ ...brickerz, rent: null }, s), false)
})

test('a deal is named by tenant and units', () => {
  assert.equal(capDealName({ tenant: 'BrickerZ Club', units: '203, 204' }), 'BrickerZ Club · Unit 203, 204')
  assert.equal(capDealName({ tenant: 'Braeburn' }), 'Braeburn')
})

test('the scenario a visitor ran becomes flat, formatted lead context', () => {
  const listing = { ...brickerz, tenant: 'BrickerZ Club', units: '203, 204' }
  const n = capNumbers(listing, calculatorSettings(null), SHEET_TERMS)
  assert.deepEqual(capScenarioContext(listing, n), {
    calculatorDeal: 'BrickerZ Club · Unit 203, 204',
    calculatorPrice: '$1,702,182',
    calculatorTerms: '7% · 25 yrs · 25% down',
    calculatorCashAtClose: '$442,567',
    calculatorMonthlyPayment: '$9,023',
  })
  // A price dragged on the slider is the price that goes to sales.
  const dragged = capNumbers(listing, calculatorSettings(null), { ...SHEET_TERMS, price: 1500000 })
  assert.equal(capScenarioContext(listing, dragged).calculatorPrice, '$1,500,000')
  // Every value is a string under the API's 1,000-character context limit.
  for (const value of Object.values(capScenarioContext(listing, n))) {
    assert.equal(typeof value, 'string')
    assert.ok(value.length < 1000)
  }
  assert.equal(capScenarioContext(listing, null), null)
  assert.equal(capScenarioContext(null, n), null)
})
