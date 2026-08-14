import { unitStatusMeta } from '../lib/unitStatus'
import { formatArea } from '../lib/units'

const STATUS_COPY = {
  available: 'Available for lease. Contact our team for pricing and tour availability.',
  leased: 'Currently leased.',
  'coming-soon': 'Coming soon — leasing details available shortly.',
  sold: 'This unit has been sold.',
}

// Every tier — 3D viewer, 2D pin plan, DOM unit list — converges on this one
// card, so a copy change or a new field lands everywhere at once and the
// tiers cannot drift into describing the same unit differently.
//
// `maxHeight` is passed when the card sits in the column beside a fixed-height
// plan. The card is a header / scrolling body / pinned action stack either
// way; the cap is what makes the scrolling body do anything, and it keeps a
// long description from pushing the enquiry button past the bottom of the
// plan beside it. Unset — stacked under the plan on narrow screens — the card
// simply grows to its content like any other.
export default function UnitDetailCard({ unit, units = [], aspect = null, onEnquire, maxHeight = '' }) {
  if (!unit) return <EmptyPanel units={units} maxHeight={maxHeight} />

  const meta = unitStatusMeta(unit.status)
  const area = formatArea(unit.size)

  // Every row is admin-editable and every row is optional — a blank field is
  // omitted rather than rendered as an empty label, so a sparsely filled unit
  // still reads as finished.
  const specs = [
    ['Size', area],
    ['Floor', unit.floor],
    ['Rate', unit.rate],
    ['Frontage', unit.frontage],
    // Measured off the model rather than typed in, so it appears only once a
    // model is loaded and an orientation is set. Sits with the typed specs
    // because to a tenant it reads as one — which way the shop looks out.
    ['Aspect', aspect],
    unit.status === 'leased' && unit.tenant ? ['Tenant', unit.tenant] : null,
  ].filter((row) => row && row[1])

  const canEnquire = onEnquire && unit.status !== 'leased' && unit.status !== 'sold'

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface shadow-[0_20px_55px_-40px_rgba(20,28,33,.5)] ${maxHeight}`}>
      <div className="flex items-start justify-between gap-4 px-7 pb-5 pt-8 lg:px-8 lg:pt-9">
        <span className="font-display text-[clamp(3rem,4vw,4.25rem)] font-bold leading-none tracking-[-0.055em] break-words text-content">{unit.label || 'Unit'}</span>
        <span className={`mt-1 shrink-0 rounded-full px-4 py-2 font-body text-[12px] font-bold ${meta.chip}`}>{meta.label}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 lg:px-8">
        <p className="font-body text-[15px] font-semibold leading-relaxed text-content/60">
          {unit.description || (unit.tenant ? (unit.status === 'leased' ? `Leased to ${unit.tenant}.` : unit.tenant) : STATUS_COPY[unit.status] ?? STATUS_COPY.available)}
        </p>
        {specs.length > 0 && (
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[var(--color-line)] pt-7 lg:grid-cols-1">
            {specs.map(([term, value]) => (
              <div key={term} className="flex flex-col gap-1.5">
                <dt className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-content/50">{term}</dt>
                <dd className={`font-display font-bold tracking-[-0.02em] break-words text-content ${term === 'Size' ? 'text-[clamp(1.75rem,2.4vw,2.4rem)]' : 'text-lg'}`}>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {canEnquire && (
        <div className="mt-auto px-7 pb-7 lg:px-8 lg:pb-8">
          <button type="button" onClick={() => onEnquire(unit)} className="min-h-14 w-full rounded-full bg-accent px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-colors duration-300 hover:bg-prime-deep dark:text-void">
            Enquire about {unit.label || 'this unit'}
          </button>
        </div>
      )}
    </div>
  )
}

// Beside the plan this space exists whether or not anything is selected, so it
// earns its keep by answering the question a visitor arrives with — how much
// is actually free here — rather than sitting empty until they click.
function EmptyPanel({ units, maxHeight = '' }) {
  const total = units.length
  const available = units.filter((unit) => unit.status === 'available').length

  return (
    <div className={`relative flex min-h-[18rem] flex-col justify-end gap-4 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface px-7 py-8 shadow-[0_20px_55px_-40px_rgba(20,28,33,.5)] ${maxHeight}`}>
      <span aria-hidden className="absolute -right-5 -top-10 font-display text-[8rem] font-bold leading-none text-accent/[0.07]">{available}</span>
      <span className="eyebrow relative text-content/55">Unit details</span>

      {total > 0 && (
        <p className="font-display text-2xl leading-snug font-medium text-content/85">
          {available > 0 ? (
            <>
              <span className="text-accent">{available}</span> of {total}{' '}
              {total === 1 ? 'unit' : 'units'} available
            </>
          ) : (
            <>All {total} {total === 1 ? 'unit' : 'units'} currently leased</>
          )}
        </p>
      )}

      <p className="font-body text-sm leading-relaxed text-content/70">
        Select a unit on the plan — or from the list below — to see its size, floor and availability.
      </p>
    </div>
  )
}
