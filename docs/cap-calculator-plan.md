# CAP property investment calculator — plan

Status: **built 13 Nov 2026, not yet deployed.** Written the same day from
`CAP_Loan_Price_Sheet.xlsx` (sent by Manish: "same functions and formulas …
UI/UX will be simple").

What was built, and how each open question was settled for now (each can be
changed without code, from **Admin → CAP / NNN page → Investment
calculator**, unless marked):

- Code: [lib/capCalculator.js](../apps/web/src/lib/capCalculator.js),
  [components/CapCalculator.jsx](../apps/web/src/components/CapCalculator.jsx),
  [pages/CapListingPage.jsx](../apps/web/src/pages/CapListingPage.jsx),
  [admin/CapSettingsPage.jsx](../apps/web/src/admin/CapSettingsPage.jsx);
  tests in [test/capCalculator.test.js](../apps/web/test/capCalculator.test.js).
- Q1 cash-on-cash: the `/100` is dropped (code).
- Q2 opening rate: 6.5% (sheet B5); admin setting.
- Q3 cash flow: both year 1 (as the sheet) and "yearly cash flow at today's
  rent" are shown; cash-on-cash stays the sheet's year-1 ÷ down (code).
- Q4 rent growth: simple, as the sheet (code).
- Q5 sold deals: no calculator; listed and under contract get one (code).
- Q6 down payment: opens on 25%. Since 13 Nov 2026 the visitor controls are
  sliders rather than the sheet's dropdowns (`SLIDERS` in
  lib/capCalculator.js): purchase price 50–150% of the listing, rate 4–10%,
  term 10–30 yrs, down payment 10–50%. They still open on the sheet's values
  (listing price, 6.5%, 25 yrs, 25% down).
- Q7 5-year total: not added (it is not on the sheet).
- Q8 deal list: the calculator reads the site's listings.
- Q1–Q7 confirmed by Kalyan on 13 Nov 2026 (6.5% opening rate, simple rent
  growth, sheet cash-on-cash, fixed 25% down, no 5-year total).
- **Invest page** (`/enterprise/invest#calculator`,
  [InvestPage.jsx](../apps/web/src/pages/InvestPage.jsx)): the same
  calculator right after the CAP listings grid and before the testimonials,
  headed "Run the numbers on a CAP deal". A deal picker lists every deal
  `canRunNumbers` allows (listed or under contract, with a price and rent;
  sold deals are left out) and opens on the first. The section is hidden when
  no deal can be run. Decided with Kalyan on 13 Nov 2026.
- **Scenario on the investor inquiry.** Once the visitor changes the deal or
  any slider, the inquiry form's lead `context` carries the scenario
  (`capScenarioContext` in lib/capCalculator.js), next to the existing
  `track`:
  - `calculatorDeal`: tenant and units
  - `calculatorPrice`: the price run, which may differ from the listing's
  - `calculatorTerms`: e.g. "7% · 25 yrs · 25% down"
  - `calculatorCashAtClose`
  - `calculatorMonthlyPayment`

  All values are formatted strings, as the leads admin prints them; 5 fields
  against the API's 20-field context cap. The form shows what will be sent,
  above the fields, with a "Don't include" link. Checked 13 Nov 2026 with a
  stubbed `fetch`: the POST to `/api/leads` carried all five plus `track`.
- Not built: the deal-page contact link carrying the chosen terms (the contact
  form has no message prefill), and analytics events (the site has no
  custom-event helper yet).

## What it is

A small "Run the numbers" block on every CAP listing page
(`/cap-properties/:slug`, [CapListingPage.jsx](../apps/web/src/pages/CapListingPage.jsx)).
It opens pre-filled with that listing's price, rent and size. The visitor picks
the loan terms and sees the same rows the price sheet shows for that tenant.

No new data entry. Every per-deal input the sheet uses is already on the
listing (`price`, `rent`, `sf`, `leaseTerm` in
[data/capListings.js](../apps/web/src/data/capListings.js) and the admin's
`cap_listings` section). Only the sheet's global assumptions are new, and they
go in the admin (see below).

## Inputs

**Visitor controls.** Three controls, all from the sheet's dropdowns:

| Control | Options | Default | Sheet |
|---|---|---|---|
| Interest rate | 6.50% / 6.75% / 7.00% | 6.50% (sheet B5) | `Lists!A2:A4` |
| Loan term (tenure) | 20 / 25 / 30 yrs | 25 yrs (sheet B6) | `Lists!B2:B4` |
| Down payment | 25% (sheet fixed) | 25% | B7 |

