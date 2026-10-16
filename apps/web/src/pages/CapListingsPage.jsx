import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CAP_STATUSES } from '../lib/capListings'
import { telHref } from '../lib/propertyInfo'
import { CapListingGrid, useCapListings, useCapListingsSection } from '../components/CapListings'

const FILTERS = [{ value: 'all', label: 'All' }, ...CAP_STATUSES]

/** Who to call, and the client's own risk wording — closes both CAP pages. */
export function CapContactBand({ section }) {
  const contacts = (section.contacts ?? []).filter((c) => c?.name && c?.phone)
  if (!contacts.length && !section.email && !section.disclaimer) return null
  return (
    <section data-band="light" className="bg-surface-alt px-gutter py-16 text-content md:py-20">
      <div className="mx-auto grid max-w-[1360px] gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div>
          <p className="eyebrow font-body text-[13px] text-ember">For more details</p>
          <h2 className="mt-4 font-display font-bold leading-[1.1] tracking-[-0.02em] [font-size:clamp(1.6rem,2.4vw,2.25rem)]">
            Talk to the team
          </h2>
        </div>
        <div>
          <ul className="flex flex-col">
            {contacts.map((c) => (
              <li key={`${c.name}-${c.phone}`}>
                <a
                  href={telHref(c.phone)}
                  className="flex min-h-14 items-center justify-between gap-6 border-b border-line py-4 font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
                >
                  {c.name}
                  <span className="shrink-0 tabular-nums text-content/60">{c.phone}</span>
                </a>
              </li>
            ))}
            {section.email && (
              <li>
                <a
                  href={`mailto:${section.email}`}
                  className="flex min-h-14 items-center justify-between gap-6 border-b border-line py-4 font-body text-[15px] text-content transition-colors duration-300 hover:text-accent"
                >
                  Email
                  <span className="min-w-0 truncate text-content/60">{section.email}</span>
                </a>
              </li>
            )}
          </ul>
          {section.disclaimer && (
            <p className="mt-8 max-w-[46rem] font-body text-xs leading-relaxed text-content/55">{section.disclaimer}</p>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * Every published CAP / NNN deal, filterable by where it stands. The filter
 * lives in the URL so "what's still open" is a link a broker can send.
 */
export default function CapListingsPage() {
  const section = useCapListingsSection()
  const listings = useCapListings()
  const [params, setParams] = useSearchParams()

  const filter = FILTERS.some((f) => f.value === params.get('status')) ? params.get('status') : 'all'
  const counts = useMemo(() => {
    const c = { all: listings.length }
    for (const l of listings) c[l.status] = (c[l.status] ?? 0) + 1
    return c
  }, [listings])
  const shown = filter === 'all' ? listings : listings.filter((l) => l.status === filter)

  useEffect(() => {
    const previous = document.title
    document.title = `${section.heading} — Prime Developer`
    return () => {
      document.title = previous
    }
  }, [section.heading])

  const setFilter = (value) =>
    setParams(
      (p) => {
        if (value === 'all') p.delete('status')
        else p.set('status', value)
        return p
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <div>
      <section className="bg-void px-gutter pb-14 pt-32 text-bone md:pb-16 md:pt-40">
        <div className="mx-auto max-w-[1360px]">
          {section.eyebrow && <p className="eyebrow font-body text-[13px] text-ember">{section.eyebrow}</p>}
          <h1 className="mt-4 max-w-[18ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            {section.heading}
          </h1>
          {section.intro && (
            <p className="mt-6 max-w-[40rem] font-body text-[15px] leading-relaxed text-bone/80 md:text-[16px]">{section.intro}</p>
          )}

          {listings.length > 0 && (
            <div role="group" aria-label="Filter by status" className="mt-10 flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = filter === f.value
                const count = counts[f.value] ?? 0
                if (f.value !== 'all' && count === 0) return null
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.value)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-body text-sm font-bold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft ${
                      active ? 'border-bone bg-bone text-void' : 'border-[var(--color-line-inv)] text-bone/80 hover:border-bone/50 hover:text-bone'
                    }`}
                  >
                    {f.label}
                    <span className={`tabular-nums ${active ? 'text-void/60' : 'text-bone/50'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section data-band="light" className="border-t border-[var(--color-line)] bg-base px-gutter py-14 text-content md:py-20">
        <div className="mx-auto max-w-[1360px]">
          <CapListingGrid
            items={shown}
            emptyState={
              <div className="rounded-panel border border-dashed border-content/20 px-6 py-12 text-center">
                <p className="font-display text-lg font-bold text-content">No listings here right now</p>
                <p className="mx-auto mt-2 max-w-md font-body text-[14px] leading-relaxed text-content/60">
                  New CAP / NNN deals are added as they're structured — talk to the team below for what's coming.
                </p>
              </div>
            }
          />
        </div>
      </section>

      <CapContactBand section={section} />
    </div>
  )
}
