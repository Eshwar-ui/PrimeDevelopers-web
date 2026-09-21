import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProperties, useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'

export default function PropertiesListPage() {
  const properties = useProperties()
  const refetch = useContentRefetch()
  const navigate = useNavigate()

  // Which row is asking "are you sure", which is mid-request, and what went
  // wrong. Kept per-id rather than as a single boolean so one row's failure
  // cannot disable the others.
  const [confirming, setConfirming] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  const createProperty = async () => {
    const name = 'New Property'
    const slug = `${slugify(name)}-${Date.now().toString(36)}`
    setError(null)
    setCreating(true)
    try {
      const created = await api.post('/admin/properties', {
        name,
        slug,
        sortOrder: properties.length,
        published: false,
      })
      await refetch()
      navigate(`/admin/properties/${created.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  /**
   * Delete, confirmed inline rather than through `window.confirm`.
   *
   * The native dialog is why this button could look broken: Chrome and Firefox
   * both offer "don't let this page create more dialogs" after a couple of
   * prompts, and once that is ticked `confirm()` returns false forever without
   * showing anything. The handler then returned at its first line, so clicking
   * Delete did nothing at all, with no error and nothing in the console — and
   * it stays that way for the rest of the tab's life.
   *
   * A dialog the page draws itself cannot be suppressed, and it is also the
   * better affordance: the confirmation appears on the row being deleted
   * rather than in a system alert that does not say which one it means.
   */
  const remove = async (id) => {
    setError(null)
    setDeleting(id)
    try {
      await api.del(`/admin/properties/${id}`)
      // Awaited, so the row is still visibly mid-delete until the list it is
      // in has actually been refreshed. Fire-and-forget left a window where
      // the request was done, the spinner was gone and the row was still
      // there, which reads as the delete having failed.
      await refetch()
      setConfirming(null)
    } catch (err) {
      setError(`Could not delete that property — ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium">Properties</h1>
          <p className="mt-1 text-sm text-bone/50">{properties.length} properties</p>
        </div>
        <button
          type="button"
          onClick={createProperty}
          disabled={creating}
          className="rounded-full bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-void disabled:opacity-50"
        >
          {creating ? 'Creating…' : '+ New property'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {properties.map((p) => {
          const isConfirming = confirming === p.id
          const isDeleting = deleting === p.id
          return (
            <div
              key={p.id}
              className={`flex items-center gap-4 rounded-2xl border bg-carbon p-4 transition-colors ${
                isConfirming ? 'border-red-400/50' : 'border-white/10'
              }`}
            >
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/20">
                {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display text-base font-medium">{p.name}</p>
                  {!p.published && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bone/50">
                      Draft
                    </span>
                  )}
                </div>
                <p className="text-xs text-bone-3">
                  {p.category} · {p.address}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4 text-xs font-bold uppercase tracking-wide">
                {isConfirming ? (
                  <>
                    <span className="normal-case tracking-normal text-bone/70">Delete permanently?</span>
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      disabled={isDeleting}
                      className="rounded-full bg-red-500/90 px-3 py-1.5 text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      {isDeleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      disabled={isDeleting}
                      className="text-bone/60 hover:text-bone disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <Link to={`/admin/properties/${p.id}`} className="text-bone/60 hover:text-bone">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setError(null); setConfirming(p.id) }}
                      className="text-red-400/70 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
