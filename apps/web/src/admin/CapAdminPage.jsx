import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowSquareOut, ArrowUp, CurrencyCircleDollar, GearSix, MagnifyingGlass, PencilSimple, Plus, Trash, Warning } from '@phosphor-icons/react'
import { useCapSection, useCapSectionStored, useSaveCapSection } from './capStore'
import { CAP_STATUSES, capRateMismatch, capStatus, formatMoney, formatPercent, formatSf, makeCapListing, unitLine } from '../lib/capListings'
import { Alert, Badge, Button, Card, ConfirmButton, EmptyState, IconButton, PageHeader, SearchInput, StatusPill, focusRing } from './components/ui'
import { useAdminTitle } from './adminUtils'

const STATUS_TONE = { listed: 'success', 'under-contract': 'ember', sold: 'danger' }
const FILTERS = [{ value: 'all', label: 'All' }, ...CAP_STATUSES]

export default function CapAdminPage() {
  useAdminTitle('CAP / NNN')
  const section = useCapSection()
  const stored = useCapSectionStored()
  const save = useSaveCapSection()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const items = section.items ?? []
  const q = query.trim().toLowerCase()
  const filtering = q || filter !== 'all'
  const shown = items.filter(
    (l) => (filter === 'all' || l.status === filter) && (!q || [l.tenant, l.address, l.units, l.tagline].some((f) => String(f ?? '').toLowerCase().includes(q))),
  )
  const count = (status) => items.filter((l) => l.status === status).length

  const run = async (mutate) => {
    setError(null)
    setBusy(true)
    try {
      return await save(mutate)
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    const draft = { ...makeCapListing(), tenant: 'New deal' }
    draft.slug = `new-deal-${Date.now().toString(36)}`
    const next = await run((cur) => ({ ...cur, items: [draft, ...(cur.items ?? [])] }))
    if (next) navigate(`/admin/cap/${draft.id}`)
  }

  const move = (id, by) =>
    run((cur) => {
      const list = [...(cur.items ?? [])]
      const i = list.findIndex((l) => l.id === id)
      const j = i + by
      if (i < 0 || j < 0 || j >= list.length) return cur
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...cur, items: list }
    })

  const remove = (id) => run((cur) => ({ ...cur, items: (cur.items ?? []).filter((l) => l.id !== id) }))

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="CAP / NNN"
        description={`${items.length} deals · ${count('listed')} just listed · ${count('under-contract')} under contract · ${count('sold')} sold. Shown at /cap-properties, on /properties and on the Invest page.`}
        actions={
          <>
            <Button icon={GearSix} to="/admin/cap/settings">
              Page text & contacts
            </Button>
            <Button variant="primary" icon={Plus} onClick={create} disabled={busy}>
              New deal
            </Button>
          </>
        }
      />

      {!stored && (
        <p className="mt-6 rounded-xl border border-accent-soft/30 bg-accent-soft/10 px-4 py-3 text-sm text-bone-2">
          These are the 17 deals imported from the CAP &amp; NNN listings PDF. The first change you save here stores them
          with the site; until then they are the built-in set.
        </p>
      )}

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
                <span className={`tabular-nums ${active ? 'text-bone' : 'text-bone-3'}`}>{f.value === 'all' ? items.length : count(f.value)}</span>
              </button>
            )
          })}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search tenant, address, unit…" label="Search deals" icon={MagnifyingGlass} />
      </div>

      {error && (
        <div className="mt-6">
          <Alert>Couldn&apos;t save — {error}</Alert>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {items.length === 0 && (
          <EmptyState
            icon={CurrencyCircleDollar}
            title="No deals yet"
            action={
              <Button variant="primary" icon={Plus} onClick={create} disabled={busy}>
                New deal
              </Button>
            }
          >
            Each deal is one tenanted unit offered with its lease in place. A new one starts as a draft.
          </EmptyState>
        )}
        {items.length > 0 && shown.length === 0 && <p className="py-8 text-center text-sm text-bone-3">No deals match.</p>}

        {shown.map((l) => {
          const index = items.findIndex((i) => i.id === l.id)
          const mismatch = capRateMismatch(l)
          const facts = [unitLine(l.units), formatSf(l.sf), formatMoney(l.price), l.capRate != null && `${formatPercent(l.capRate)} cap`].filter(Boolean)
          return (
            <Card key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:flex-nowrap sm:p-4">
              <Link to={`/admin/cap/${l.id}`} className={`flex min-w-0 flex-1 items-center gap-4 rounded-xl ${focusRing}`}>
                <span className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-black/20">
                  {l.photo && <img src={l.photo} alt="" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[16px] font-medium text-bone">{l.tenant || 'Untitled deal'}</span>
                    <Badge tone={STATUS_TONE[l.status] ?? 'neutral'}>{capStatus(l.status).label}</Badge>
                    <StatusPill live={l.published !== false} />
                  </span>
                  <span className="block truncate text-xs text-bone-3">{l.address}</span>
                  <span className="block text-xs tabular-nums text-bone-2">{facts.join(' · ')}</span>
                  {mismatch != null && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-ember">
                      <Warning weight="bold" className="size-3.5" aria-hidden />
                      Rent ÷ price is {formatPercent(Math.round(mismatch * 100) / 100)}, cap rate says {formatPercent(l.capRate)}
                    </span>
                  )}
                </span>
              </Link>
              <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                {!filtering && (
                  <>
                    <IconButton icon={ArrowUp} label={`Move ${l.tenant} up`} size="sm" disabled={busy || index === 0} onClick={() => move(l.id, -1)} />
                    <IconButton icon={ArrowDown} label={`Move ${l.tenant} down`} size="sm" disabled={busy || index === items.length - 1} onClick={() => move(l.id, 1)} />
                  </>
                )}
                {l.published !== false && (
                  <IconButton icon={ArrowSquareOut} label={`View ${l.tenant} on the site`} size="sm" href={`/cap-properties/${l.slug}`} target="_blank" rel="noreferrer" />
                )}
                <Button size="sm" to={`/admin/cap/${l.id}`} icon={PencilSimple}>
                  Edit
                </Button>
                <ConfirmButton icon={Trash} onConfirm={() => remove(l.id)} />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
