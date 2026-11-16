import { useEffect, useId, useMemo, useState } from 'react'
import { SLIDERS, calculatorSettings, capNumbers } from '../lib/capCalculator'
import PrimePill from './PrimePill'

// The client's Loan Price Sheet, for one deal, with the loan terms in the
// visitor's hands. Every figure comes from lib/capCalculator.js, which is the
// sheet's formulas row for row; this file only lays them out.
//
// Kept deliberately plain (the client asked for "simple"): two or three
// choices on the left, the answers on the right, no charts beyond one bar that
// sets the monthly rent against the monthly loan payment — the comparison
// every other figure on the panel follows from.

const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

// A true minus sign, not a hyphen: in a column of tabular figures the hyphen is
// short enough to miss, and a cash flow read as positive is the one mistake
// this panel must not invite.
const money = (n) => (n == null ? '—' : wholeDollars.format(n).replace('-', '−'))
const percent = (fraction) => (fraction == null ? '—' : `${plain.format(fraction * 100).replace('-', '−')}%`)
const pct = (n) => `${plain.format(n)}%`
const years = (n) => `${plain.format(n)} ${n === 1 ? 'yr' : 'yrs'}`

/**
 * `listing` is the deal being run. The deal page passes its own; the invest
 * page passes whichever one its `picker` (rendered above the loan choices)
 * has selected.
 *
 * `onNumbers` receives every recalculation, and `onUserChange` fires only when
 * the visitor changes a loan choice — the invest page uses the two to attach
 * the scenario to its inquiry form, but only once the visitor has actually
 * run one.
 *
 * `cta` is `{ label, href }` or `{ label, onClick }`.
 */
