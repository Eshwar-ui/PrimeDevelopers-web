import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSection, useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { SECTIONS } from './content/sectionEditors'

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
    try {
      await api.put(`/content/${section}`, { data: value })
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
          <Link to="/admin/content" className="text-xs font-bold uppercase tracking-wide text-bone/40 hover:text-bone/70">
            ← Site content
          </Link>
          <h1 className="mt-2 font-display text-2xl font-medium">{meta.label}</h1>
        </div>
        <div className="flex items-center gap-4">
          {savedAt && <span className="text-xs text-bone/40">Saved</span>}
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
