import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useProperties } from '../context/ContentContext'

// Unit attribution lives in its own table rather than as columns on the lead,
// so it used to be fetched separately and joined here. The API now returns each
// lead with its attributions embedded, and property slugs come from content
// context — three requests became one.
export default function LeadsPage() {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  const properties = useProperties()

  const slugsByProperty = useMemo(
    () => Object.fromEntries(properties.map((p) => [p.id, p.slug])),
    [properties],
  )

  const load = async () => {
    try {
      setLeads(await api.get('/admin/leads'))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const markRead = async (id, status) => {
    try {
      await api.patch(`/admin/leads/${id}`, { status })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this lead?')) return
    try {
      await api.del(`/admin/leads/${id}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-medium">Leads</h1>
      <p className="mt-1 text-sm text-bone/50">Contact form submissions from the public site.</p>

      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex flex-col gap-3">
        {leads?.length === 0 && <p className="text-sm text-bone/40">No submissions yet.</p>}
        {leads?.map((l) => {
          const attribution = l.unitAttributions?.[0] ?? null
          const unitSlug = attribution ? slugsByProperty[attribution.propertyId] : null
          return (
            <div
              key={l.id}
              className={`rounded-2xl border p-6 ${
                l.status === 'new' ? 'border-ember/40 bg-carbon' : 'border-white/10 bg-carbon/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  {/* Written by the floor-plan enquiry flow (FloorPlanSection.jsx)
                      so sales opens the call already knowing which unit this is
                      about, rather than establishing it from scratch. Absent on
                      leads from the plain contact form. */}
                  {attribution && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-accent/20 px-2.5 py-0.5 font-body text-[11px] font-bold uppercase tracking-wide text-accent-soft">
                        Unit {attribution.unitLabel}
                      </span>
                      {attribution.buildingLabel && (
                        <span className="text-xs text-bone/40">{attribution.buildingLabel}</span>
                      )}
                    </div>
                  )}
                  <p className="font-display text-lg font-medium">{l.name}</p>
                  <p className="text-sm text-bone/50">
                    {l.email}
                    {l.phone ? ` · ${l.phone}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-bold uppercase tracking-wide">
                  <span className="text-bone/35">{new Date(l.createdAt).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => markRead(l.id, l.status === 'new' ? 'read' : 'new')}
                    className="text-bone/50 hover:text-bone"
                  >
                    {l.status === 'new' ? 'Mark read' : 'Mark new'}
                  </button>
                  <button type="button" onClick={() => remove(l.id)} className="text-red-400/70 hover:text-red-400">
                    Delete
                  </button>
                </div>
              </div>
              {/* Status-at-enquiry and the source page have no dedicated column
                  on this shared schema — both are folded into the message text
                  at submission (see ContactPage.jsx), so they surface here too. */}
              {l.message && <p className="mt-4 whitespace-pre-wrap text-sm text-bone/70">{l.message}</p>}
              {attribution && unitSlug && (
                <a
                  href={`/properties/${unitSlug}?unit=${encodeURIComponent(attribution.unitLabel)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-accent-soft hover:text-bone"
                >
                  View the unit page →
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
