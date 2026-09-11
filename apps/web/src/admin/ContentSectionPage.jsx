import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSection, useContentRefetch, sectionDefaults } from '../context/ContentContext'
import { api } from '../lib/api'
import { SECTIONS } from './content/sectionEditors'

// Key order is not meaningful here but `JSON.stringify` treats it as though it
// were: a row written from a defaults object and the defaults object itself can
// serialise differently. Sorting object keys on the way out makes the
// comparison below answer the question actually being asked — is this value the
// same as the default — rather than "was it built in the same order".
const stable = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )

export default function ContentSectionPage() {
  const { section } = useParams()
  const meta = SECTIONS.find((s) => s.key === section)
  const current = useSection(section)
  const refetch = useContentRefetch()

  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

  // Reset local edits whenever a different section is opened.
  useEffect(() => setValue(current), [section]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta) {
    return (
      <div>
        <p className="text-bone/60">Unknown section.</p>
        <Link to="/admin/content" className="text-ember">
          ← Back to site content
        </Link>
      </div>
    )
  }

  const patch = (partial) => setValue((v) => ({ ...v, ...partial }))

  const save = async () => {
    setSaving(true)
    setError(null)
    // Only what actually differs from the defaults. The editor is seeded from
    // the *merged* object, so saving `value` wholesale wrote every default this
    // section happened to carry into the row — and because the row shadows the
    // code for any key it holds, that froze the copy at whatever it was on the
    // day someone first opened the page. Later edits to DEFAULTS then had no
    // effect and no explanation: interiors_page is the section that already
    // went this way.
    //
    // The API upserts `data` wholesale, so a key left out here is genuinely
    // absent from the row afterwards and falls through to the default again —
    // which also means clearing a field back to its default now un-authors it,
    // rather than pinning the same text forever.
    const defaults = sectionDefaults(section)
    const authored = Object.fromEntries(
      Object.entries(value).filter(([key, v]) => stable(v) !== stable(defaults[key])),
    )
    try {
      await api.put(`/content/${section}`, { data: authored })
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return
    }
    setSaving(false)
    setSavedAt(Date.now())
    refetch()
  }

  const { Editor } = meta

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/content" className="text-xs font-bold uppercase tracking-wide text-bone-3 hover:text-bone/70">
            ← Site content
          </Link>
          <h1 className="mt-2 font-display text-2xl font-medium">{meta.label}</h1>
        </div>
        <div className="flex items-center gap-4">
          {savedAt && <span className="text-xs text-bone-3">Saved</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-void disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex flex-col gap-6">
        <Editor value={value} onChange={patch} />
      </div>
    </div>
  )
}
