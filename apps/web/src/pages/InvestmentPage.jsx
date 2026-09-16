import { Navigate, useParams, Link } from 'react-router-dom'
import { useProperty } from '../context/ContentContext'
import { useSectionNav } from '../hooks/useSectionNav'
import { getBuildings, formatUnitLabel, formatArea } from '../lib/units'
import { unitStatusMeta } from '../lib/unitStatus'
import {
  findBuildingBySlug,
  getInvestment,
  filledFigures,
  rentRoll,
  hasInvestmentData,
} from '../lib/investment'

// Eyebrow label, matching PropertyDetailPage's. Duplicated rather than shared
// for now because the two pages are the only callers and the shared version
// would have to live somewhere neither owns; worth extracting on the third.
function SectionTag({ children }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
      <span className="font-body text-[13px] font-bold uppercase tracking-[0.28em] text-content/70">
        {children}
      </span>
    </div>
  )
}

/**
 * One building as an investment.
 *
 * Reached from the property page's Resources rail, and from a CAP-rate flyer
 * link once the client has published figures for that building. Everything on
 * it is conditional: the client fills this in building by building over time,
 * so the page has to read as finished at every stage rather than as a form
 * with gaps. A figure with no value is not rendered at all — no "—" rows, no
 * empty cards.
 */
