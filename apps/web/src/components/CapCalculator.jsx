import { useEffect, useId, useMemo, useState } from 'react'
import { SLIDERS, calculatorSettings, capNumbers } from '../lib/capCalculator'
import PrimePill from './PrimePill'

// The client's Loan Price Sheet, for one deal, with the loan terms in the
// visitor's hands. Every figure comes from lib/capCalculator.js, which is the
// sheet's formulas row for row; this file only lays them out.
//
// Kept deliberately plain (the client asked for "simple"): two or three
// choices on the left, the answers on the right: what it takes to buy, the
// monthly EMI and how much of it is interest, then the year-1 and hold ledgers.

const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

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
  intro = null,
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
  useEffect(() => setChoice((c) => ({ ...c, price: null })), [listing?.slug])

  const n = useMemo(() => capNumbers(listing, settings, choice), [listing, settings, choice])

  useEffect(() => {
    onNumbers?.(n)
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps -- a parent's inline callback must not re-fire this

  // The invest page opens with no deal chosen; a deal page always has one.
  // Without a deal there is nothing to run, but the loan choices still show.
  if (!n && listing) return null

  const set = (key) => (value) => {
    setChoice((c) => ({ ...c, [key]: value }))
    onUserChange?.()
  }

  return (
    <section
      id={id}
      data-band="light"
      aria-labelledby={headingId}
      className={`scroll-mt-24 bg-base px-gutter py-16 text-content md:py-24 ${className}`}
    >
      {/* The heading spans both columns, so the controls and the results
          panel start on one shared line beneath it rather than the panel
          floating level with the eyebrow. */}
      <div className="mx-auto max-w-[1360px]">
        <header className="max-w-[40rem]">
          <p className="eyebrow font-body text-[13px] text-content/60">Investment calculator</p>
          <h2
            id={headingId}
            className="mt-4 font-display font-bold leading-[1.08] tracking-[-0.02em] [font-size:clamp(1.7rem,2.6vw,2.4rem)]"
          >
            {heading}
          </h2>
          {intro && <p className="mt-4 max-w-[34rem] font-body text-[15px] leading-relaxed text-content/70">{intro}</p>}
        </header>

        <div className="mt-10 grid items-start gap-10 md:mt-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            {picker}

            <div className={`${picker ? 'mt-7' : ''} flex flex-col gap-7`}>
              {listing && <PriceField key={listing.slug} listed={listing.price} value={n.price} onChange={set('price')} />}
              <Slider label="Interest rate" value={choice.rate} {...SLIDERS.rate} onChange={set('rate')} format={pct} />
              <Slider label="Loan term" value={choice.term} {...SLIDERS.term} onChange={set('term')} format={years} />
              <Slider label="Down payment" value={choice.down} {...SLIDERS.down} onChange={set('down')} format={pct} />
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
            {!n ? (
              <div className="flex min-h-[22rem] flex-col justify-center rounded-2xl border border-dashed border-content/20 bg-surface px-6 py-10 sm:px-10">
                <p className="font-display text-[clamp(1.25rem,1.8vw,1.6rem)] font-bold leading-tight text-content">
                  Choose a CAP deal to run the numbers
                </p>
                <p className="mt-3 max-w-[44ch] font-body text-[15px] leading-relaxed text-content/65">
                  Cash needed at close, the monthly EMI and its interest, and five-year returns appear here for the deal you pick.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                {/* The three a visitor decides on: what it takes to buy, what the
                    loan costs each month, and how much of that is interest. */}
                <dl className="grid divide-y divide-[var(--color-line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <Headline label="Cash needed at close" value={money(n.cashAtClose)} note={`${money(n.downPayment)} down + ${money(n.closingCost)} closing`} />
                  <Headline label="Monthly EMI" value={money(n.monthlyPayment)} note={`on a ${money(n.loan)} loan at ${pct(n.rate)}`} />
                  <Headline
                    label="Monthly interest"
                    value={money(n.monthlyInterest)}
                    note={`${money(n.monthlyPrincipal)} to principal · ${money(n.totalInterest)} interest over ${years(n.term)}`}
                  />
                </dl>

                <div className="border-t border-line px-5 py-6 sm:px-7">
                  <p className="font-body text-[14px] text-content/70">
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
            )}

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[34rem] font-body text-[12px] leading-relaxed text-content/55">
                Estimates from the assumptions shown, for illustration only. Actual rates, terms and returns depend on your
                lender and the final deal. Not financial or tax advice.
              </p>
              {cta && n && (
                <PrimePill href={cta.href} onClick={cta.onClick} className="shrink-0">
                  {cta.label}
                </PrimePill>
              )}
            </div>
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

/**
 * The purchase price as a typed field. A slider could only reach a band around
 * the listed price in $1,000 steps; a visitor bringing their own offer wants to
 * type it. Cleared, it falls back to the listed price.
 */
function PriceField({ listed, value, onChange }) {
  const id = useId()
  const noteId = useId()
  const [draft, setDraft] = useState(() => grouped.format(value))
  const edited = value !== listed

  const update = (text) => {
    const digits = text.replace(/[^\d]/g, '').slice(0, 12)
    setDraft(digits ? grouped.format(Number(digits)) : '')
    onChange(digits && Number(digits) > 0 ? Number(digits) : null)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/55">
          Purchase price
        </label>
        {edited && (
          <button
            type="button"
            onClick={() => update(String(listed))}
            className="min-h-11 font-body text-[12px] font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-0"
          >
            Reset
          </button>
        )}
      </div>
      <div className="relative mt-2.5">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-display text-[16px] font-semibold text-content/55">
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          placeholder={grouped.format(listed)}
          onChange={(e) => update(e.target.value)}
          onBlur={() => !draft && setDraft(grouped.format(listed))}
          aria-describedby={noteId}
          className="min-h-12 w-full rounded-2xl border border-line bg-surface py-3 pl-8 pr-4 font-display text-[16px] font-semibold tabular-nums text-content transition-colors duration-200 hover:border-content/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>
      <p id={noteId} className="mt-2 font-body text-[12px] tabular-nums text-content/55">
        {edited ? `Listed at ${money(listed)}` : 'The listed price. Type your own offer to run it.'}
      </p>
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
