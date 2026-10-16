import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowSquareOut, Buildings, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useProperties, useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { useCreateProperty } from './useCreate'
import { Alert, Button, Card, ConfirmButton, EmptyState, IconButton, PageHeader, SearchInput, StatusPill, focusRing } from './components/ui'
import { useAdminTitle } from './adminUtils'

export default function PropertiesListPage() {
  useAdminTitle('Properties')
  const properties = useProperties()
  const refetch = useContentRefetch()
  const { create, creating, error: createError } = useCreateProperty()
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  /**
   * Delete, confirmed inline (ConfirmButton) rather than through
   * `window.confirm`.
   *
   * The native dialog is why this button could look broken: Chrome and Firefox
   * both offer "don't let this page create more dialogs" after a couple of
   * prompts, and once that is ticked `confirm()` returns false forever without
   * showing anything. The handler then returned at its first line, so clicking
   * Delete did nothing at all, with no error and nothing in the console — and
   * it stays that way for the rest of the tab's life.
   */
  const remove = async (id) => {
    setError(null)
    try {
      await api.del(`/admin/properties/${id}`)
      // Awaited, so the row is still visibly mid-delete until the list it is
      // in has actually been refreshed. Fire-and-forget left a window where
      // the request was done, the spinner was gone and the row was still
      // there, which reads as the delete having failed.
      await refetch()
    } catch (err) {
      setError(`Could not delete that property — ${err.message}`)
    }
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? properties.filter((p) => [p.name, p.address, p.category, p.slug].some((f) => f?.toLowerCase().includes(q)))
    : properties
  const drafts = properties.filter((p) => !p.published).length

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Properties"
        description={`${properties.length} properties · ${properties.length - drafts} live · ${drafts} draft. Lower sort order shows first on the site.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={create} disabled={creating}>
            {creating ? 'Creating…' : 'New property'}
          </Button>
        }
      />

      {properties.length > 5 && (
        <div className="mt-6">
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, address, category…" label="Search properties" icon={MagnifyingGlass} />
        </div>
      )}

      {(error || createError) && (
        <div className="mt-6">
          <Alert>{error || `Could not create a property — ${createError}`}</Alert>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {properties.length === 0 && (
          <EmptyState
            icon={Buildings}
            title="No properties yet"
            action={
              <Button variant="primary" icon={Plus} onClick={create} disabled={creating}>
                New property
              </Button>
            }
          >
            A new property starts as a draft, so nothing appears on the site until you publish it.
          </EmptyState>
        )}

        {properties.length > 0 && shown.length === 0 && (
          <p className="py-8 text-center text-sm text-bone-3">No properties match “{query}”.</p>
        )}

        {shown.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:flex-nowrap sm:p-4">
            <Link
              to={`/admin/properties/${p.id}`}
              className={`flex min-w-0 flex-1 items-center gap-4 rounded-xl ${focusRing}`}
            >
              <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/20">
                {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-[16px] font-medium text-bone">{p.name}</span>
                  <StatusPill live={p.published} />
                </span>
                <span className="block truncate text-xs text-bone-3">
                  {[p.category, p.address].filter(Boolean).join(' · ')}
                </span>
                <span className="block text-xs text-bone-3">
                  {p.available} available · {p.sold} sold · {p.buildings} buildings
                </span>
              </span>
            </Link>

            <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
              {p.published && (
                <IconButton
                  icon={ArrowSquareOut}
                  label={`View ${p.name} on the site`}
                  size="sm"
                  href={`/properties/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                />
              )}
              <Button size="sm" to={`/admin/properties/${p.id}`} icon={PencilSimple}>
                Edit
              </Button>
              <ConfirmButton icon={Trash} onConfirm={() => remove(p.id)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
