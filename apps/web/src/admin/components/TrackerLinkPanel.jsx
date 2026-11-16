import { useState } from 'react'
import { api } from '../../lib/api'
import { TextField } from './Field'
import { Alert, Button } from './ui'

/**
 * Which Prime Tracker project feeds this property's units. The tracker sync only
 * updates a property an admin has linked here; it no longer claims one by its
 * slug (security audit M3).
 *
 * Saved on its own endpoint, not with the rest of the form, and it leaves the
 * property's updatedAt alone, so linking never collides with an unsaved edit.
 */
export default function TrackerLinkPanel({ propertyId, initialId }) {
  const [linked, setLinked] = useState(initialId ?? null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async (trackerProjectId) => {
    setBusy(true)
    setError(null)
    try {
      const saved = await api.put(`/admin/properties/${propertyId}/tracker-link`, { trackerProjectId })
      setLinked(saved?.trackerProjectId ?? null)
      setDraft('')
    } catch (err) {
      setError(err?.message || 'The link could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-bone-3">
        {linked ? (
          <>
            Units, statuses and totals follow Prime Tracker project <code className="text-bone">{linked}</code>.
          </>
        ) : (
          <>Not linked: Prime Tracker cannot update this property&apos;s units until it is.</>
        )}
      </p>
      {error && <Alert>{error}</Alert>}
      {linked ? (
        <div>
          <Button size="sm" disabled={busy} onClick={() => save(null)}>
            Unlink
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[18rem] flex-1">
            <TextField
              label="Prime Tracker project ID"
              value={draft}
              onChange={setDraft}
              placeholder="e.g. cmtiyjnbg01bdh360e0mfslii"
              hint="The long ID in the project's address in Prime Tracker."
            />
          </div>
          <Button size="sm" variant="primary" disabled={busy || !draft.trim()} onClick={() => save(draft.trim())}>
            Link
          </Button>
        </div>
      )}
    </div>
  )
}
