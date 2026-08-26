import { unitStatusMeta } from '../lib/unitStatus'
import { formatArea } from '../lib/units'

// The specs a visitor actually chooses between. Description is deliberately
// absent: it is a paragraph, and a paragraph in a table cell wrecks the row
// alignment that makes a comparison readable in the first place. The detail
// panel beside the plan still carries it for whichever unit is primary.
const SPECS = [
  ['Size', (unit) => formatArea(unit.size)],
  ['Floor', (unit) => unit.floor],
  ['Rate', (unit) => unit.rate],
  ['Frontage', (unit) => unit.frontage],
  // Comes from the model's geometry, not the unit record — see `aspectOf` in
  // FloorPlanSection. Comparing aspect is one of the few rows where every unit
  // reliably has a value, which makes it unusually useful here.
  ['Aspect', (unit, aspectOf) => aspectOf?.(unit.index) ?? null],
  ['Tenant', (unit) => (unit.status === 'leased' ? unit.tenant : null)],
]

/**
 * Side-by-side comparison of the units a visitor has picked out.
 *
 * Rendered full width beneath the plan rather than inside the detail column,
 * which is a third of a row wide — three units in there would wrap every value
 * onto its own line and stop being a comparison. Full width also means the
 * plan above stays on screen, so the model still shows *where* the units being
 * compared actually are.
 *
 * A real <table>, not a grid of divs: this is tabular data, and the row/column
 * headers are what let a screen reader announce "Rate, unit 103" instead of
 * reading a wall of disconnected values.
 */
export default function UnitComparePanel({ units, aspectOf, onRemove, onClear, onEnquire }) {
  if (units.length < 2) return null

  // Only rows where at least one unit has something to say. Unit records here
  // are routinely sparse, and a table of mostly em-dashes reads as broken data
  // rather than as an absent field.
  const rows = SPECS.map(([label, read]) => [label, units.map((unit) => read(unit, aspectOf))]).filter(
    ([, values]) => values.some((value) => value != null && String(value).trim() !== ''),
  )

  const canEnquire = (unit) => onEnquire && unit.status !== 'leased' && unit.status !== 'sold'

  return (
    <section
      aria-label="Compare selected units"
      className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--color-line)] px-6 py-4">
        <h3 className="font-display text-base font-medium text-content">
          Comparing {units.length} units
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="min-h-9 font-body text-[11px] font-bold tracking-[0.14em] text-accent uppercase transition-colors duration-200 hover:text-content"
        >
          Clear comparison
        </button>
      </div>

      {/* The table scrolls inside its own box rather than widening the page.
          Five units at a readable column width is wider than a phone, and a
          horizontally scrolling *document* breaks every other section too. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left">
          <caption className="sr-only">
            Specifications for the {units.length} units selected for comparison
          </caption>
          <thead>
            <tr>
              {/* Sticky so the row labels stay put while the unit columns
                  scroll — without it you lose track of which spec you are
                  reading two columns in. */}
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface px-6 py-4 align-bottom"
              >
                <span className="sr-only">Specification</span>
              </th>
              {units.map((unit) => {
                const meta = unitStatusMeta(unit.status)
                return (
                  <th key={unit.index} scope="col" className="min-w-[10rem] px-5 py-4 align-bottom">
                    <span className="flex flex-col items-start gap-2">
                      <span className="flex w-full items-start justify-between gap-2">
                        <span className="font-display text-lg font-medium break-words text-content">
                          {unit.label || 'Unit'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(unit.index)}
                          aria-label={`Remove ${unit.label || 'this unit'} from the comparison`}
                          className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-content/70 transition-colors duration-200 hover:bg-content/10 hover:text-content"
                        >
                          <span aria-hidden>×</span>
                        </button>
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-body text-[10px] font-bold tracking-[0.1em] uppercase ${meta.chip}`}
                      >
                        {meta.label}
                      </span>
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map(([label, values]) => (
              <tr key={label} className="border-t border-[var(--color-line)]">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-6 py-4 align-top eyebrow font-normal text-content/70"
                >
                  {label}
                </th>
                {values.map((value, i) => (
                  <td
                    key={units[i].index}
                    className="px-5 py-4 align-top font-display text-base font-medium break-words text-content"
                  >
                    {/* An em-dash, not a blank cell: blank reads as a render
                        failure, "—" reads as "we do not list this". */}
                    {value != null && String(value).trim() !== '' ? value : <span className="text-content/25">—</span>}
                  </td>
                ))}
              </tr>
            ))}

            {onEnquire && (
              <tr className="border-t border-[var(--color-line)]">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-6 py-4">
                  <span className="sr-only">Enquire</span>
                </th>
                {units.map((unit) => (
                  <td key={unit.index} className="px-5 py-4 align-top">
                    {canEnquire(unit) ? (
                      <button
                        type="button"
                        onClick={() => onEnquire(unit)}
                        className="primary-button-flood min-h-11 w-full rounded-full bg-accent px-4 py-2.5 font-body text-[11px] font-bold tracking-[0.12em] text-white uppercase transition-colors duration-300 hover:bg-prime-deep dark:text-void"
                      >
                        Enquire
                      </button>
                    ) : (
                      <span className="font-body text-xs text-content/70">Not available</span>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
