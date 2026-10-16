import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowSquareOut, Camera, MagnifyingGlass, PencilSimple, Plus, Storefront } from '@phosphor-icons/react'
import { useProperties } from '../context/ContentContext'
import { UNIT_STATUSES, unitStatusMeta } from '../lib/unitStatus'
import { formatArea, formatUnitLabel, getUnitImages, listUnits, unitPath } from '../lib/units'
import { unitEditPath } from './unitsStore'
import { Button, Card, EmptyState, IconButton, PageHeader, SearchInput, focusRing } from './components/ui'
import { SelectField } from './components/Field'
import { useAdminTitle } from './adminUtils'

/**
 * Every unit in the portfolio on one page — the list the homepage's "Find your
 * ideal space" draws from, without opening each property's Floor plans tab.
 *
 * Grouped by property and building, because that is how the client thinks of
 * them ("Centro, Building 7"), and filterable by property and status so
 * "what's still available at Centro" is two clicks.
 */
export default function UnitsAdminPage() {
  useAdminTitle('Units')
  const properties = useProperties()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const propertyFilter = params.get('property') ?? ''
  const statusFilter = UNIT_STATUSES.some((s) => s.value === params.get('status')) ? params.get('status') : ''
  const setParam = (key, value) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )

  const all = useMemo(() => properties.flatMap((property) => listUnits(property).map((u) => ({ ...u, property }))), [properties])
  const q = query.trim().toLowerCase()
  const shown = all.filter(
    (u) =>
      (!propertyFilter || u.property.id === propertyFilter) &&
      (!statusFilter || (u.unit.status || 'available') === statusFilter) &&
      (!q || [u.unit.label, u.unit.tenant, u.building.building, u.property.name].some((f) => String(f ?? '').toLowerCase().includes(q))),
  )

  const counts = useMemo(() => {
    const scope = all.filter((u) => !propertyFilter || u.property.id === propertyFilter)
    const c = { all: scope.length }
    for (const u of scope) c[u.unit.status || 'available'] = (c[u.unit.status || 'available'] ?? 0) + 1
    return c
  }, [all, propertyFilter])

  // Property → building → units, keeping the order the property editor set.
  const groups = []
  for (const u of shown) {
    const key = `${u.property.id}:${u.buildingIndex}`
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, property: u.property, building: u.building, units: [] }))
    g.units.push(u)
  }

  const newHref = `/admin/units/new${propertyFilter ? `?property=${propertyFilter}` : ''}`

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Units"
        description={`${all.length} units across ${properties.length} properties — every one of them can appear in “Find your ideal space” on the homepage, and each has its own page.`}
        actions={
          <Button variant="primary" icon={Plus} to={newHref}>
            Add unit
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-end">
        <SelectField
          label="Property"
          value={propertyFilter}
          onChange={(v) => setParam('property', v)}
          options={[{ value: '', label: 'All properties' }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <div className="flex justify-end">
          <SearchInput value={query} onChange={setQuery} placeholder="Search unit, tenant, building…" label="Search units" icon={MagnifyingGlass} />
        </div>
      </div>

      <div role="group" aria-label="Filter by status" className="mt-4 flex flex-wrap gap-1.5">
        {[{ value: '', label: 'All' }, ...UNIT_STATUSES].map((s) => {
          const active = statusFilter === s.value
          return (
            <button
              key={s.value || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => setParam('status', s.value)}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors ${focusRing} ${
                active ? 'border-accent-soft bg-accent-soft/15 text-bone' : 'border-white/15 text-bone-2 hover:border-white/30 hover:text-bone'
              }`}
            >
              {s.label}
              <span className={`tabular-nums ${active ? 'text-bone' : 'text-bone-3'}`}>{(s.value ? counts[s.value] : counts.all) ?? 0}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {all.length === 0 && (
          <EmptyState icon={Storefront} title="No units yet" action={<Button variant="primary" icon={Plus} to={newHref}>Add unit</Button>}>
            Units belong to a building on a property. Add one here, or under the property&apos;s Floor plans &amp; 3D tab.
          </EmptyState>
        )}
        {all.length > 0 && shown.length === 0 && <p className="py-8 text-center text-sm text-bone-3">No units match.</p>}

        {groups.map((g) => (
          <section key={g.key} aria-label={`${g.property.name}, ${g.building.building}`}>
            <h2 className="flex flex-wrap items-baseline gap-x-2 text-xs font-bold uppercase tracking-wide text-bone-3">
              <span className="text-bone-2">{g.property.name}</span>
              <span aria-hidden>·</span>
              <span>{g.building.building || 'Unnamed building'}</span>
              <span className="font-normal normal-case tracking-normal">— {g.units.length}</span>
            </h2>
            <Card className="mt-2 divide-y divide-white/10">
              {g.units.map(({ unit, property, building }) => {
                const meta = unitStatusMeta(unit.status)
                const photos = getUnitImages(unit)
                const facts = [formatArea(unit.size), unit.rate, unit.tenant].filter(Boolean)
                const edit = unitEditPath(property, building.building, unit.label)
                return (
                  <div key={`${unit.label}-${unit.index}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:flex-nowrap sm:px-4">
                    <Link to={edit} className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg ${focusRing}`}>
                      <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-black/20 text-bone-3">
                        {photos[0] ? <img src={photos[0]} alt="" className="h-full w-full object-cover" /> : <Storefront className="size-5" aria-hidden />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-[15px] font-medium text-bone">Unit {formatUnitLabel(unit.label) || '—'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.pill}`}>{meta.label}</span>
                        </span>
                        <span className="block truncate text-xs text-bone-3">{facts.join(' · ') || 'No details yet'}</span>
                      </span>
                    </Link>
                    <span className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                      <span className="mr-2 inline-flex items-center gap-1 text-xs tabular-nums text-bone-3" title="Photographs">
                        <Camera className="size-3.5" aria-hidden />
                        {photos.length}
                      </span>
                      {property.published && unit.label && (
                        <IconButton
                          icon={ArrowSquareOut}
                          label={`View unit ${unit.label} on the site`}
                          size="sm"
                          href={unitPath(property.slug, building.building, unit.label)}
                          target="_blank"
                          rel="noreferrer"
                        />
                      )}
                      <Button size="sm" to={edit} icon={PencilSimple}>
                        Edit
                      </Button>
                    </span>
                  </div>
                )
              })}
            </Card>
          </section>
        ))}
      </div>
    </div>
  )
}