Down payment is fixed at 25% in the sheet. A 20 / 25 / 30 / 35% picker is a
cheap addition if Manish wants it (open question 6).

**Admin assumptions.** These are set once in the admin, shown to the visitor
in a collapsed "Assumptions" list, and not editable by the visitor:

| Assumption | Value | Sheet cell |
|---|---|---|
| Annual rent escalation | 3% | B8 |
| Annual appreciation | 3% | B9 |
| Closing cost | 1% of price | B10 |
| Land value (non-depreciable) | 20% of price | B11 |
| Depreciation life | 39 yrs straight-line | B12 |
| Hold period | 5 yrs | B13 |
| Expenses excl. mortgage | $0 (NNN) | row 24 |

**Per listing (already stored).** Purchase price, yearly rent, total SF and
lease term.

## Formulas (exactly as the sheet)

`r` = annual rate, `n` = term in years, `h` = hold years.

| Row | Output | Formula |
|---|---|---|
| 20 | Price / SF | `price / sf` |
| 21 | Rent / SF | `rent / sf` |
| 22 | Monthly rent | `rent / 12` |
| 26 | Down payment | `price × down%` |
| 27 | Loan | `price − down` |
| 30 | Monthly EMI (P&I) | `−PMT(r/12, n×12, loan)` = `loan·(r/12) / (1 − (1+r/12)^−(n·12))` |
| 31 | Annual debt | `EMI × 12` |
| 32 | NOI year 1 | `rent − expenses` (expenses = 0) |
| 33 | Closing cost | `price × 1%` |
| 34 | Cash flow (year 1) | `NOI − annual debt − closing cost` |
| 35 | Cash-on-cash | `cash flow / down payment` (see issue 1) |
| 36 | CAP rate | `rent / price` |
| 37 | NOI year 5 | `(rentSF + rentSF × 3% × (h−1)) × sf` (simple, see issue 4) |
| 38 | Loan balance at year 5 | `FV(r/12, h×12, EMI, −loan)` = `loan·(1+i)^k − EMI·((1+i)^k − 1)/i` |
| 39 | Appreciation over 5 yrs | `price × ((1+3%)^h − 1)` |
| 40 | Depreciation over 5 yrs | `((price − 20% land) / 39) × h` |

I re-implemented these in JS and they match the sheet to the cent (BrickerZ
Club, column J: EMI $9,023.00, year-1 cash flow −$31,677.83, year-5 balance
$1,163,809.31, appreciation $271,113.46, depreciation $174,582.77). Those
values go straight into the unit tests.

## Problems in the sheet to settle before we ship

These change what visitors see, so Manish should decide each one. None are
guesses. Each comes from reading the cells.

1. **Cash-on-cash is 100× too small.** `=(B34/B26)/100` on a cell formatted
   as %, so BrickerZ shows **−0.07%** when the real figure is **−7.44%**. The
   note says "shown as %, same as ×100", but the `/100` does the opposite.
   Plan: drop the `/100`.
2. **The interest-rate row ignores the default.** Row 28 is a hard-coded
   `0.07` in all 17 columns, while B5 (the "default for all") is 6.5%. Every
   figure on the sheet as sent is at 7%. Plan: the calculator defaults to the
   B5 value (6.5%) and the visitor can switch. Confirm 6.5% is the right
   opening rate.
3. **Year-1 cash flow subtracts the one-time closing cost.** That is right
   for year 1, but cash-on-cash then mixes a one-off cost into an annual
   return. Proposal: show **Year-1 cash flow** (as the sheet does) and
   **Ongoing annual cash flow** (NOI − debt). Cash-on-cash would be ongoing
   cash flow ÷ cash in at close (down + closing). Needs a yes or no.
4. **Rent growth is simple, appreciation is compound.** Year-5 NOI uses
   `rent × (1 + 3% × 4)` ($104,854 for BrickerZ). Appreciation compounds
   `1.03^5`. Compounded rent would be $105,370. Pick one and use it for both.
5. **Lease term is never used.** N & S has a 3-year lease and Harvest Depot
   and Devi Liquor have 5. The 5-year NOI quietly assumes the tenant renews.
   Plan: when the hold period runs past the lease term, add a one-line note
   under the year-5 figures saying renewal is assumed.
