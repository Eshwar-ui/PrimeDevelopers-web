import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ArrowSquareOut, EnvelopeSimple, MagnifyingGlass, Phone, Trash, Tray } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { LEAD_STATUSES, useFilteredLeads, useLeads } from './LeadsContext'
import { Alert, Badge, Button, Card, ConfirmButton, EmptyState, PageHeader, SearchInput, Skeleton, focusRing } from './components/ui'
import { timeAgo, useAdminTitle } from './adminUtils'

const FILTERS = [{ value: 'all', label: 'All' }, ...LEAD_STATUSES]

const matches = (lead, q) =>
  [lead.name, lead.email, lead.phone, lead.message, lead.source, lead.unitAttributions?.[0]?.unitLabel]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q))

// Unit attribution lives in its own table rather than as columns on the lead,
// so it used to be fetched separately and joined here. The API now returns each
// lead with its attributions embedded, and property slugs come from content
// context — three requests became one.
export default function LeadsPage() {
  useAdminTitle('Leads')
  const inbox = useLeads()
  const { summary } = inbox
  // "Show filtered" swaps the inbox for the submissions the spam checks caught
  // — kept, not dropped, so a person who tripped one by mistake can be found
  // here and moved back.
  const [showFiltered, setShowFiltered] = useState(false)
  const filteredList = useFilteredLeads(showFiltered)
  const { leads, error, reload, setStatus, remove, moveToInbox, hasMore, loadMore, loadingMore } = showFiltered
    ? filteredList
    : inbox
  const properties = useProperties()
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const [query, setQuery] = useState('')

  // In the URL so the dashboard can link straight to "new", and a filtered
  // view survives a reload.
  const filter = FILTERS.some((f) => f.value === params.get('status')) ? params.get('status') : 'all'
  const setFilter = (value) =>
    setParams(
      (p) => {
        if (value === 'all') p.delete('status')
        else p.set('status', value)
        return p
      },
      { replace: true },
    )

  const slugsByProperty = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p.slug])), [properties])

  // The inbox's chips count every lead on the server; the list holds only the
  // pages loaded so far. The filtered view counts what it has loaded.
  const counts = useMemo(() => {
    if (!showFiltered && summary?.byStatus) return { all: summary.total, ...summary.byStatus }
    const c = { all: leads?.length ?? 0 }
    for (const l of leads ?? []) c[l.status] = (c[l.status] ?? 0) + 1
    return c
  }, [leads, showFiltered, summary])

  const q = query.trim().toLowerCase()
  const shown = (leads ?? []).filter((l) => (filter === 'all' || l.status === filter) && (!q || matches(l, q)))

  // The dashboard links to one lead by hash. <main> is the scroll container,
  // and the router doesn't scroll to hashes on its own, so this does — once the
  // list it points into exists.
  useEffect(() => {
    if (!hash || !leads) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, leads])

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Leads" description="Enquiries from the contact, brochure and floor-plan forms on the public site." />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.value
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors ${focusRing} ${
                  active ? 'border-accent-soft bg-accent-soft/15 text-bone' : 'border-white/15 text-bone-2 hover:border-white/30 hover:text-bone'
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${active ? 'text-bone' : 'text-bone-3'}`}>{counts[f.value] ?? 0}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={showFiltered}
            onClick={() => setShowFiltered((on) => !on)}
            className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors ${focusRing} ${
              showFiltered ? 'border-ember bg-ember/15 text-bone' : 'border-white/15 text-bone-2 hover:border-white/30 hover:text-bone'
            }`}
          >
            Show filtered
            {summary?.filtered != null && (
              <span className={`tabular-nums ${showFiltered ? 'text-bone' : 'text-bone-3'}`}>{summary.filtered}</span>
            )}
          </button>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, unit…" label="Search leads" icon={MagnifyingGlass} />
        </div>
      </div>

      {showFiltered && (
        <p className="mt-4 text-sm leading-relaxed text-bone-3">
          Submissions the spam checks caught: a hidden field a person never sees was filled in, or the form was sent
          faster than anyone could type it. Nobody was emailed about these. If one is a real enquiry, move it to the
          inbox.
        </p>
      )}

      {error && (
        <div className="mt-6">
          <Alert action={<Button size="sm" onClick={reload}>Try again</Button>}>{error}</Alert>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {!leads && !error && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36" />)}

        {leads?.length === 0 &&
          (showFiltered ? (
            <EmptyState icon={Tray} title="Nothing filtered">
              Nothing has tripped the spam checks.
            </EmptyState>
          ) : (
            <EmptyState icon={Tray} title="No enquiries yet">
              Submissions from the contact, brochure and floor-plan forms land here.
            </EmptyState>
          ))}

        {leads?.length > 0 && shown.length === 0 && (
          <EmptyState icon={MagnifyingGlass} title="No leads match" action={<Button size="sm" onClick={() => { setQuery(''); setFilter('all') }}>Clear filters</Button>}>
            Try another status or search term.
          </EmptyState>
        )}

        {shown.map((l) => {
          const attribution = l.unitAttributions?.[0] ?? null
          const unitSlug = attribution ? slugsByProperty[attribution.propertyId] : null
          const isNew = l.status === 'new'
          return (
            <Card
              key={l.id}
              as="article"
              id={`lead-${l.id}`}
              aria-labelledby={`lead-${l.id}-name`}
              className={`scroll-mt-4 p-5 sm:p-6 ${isNew ? 'border-l-4 border-l-ember' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {l.spam && <Badge tone="danger">Filtered{l.spamReason ? `: ${l.spamReason}` : ''}</Badge>}
                    {isNew && !l.spam && <Badge tone="ember">New</Badge>}
                    {/* Every lead has a source now — `contact` is the default
                        for rows written before this column existed, so it
                        doubles as "plain enquiry, nothing to distinguish". */}
                    {l.source && l.source !== 'contact' && <Badge tone="neutral">{l.source}</Badge>}
                    {/* Written by the floor-plan enquiry flow (FloorPlanSection.jsx)
                        so sales opens the call already knowing which unit this is
                        about, rather than establishing it from scratch. Absent on
                        leads from the plain contact form. */}
                    {attribution && <Badge tone="accent">Unit {attribution.unitLabel}</Badge>}
                    {attribution?.buildingLabel && <span className="text-xs text-bone-3">{attribution.buildingLabel}</span>}
                  </div>
                  <h2 id={`lead-${l.id}-name`} className="font-display text-lg font-medium text-bone">
                    {l.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={`mailto:${l.email}`} className={`inline-flex items-center gap-1.5 rounded text-accent-soft hover:text-accent-hi ${focusRing}`}>
                      <EnvelopeSimple weight="bold" className="size-4" aria-hidden />
                      {l.email}
                    </a>
                    {l.phone && (
                      <a href={`tel:${l.phone}`} className={`inline-flex items-center gap-1.5 rounded text-accent-soft hover:text-accent-hi ${focusRing}`}>
                        <Phone weight="bold" className="size-4" aria-hidden />
                        {l.phone}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-bone-3" title={new Date(l.createdAt).toLocaleString()}>
                    {timeAgo(l.createdAt)}
                  </span>
                  <label className="flex items-center">
                    <span className="sr-only">Status for {l.name}</span>
                    <select
                      value={l.status}
                      onChange={(e) => setStatus(l.id, e.target.value)}
                      className={`min-h-9 cursor-pointer rounded-full border border-white/20 bg-black/20 px-3 text-xs font-medium text-bone outline-none transition-colors hover:border-white/40 focus:border-accent-soft ${focusRing}`}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s.value} value={s.value} className="bg-carbon">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {l.spam && (
                    <Button size="sm" icon={Tray} onClick={() => moveToInbox(l.id)}>
                      Move to inbox
                    </Button>
                  )}
                  <ConfirmButton icon={Trash} prompt="Delete this lead?" onConfirm={() => remove(l.id)} />
                </div>
              </div>

              {l.message && <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-bone-2">{l.message}</p>}

              {l.context && Object.keys(l.context).length > 0 && (
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-black/15 p-4 sm:grid-cols-3">
                  {Object.entries(l.context).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-bone-3">{key}</dt>
                      <dd className="text-sm text-bone">{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {attribution && unitSlug && (
                <Button
                  variant="ghost"
                  size="sm"
                  href={`/properties/${unitSlug}?unit=${encodeURIComponent(attribution.unitLabel)}`}
                  target="_blank"
                  rel="noreferrer"
                  icon={ArrowSquareOut}
                  className="-ml-3 mt-3"
                >
                  View the unit page
                </Button>
              )}
            </Card>
          )
        })}

        {/* The list arrives a page at a time, newest first. The chips count
            every lead on the server; search covers what has been loaded. */}
        {hasMore && (
          <div className="flex flex-col items-center gap-2 py-4">
            <Button size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load older leads'}
            </Button>
            <span className="text-xs text-bone-3">Showing the newest {leads.length}. Search covers these only.</span>
          </div>
        )}
      </div>
    </div>
  )
}
