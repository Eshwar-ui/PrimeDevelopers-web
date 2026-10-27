import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { useSection, useContentRefetch, sectionDefaults } from '../context/ContentContext'
import { api } from '../lib/api'
import { SECTIONS } from './content/sectionEditors'
import { SECTION_PATHS } from './content/sectionMeta'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { mergeFields, stable, useAdminTitle } from './adminUtils'
import { Alert, Button, EmptyState } from './components/ui'

export default function ContentSectionPage() {
  const { section } = useParams()
  const meta = SECTIONS.find((s) => s.key === section)
  const current = useSection(section)
  const refetch = useContentRefetch()
  useAdminTitle(meta?.label ?? 'Site content')

  const [value, setValue] = useState(current)
  // What `value` is compared against to know whether there is anything to
  // save: the section as opened, then as last saved.
  const [baseline, setBaseline] = useState(current)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

  // Reset local edits whenever a different section is opened.
  useEffect(() => {
    setValue(current)
    setBaseline(current)
    setSavedAt(null)
    setError(null)
  }, [section]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = stable(value) !== stable(baseline)

  if (!meta) {
    return (
      <EmptyState
        title="That section doesn't exist"
        action={
          <Button to="/admin/content" icon={ArrowLeft}>
            All site content
          </Button>
        }
      >
        It may have been renamed or removed.
      </EmptyState>
    )
  }

  // A value may be an updater of its field — every list editor sends one (see
  // resolveNext in adminUtils).
  const patch = (partial) => setValue((v) => mergeFields(v, partial))

  /** Resolves true when the save landed — LeaveGuard's "Save and leave" relies on it. */
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
    const snapshot = value
    try {
      await api.put(`/content/${section}`, { data: authored })
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return false
    }
    setSaving(false)
    setSavedAt(Date.now())
    setBaseline(snapshot)
    refetch()
    return true
  }

  const { Editor } = meta

  return (
    <div className="pb-24">
      <EditorBar
        backTo="/admin/content"
        backLabel="Site content"
        title={meta.label}
        viewHref={SECTION_PATHS[section]}
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={save}
      >
        {meta.description && <p className="mt-2 hidden max-w-prose text-sm text-bone-3 sm:block">{meta.description}</p>}
      </EditorBar>

      <LeaveGuard when={dirty} onSave={save} />

      <div className="mx-auto max-w-4xl">
        {error && (
          <div className="mt-6">
            <Alert>Couldn&apos;t save — {error}</Alert>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-6">
          <Editor value={value} onChange={patch} />
        </div>
      </div>
    </div>
  )
}
