import Prose from './Prose'

// Pricing as the client's rate sheet states it, from `detail.pricing`.
//
// Values are display strings, copied from the sheet — "$421,260", "Lease
// only" — rather than numbers formatted here, so the page never shows a figure
// the sheet doesn't. These tables are not the unit inventory: availability
// lives in `floorPlans.buildings[].unitList`, mirrored from Prime Tracker.

const UNIT_COLUMNS = [
  ['unit', 'Unit'],
  ['type', 'Type'],
  ['size', 'Size (SF)'],
  ['salePrice', 'Sale price'],
  ['salePsf', 'Sale ($/SF)'],
  ['lease', 'Lease ($/SF/yr)'],
  ['nnn', 'NNN ($/SF/yr)'],
  ['annualRent', 'Annual rent incl. NNN'],
]

// `tenant` is resolved per row below: the tenant's name only while
// `showTenantNames` is on, its business type otherwise. Names need the
// client's sign-off before they go public, so the one flag is the switch.
const CAP_COLUMNS = [
  ['unit', 'Unit'],
  ['tenant', 'Tenant'],
  ['size', 'Size (SF)'],
  ['price', 'Price'],
  ['capRate', 'Cap rate'],
  ['leaseTerm', 'Lease term'],
  ['rent', 'Yearly rent'],
  ['nnn', 'Yearly NNN'],
]

function PriceTable({ table, columns, cell = (row, key) => row[key] }) {
  if (!table?.rows?.length) return null
  return (
    <div className="mt-12 first:mt-0">
      <h3 className="font-display text-[1.5rem] font-bold tracking-[-0.01em] text-content md:text-[1.75rem]">
        {table.heading}
      </h3>
      {table.intro && (
        <div className="mt-3 max-w-[70ch] font-body text-[16px] leading-[1.7] text-content/70">
          <Prose text={table.intro} />
        </div>
      )}
      {/* Scrolls sideways inside its own frame on a phone rather than
          squeezing eight columns of figures into 340px. */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-surface">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              {columns.map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  className="px-4 py-3.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-content/70 first:pl-6 last:pr-6"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={`${row.unit}-${i}`} className="border-b border-[var(--color-line)] last:border-b-0">
                {columns.map(([key], c) =>
                  c === 0 ? (
                    <th
                      key={key}
                      scope="row"
                      className="px-4 py-3.5 pl-6 font-display text-[15px] font-bold tabular-nums text-content"
                    >
                      {cell(row, key) || '—'}
                    </th>
                  ) : (
                    <td
                      key={key}
                      className="px-4 py-3.5 font-body text-[15px] tabular-nums text-content/80 last:pr-6"
                    >
                      {cell(row, key) || '—'}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PropertyPricingTables({ pricing }) {
  if (!pricing?.units?.rows?.length && !pricing?.capRate?.rows?.length) return null
  const showNames = Boolean(pricing.capRate?.showTenantNames)
  return (
    <div className="mt-16 md:mt-20">
      <PriceTable table={pricing.units} columns={UNIT_COLUMNS} />
      <PriceTable
        table={pricing.capRate}
        columns={CAP_COLUMNS}
        cell={(row, key) => (key === 'tenant' ? (showNames ? row.tenant : row.businessType) : row[key])}
      />
    </div>
  )
}
