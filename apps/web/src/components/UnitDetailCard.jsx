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
export default function UnitDetailCard({ unit, onEnquire }) {
  if (!unit) {
    return (
      <p className="font-body text-sm text-content/45">
        Select a unit to see its details.
      </p>
    )
  }

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
    unit.status === 'leased' && unit.tenant ? ['Tenant', unit.tenant] : null,
  ].filter((row) => row && row[1])

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.1em] ${meta.chip}`}>
          {meta.label}
        </span>
        <span className="font-display text-lg font-medium text-content">{unit.label || 'Unit'}</span>
        {area && <span className="font-body text-sm text-content/50">{area}</span>}
      </div>

      <p className="mt-3 font-body text-sm leading-relaxed text-content/60">
        {unit.description ||
          (unit.tenant
            ? unit.status === 'leased'
              ? `Leased to ${unit.tenant}.`
              : unit.tenant
            : STATUS_COPY[unit.status] ?? STATUS_COPY.available)}
      </p>

      {specs.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {specs.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-1">
              <dt className="eyebrow text-content/45">{term}</dt>
              <dd className="font-display text-base font-medium text-content">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {onEnquire && unit.status !== 'leased' && unit.status !== 'sold' && (
        <button
          type="button"
          onClick={() => onEnquire(unit)}
          className="mt-5 rounded-full bg-accent px-5 py-2 font-body text-[12px] font-bold uppercase tracking-[0.14em] text-bone transition-colors duration-300 hover:bg-accent-soft"
        >
          Enquire about {unit.label || 'this unit'}
        </button>
      )}
    </div>
  )
}