export default function CapCalculator({
  listing,
  section,
  id,
  className = '',
  heading = 'Run the numbers on this deal',
  intro = 'Pick a rate and a loan term. Every figure uses this deal’s price and rent, and the same formulas as our loan price sheet.',
  picker = null,
  cta = null,
  onNumbers,
  onUserChange,
}) {
  const headingId = useId()
  const settings = useMemo(() => calculatorSettings(section?.calculator), [section])
  const defaults = useMemo(
    () => ({ rate: settings.defaultRate, term: settings.defaultTerm, down: settings.defaultDown }),
    [settings],
  )
  const [choice, setChoice] = useState(defaults)

  // Reset only when the admin's options change, not when the deal does: a
  // visitor stepping between deals is comparing them, and that only works at
  // the same rate and term.
  useEffect(() => setChoice(defaults), [defaults])
  // Each deal opens at its own price; a price dragged on one deal means nothing on the next.
  useEffect(() => setChoice((c) => ({ ...c, price: null })), [listing.slug])

  const n = useMemo(() => capNumbers(listing, settings, choice), [listing, settings, choice])

  useEffect(() => {
    onNumbers?.(n)
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps -- a parent's inline callback must not re-fire this

  if (!n) return null

  const set = (key) => (value) => {
    setChoice((c) => ({ ...c, [key]: value }))
    onUserChange?.()
  }
  const barMax = Math.max(n.monthlyRent, n.monthlyPayment) || 1

  return (
    <section
      id={id}
      data-band="light"
      aria-labelledby={headingId}
      className={`scroll-mt-24 bg-base px-gutter py-16 text-content md:py-24 ${className}`}
    >
      <div className="mx-auto grid max-w-[1360px] gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <p className="eyebrow font-body text-[13px] text-content/60">Investment calculator</p>
          <h2
            id={headingId}
            className="mt-4 font-display font-bold leading-[1.08] tracking-[-0.02em] [font-size:clamp(1.7rem,2.6vw,2.4rem)]"
          >
            {heading}
          </h2>
          <p className="mt-4 max-w-[30rem] font-body text-[15px] leading-relaxed text-content/70">{intro}</p>

          {picker && <div className="mt-8">{picker}</div>}

          <div className={`${picker ? 'mt-6' : 'mt-8'} flex flex-col gap-6`}>
            <Slider
              label="Purchase price"
              value={n.price}
              min={Math.round((listing.price * SLIDERS.price.minShare) / SLIDERS.price.step) * SLIDERS.price.step}
              max={Math.round((listing.price * SLIDERS.price.maxShare) / SLIDERS.price.step) * SLIDERS.price.step}
              step={SLIDERS.price.step}
              onChange={set('price')}
              format={money}
              note={n.price !== listing.price ? `Listed at ${money(listing.price)}` : null}
            />
            <Slider label="Interest rate" value={n.rate} {...SLIDERS.rate} onChange={set('rate')} format={pct} />
            <Slider label="Loan term" value={n.term} {...SLIDERS.term} onChange={set('term')} format={years} />
            <Slider label="Down payment" value={n.down} {...SLIDERS.down} onChange={set('down')} format={pct} />
          </div>

          <details className="group mt-8 border-t border-line pt-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-body text-[13px] font-bold text-content [&::-webkit-details-marker]:hidden">
              Assumptions
              <span
                aria-hidden
                className="text-lg leading-none text-content/50 transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 font-body text-[13px]">
              {[
                ['Rent escalation', `${pct(settings.escalation)} a year`],
                ['Appreciation', `${pct(settings.appreciation)} a year`],
                ['Closing cost', `${pct(settings.closingCost)} of price`],
                ['Land (not depreciated)', `${pct(settings.landValue)} of price`],
                ['Depreciation', `${plain.format(settings.depreciationYears)}-yr straight line`],
                ['Hold period', years(settings.holdYears)],
                ['Owner expenses', 'None — NNN lease'],
              ].map(([term, value]) => (
                <div key={term} className="contents">
                  <dt className="text-content/60">{term}</dt>
                  <dd className="text-right font-semibold tabular-nums text-content">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <div className="lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {/* The three a visitor decides on: what it takes to buy, what it
                costs each month, and what it brings in each month. */}
            <dl className="grid divide-y divide-[var(--color-line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Headline label="Cash needed at close" value={money(n.cashAtClose)} note={`${money(n.downPayment)} down + ${money(n.closingCost)} closing`} />
              <Headline label="Monthly loan payment" value={money(n.monthlyPayment)} note={`on a ${money(n.loan)} loan`} />
              <Headline label="Monthly rent" value={money(n.monthlyRent)} note={`${money(n.rent)} a year, NNN`} />
            </dl>

            <div className="border-t border-line px-5 py-6 sm:px-7">
              <Bar label="Rent in" value={n.monthlyRent} max={barMax} tone="bg-accent" />
              <Bar label="Loan payment out" value={n.monthlyPayment} max={barMax} tone="bg-ember" />
              <p className="mt-4 font-body text-[14px] text-content/70">
                {n.cashFlowOngoing >= 0 ? (
                  <>
                    Rent covers the loan with <span className="font-bold text-content">{money(n.cashFlowOngoing / 12)}</span> a
                    month to spare.
                  </>
                ) : (
                  <>
                    The loan costs <span className="font-bold text-content">{money(-n.cashFlowOngoing / 12)}</span> a month more
                    than the rent brings in. Equity builds through the loan paydown and appreciation below.
                  </>
                )}
              </p>
            </div>

            <div className="grid border-t border-line md:grid-cols-2 md:divide-x md:divide-[var(--color-line)]">
              <Ledger
                title="Year 1"
                rows={[
                  ['Rent (NOI)', money(n.noi)],
                  ['Loan payments', money(-n.annualDebt)],
                  ['Closing cost, one time', money(-n.closingCost)],
                  ['Cash flow, year 1', money(n.cashFlowYear1), true],
                  ['Yearly cash flow at today’s rent', money(n.cashFlowOngoing)],
                  ['Cash-on-cash return', percent(n.cashOnCash)],
                  ['CAP rate', percent(n.capRate)],
                ]}
              />
              <Ledger
                title={`After ${years(n.hold)}`}
                rows={[
                  [`Rent (NOI) in year ${n.hold}`, money(n.noiAtHold)],
                  ['Loan balance left', money(n.balanceAtHold)],
                  ['Principal paid down', money(n.principalPaid), true],
                  ['Appreciation', money(n.appreciation), true],
                  ['Depreciation deduction', money(n.depreciation)],
                ]}
                note={
                  n.assumesRenewal
                    ? `The lease runs ${years(listing.leaseTerm)}; these figures assume the tenant renews.`
                    : 'Depreciation is a tax deduction, not cash. What it saves depends on your tax bracket.'
                }
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[34rem] font-body text-[12px] leading-relaxed text-content/55">
              Estimates from the assumptions shown, for illustration only. Actual rates, terms and returns depend on your
              lender and the final deal. Not financial or tax advice.
            </p>
            {cta && (
              <PrimePill href={cta.href} onClick={cta.onClick} className="shrink-0">
                {cta.label}
              </PrimePill>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** A labelled native range input: arrow keys, touch and screen readers come with it. */
function Slider({ label, value, min, max, step, onChange, format, note }) {
  const id = useId()
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/55">
          {label}
        </label>
        <output htmlFor={id} className="font-display text-[17px] font-bold tabular-nums text-content">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${fill}%` }}
        className="mt-3 h-11 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-content/15 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-accent)_var(--fill),color-mix(in_srgb,var(--color-content)_15%,transparent)_var(--fill))] [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--color-surface)]"
      />
      <div className="flex justify-between font-body text-[11px] tabular-nums text-content/45">
        <span>{format(min)}</span>
        {note && <span>{note}</span>}
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

function Headline({ label, value, note }) {
  return (
    <div className="px-5 py-6 sm:px-7">
      <dt className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/55">{label}</dt>
      <dd className="mt-2 font-display font-bold tabular-nums leading-none tracking-[-0.02em] text-content [font-size:clamp(1.6rem,2.3vw,2.15rem)]">
        {value}
      </dd>
      <dd className="mt-2 font-body text-[12px] tabular-nums text-content/55">{note}</dd>
    </div>
  )
}

function Bar({ label, value, max, tone }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="flex items-baseline justify-between gap-3 font-body text-[13px]">
        <span className="text-content/65">{label}</span>
        <span className="font-semibold tabular-nums text-content">{money(value)}/mo</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-content/8">
        <div
          className={`h-full rounded-full ${tone} transition-[width] duration-500 ease-out motion-reduce:transition-none`}
          style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
        />
      </div>
    </div>
  )
}

function Ledger({ title, rows, note }) {
  return (
    <div className="border-t border-line px-5 py-6 first:border-t-0 sm:px-7 md:border-t-0">
      <h3 className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/55">{title}</h3>
      <dl className="mt-3 flex flex-col">
        {rows.map(([term, value, strong]) => (
          <div key={term} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
            <dt className={`font-body text-[14px] ${strong ? 'font-semibold text-content' : 'text-content/70'}`}>{term}</dt>
            <dd className={`shrink-0 tabular-nums ${strong ? 'font-display text-[16px] font-bold text-content' : 'font-body text-[14px] font-semibold text-content'}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 font-body text-[12px] leading-relaxed text-content/55">{note}</p>}
    </div>
  )
}