export default function InvestmentPage() {
  const { slug, building: buildingParam } = useParams()
  const property = useProperty(slug)
  const go = useSectionNav()

  // Still loading — the context hands back undefined before the fetch lands.
  if (property === undefined) return null
  if (!property) return <Navigate to="/properties" replace />

  const building = findBuildingBySlug(getBuildings(property), buildingParam)
  // An unknown building is a stale link, not an error page: send the reader to
  // the property it was about, which is the thing they were looking for.
  if (!building) return <Navigate to={`/properties/${property.slug}`} replace />

  const investment = getInvestment(building) ?? {}
  const figures = filledFigures(investment)
  const roll = rentRoll(building)
  const highlights = (investment.highlights ?? []).filter((h) => String(h ?? '').trim())
  const summary = String(investment.summary ?? '').trim()
  const populated = hasInvestmentData(building)

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────
          A band rather than a photographic hero. This page is read for its
          numbers, and a full-bleed image above them would push the only
          thing the reader came for below the fold. */}
      <section className="bg-void px-gutter pb-16 pt-28 text-bone md:pb-20 md:pt-36">
        <div className="mx-auto max-w-[1560px]">
          <Link
            to={`/properties/${property.slug}`}
            className="group inline-flex min-h-11 w-fit items-center gap-3 font-body text-[12px] font-bold uppercase tracking-[0.16em] text-bone/70 transition-colors hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bone"
          >
            <span className="transition-transform duration-300 group-hover:-translate-x-1">←</span>
            {property.name}
          </Link>

          <p className="mt-10 font-body text-[12px] font-bold uppercase tracking-[0.2em] text-bone/65">
            Investment summary
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] text-bone md:text-6xl">
            {building.building}
          </h1>
          {property.address && (
            <p className="mt-3 font-body text-sm text-bone/70 md:text-base">{property.address}</p>
          )}

          {/* The headline figures. `auto-fit` rather than a fixed column count
              because how many there are is the client's choice — two filled
              fields should fill the row, not sit in a nine-column skeleton. */}
          {figures.length > 0 && (
            <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-bone/15 bg-bone/15 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
              {figures.map(({ key, label, value }) => (
                <div key={key} className="bg-void px-5 py-6 md:px-6">
                  <dt className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-bone/55">
                    {label}
                  </dt>
                  <dd className="mt-2 font-display text-xl font-bold tracking-[-0.02em] text-bone md:text-2xl">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* The state this page spends its first weeks in. Said plainly
              rather than dressed up as an empty dashboard — a reader who can
              see there are no figures yet will ask for them, which is the
              useful outcome. */}
          {!populated && (
            <p className="mt-12 max-w-2xl rounded-2xl border border-bone/15 bg-bone/5 px-6 py-5 font-body text-sm leading-relaxed text-bone/70">
              Investment figures for {building.building} are being prepared. The unit schedule
              below is current;{' '}
              <Link to={`/contact?property=${property.id}`} className="text-accent-soft underline underline-offset-4">
                ask us
              </Link>{' '}
              for the rate sheet in the meantime.
            </p>
          )}
        </div>
      </section>

      {/* ── Summary and highlights ───────────────────────────── */}
      {(summary || highlights.length > 0) && (
        <section data-band="light" className="bg-base px-gutter py-16 md:py-24">
          <div className="mx-auto grid max-w-[1560px] gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-20">
            <div>
              <SectionTag>The opportunity</SectionTag>
              {summary && (
                <p className="mt-8 max-w-3xl font-body text-base leading-relaxed text-content/85 md:text-lg">
                  {summary}
                </p>
              )}
            </div>

            {highlights.length > 0 && (
              <ul className="flex flex-col gap-3">
                {highlights.map((highlight, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-[var(--color-line)] bg-surface p-4"
                  >
                    <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="font-body text-sm leading-relaxed text-content/85">{highlight}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ── Rent roll ────────────────────────────────────────────
          Read straight off the building's unit list, so it stays in step with
          the plan, the 3D view and Prime Tracker without being re-entered. */}
      {roll.length > 0 && (
        <section data-band="light" className="bg-surface-alt px-gutter py-16 md:py-24">
          <div className="mx-auto max-w-[1560px]">
            <SectionTag>Unit schedule</SectionTag>

            {/* A real table: this is tabular data, and a grid of divs would
                lose the row/column relationship every screen reader needs to
                read a rent roll aloud. */}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    {['Unit', 'Tenant', 'Size', 'Rent', 'Status'].map((head) => (
                      <th
                        key={head}
                        scope="col"
                        className="py-3 pr-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-content/55"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roll.map((row, i) => {
                    const meta = unitStatusMeta(row.status)
                    return (
                      <tr key={`${row.label}-${i}`} className="border-b border-[var(--color-line)]/60">
                        <td className="py-4 pr-4 font-display text-base font-bold tracking-[-0.01em] text-content">
                          {formatUnitLabel(row.label)}
                        </td>
                        <td className="py-4 pr-4 font-body text-sm text-content/80">{row.tenant || '—'}</td>
                        <td className="py-4 pr-4 font-body text-sm text-content/80">
                          {formatArea(row.size) ?? '—'}
                        </td>
                        <td className="py-4 pr-4 font-body text-sm text-content/80">{row.rate || '—'}</td>
                        <td className="py-4 pr-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-wide ${meta.pill}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Close ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-void px-gutter py-20 text-bone md:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 70% at 100% 100%, rgba(0,115,164,0.22) 0%, rgba(0,115,164,0) 70%)',
          }}
        />
        <div className="relative mx-auto max-w-[1560px]">
          <h2 className="max-w-2xl font-display text-3xl font-bold tracking-[-0.03em] text-bone md:text-5xl">
            Interested in {building.building}?
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => go(`/contact?property=${property.id}&from=/properties/${property.slug}`)}
              className="group inline-flex min-h-11 items-center gap-3 rounded-full bg-accent py-1 pl-6 pr-1 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-void transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bone"
            >
              Request the rate sheet
              <span className="grid size-11 place-items-center rounded-full bg-void text-bone">→</span>
            </button>

            {/* The PDF still has a job: it is what a broker forwards. */}
            {String(investment.flyerUrl ?? '').trim() && (
              <a
                href={investment.flyerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center font-body text-[13px] font-bold uppercase tracking-[0.12em] text-bone/75 underline decoration-bone/30 underline-offset-8 transition hover:text-bone hover:decoration-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bone"
              >
                Download the CAP rate flyer
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