6. **Year-1 cash flow is negative on all 17 deals, at every rate and term.**
   I checked every combination of 6.5–7% and 20–30 years. At 25% down, a
   5.5–6.5% cap rate barely covers the loan, and the closing cost then puts
   year 1 under. Ongoing cash flow (without closing cost) is positive on only
   a few deals:
   - 7% / 25 yrs: Harvest Depot (+$2,122) and Braeburn (+$2,838)
   - 6.5% / 30 yrs: eight deals, up to +$16,567

   BrickerZ at 6.5% / 25 yrs is −$9,819 a year ongoing. The calculator will
   show this honestly, so the 5-year block below matters: it is where the deal
   makes sense (principal paid down plus appreciation). Ask whether to add the
   down-payment picker and a 5-year total (both optional, below).
7. **The sheet and the website list different deals.** The sheet has
   *Spot Fusion Kitchen, Centro Plaza 101* and the site does not. The site has
   *OJAS Natural Foods, 102* and the sheet does not. Some names differ: Fion
   Liquor / Liquor Shop, Manyavar / Mohey Manyavar, Shrishti / Srishti. Seven
   Oaks rent is $65,070.28 on the sheet and $65,070 on the site. The
   calculator reads the site's listing data, so the admin needs to hold the
   right numbers.

## Outputs (what the visitor sees)

Keep it to one panel. Rubik numbers and Arimo labels, CG Blue `#0073A4` for
the primary figures, Deep Saffron `#FCA42E` for the one figure we want them to
leave with. No charts in v1.

1. **Cash needed at close.** Down payment + closing cost. This is the headline.
2. **Monthly payment.** EMI (P&I).
3. **Monthly rent.** Next to the payment, so the gap reads at a glance.
4. **Cash flow.** Year 1 and ongoing, monthly and annual (issue 3).
5. **Returns.** CAP rate and cash-on-cash.
6. **After 5 years.** NOI in year 5, loan balance, principal paid down,
   appreciation, and depreciation (stated as a deduction, not dollars saved,
   because we don't know the investor's tax bracket).
7. **Optional, needs approval: 5-year total.** Sum of cash flows + principal
   paid down + appreciation, on cash invested. This is new (the sheet doesn't
   have it), but it answers "is this a good deal" in one number.
8. **Disclaimer.** Reuses the CAP section's existing `disclaimer` text (the
   same wording as sheet row 45).
9. **CTA.** "Enquire about this deal" opens the existing enquiry modal with the
   chosen rate, term and down payment written into the message, so sales sees
   which scenario the visitor ran.

Sold and under-contract listings show the calculator read-only, or hide it
(open question 5).

## Build

| Piece | File | Notes |
|---|---|---|
| Formula module | `apps/web/src/lib/capCalculator.js` | Pure functions: `pmt`, `loanBalance`, `calculate(listing, assumptions, choices)`. No React. Guards: zero rate, missing price/rent/SF give `null` rows, never `NaN`. |
| Tests | `apps/web/test/capCalculator.test.js` | Every row checked against sheet columns C and J to the cent, plus the zero-rate and missing-data cases. Runs under the existing `node --test`. |
| UI | `apps/web/src/components/CapCalculator.jsx` | Segmented controls for rate and term (and down payment if approved). Results update live. Stacked on phones, two columns from `lg`. Lazy-loaded on CapListingPage so the CAP index doesn't pay for it. |
| Admin | `apps/web/src/admin/CapSettingsPage.jsx` | New "Calculator" section on the existing CAP settings page: rate options, term options, defaults, and the seven assumptions. Stored as `cap_listings.calculator`, with defaults in `data/capListings.js` so it works before the admin first saves. |
| API | `apps/api` | Nothing new if `cap_listings` is a free-form section. Confirm the DTO lets a `calculator` key through, otherwise add it. |
| Analytics | Firebase Analytics (already on the site) | One event when a visitor changes a control (`cap_calculator_change` with rate/term) and one on the CTA. |

Estimate: about 1½ days. Half a day for the module and tests, half for the UI,
a few hours for the admin section and wiring.

## Open questions for Manish

1. Drop the `/100` on cash-on-cash? (issue 1)
2. Open at 6.5% (sheet B5) or 7% (what every printed figure uses)? (issue 2)
3. Show ongoing cash flow beside year 1, and base cash-on-cash on it? (issue 3)
4. Simple or compound rent growth? (issue 4)
5. Show the calculator on sold and under-contract deals?
6. Let visitors change the down payment, or keep 25% fixed?
7. Add the 5-year total return line?
8. Which deal list is current: the sheet's (with Spot Fusion) or the site's
   (with OJAS)? (issue 7)
