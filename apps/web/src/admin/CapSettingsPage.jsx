import { useEffect, useState } from 'react'
import { useCapSection, useSaveCapSection } from './capStore'
import { Section, TextAreaField, TextField } from './components/Field'
import RepeatableList from './components/RepeatableList'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { Alert } from './components/ui'
import { mergeFields, stable, useAdminTitle } from './adminUtils'

const FIELDS = ['eyebrow', 'heading', 'intro', 'contacts', 'email', 'disclaimer']
const pick = (section) => Object.fromEntries(FIELDS.map((k) => [k, section[k]]))

/** The /cap-properties page's own copy, and the contact band both CAP pages close with. */
export default function CapSettingsPage() {
  useAdminTitle('CAP / NNN page')
  const section = useCapSection()
  const save = useSaveCapSection()
  const [form, setForm] = useState(() => pick(section))
  const [baseline, setBaseline] = useState(() => pick(section))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

  // Picks up a stored row that lands after first render, as long as nothing
  // has been typed yet.
  useEffect(() => {
    if (stable(form) === stable(baseline)) {
      const fresh = pick(section)
      setForm(fresh)
      setBaseline(fresh)
    }
  }, [section]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = stable(form) !== stable(baseline)
  // A value may be an updater of its field — the contacts list sends one.
  const patch = (partial) => setForm((f) => mergeFields(f, partial))

  const onSave = async () => {
    setSaving(true)
    setError(null)
    const snapshot = form
    try {
      await save((cur) => ({ ...cur, ...snapshot }))
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return false
    }
    setSaving(false)
    setSavedAt(Date.now())
    setBaseline(snapshot)
    return true
  }

  return (
    <div className="pb-24">
      <EditorBar
        backTo="/admin/cap"
        backLabel="All deals"
        title="CAP / NNN page"
        viewHref="/cap-properties"
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={onSave}
      />
      <LeaveGuard when={dirty} onSave={onSave} />

      <div className="mx-auto max-w-4xl">
        {error && (
          <div className="mt-6">
            <Alert>Couldn&apos;t save — {error}</Alert>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-6">
          <Section title="Page header" description="The top of /cap-properties.">
            <TextField label="Kicker" value={form.eyebrow} onChange={(eyebrow) => patch({ eyebrow })} />
            <TextField label="Heading" value={form.heading} onChange={(heading) => patch({ heading })} />
            <TextAreaField label="Intro" rows={2} value={form.intro} onChange={(intro) => patch({ intro })} />
          </Section>
          <Section title="Contacts & disclaimer" description="Closes the list page and every deal page.">
            <RepeatableList
              items={form.contacts ?? []}
              onChange={(contacts) => patch({ contacts })}
              makeItem={() => ({ name: '', phone: '' })}
              addLabel="Add contact"
              renderItem={(item, set) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Name" value={item.name} onChange={(name) => set({ ...item, name })} />
                  <TextField label="Phone" type="tel" value={item.phone} onChange={(phone) => set({ ...item, phone })} />
                </div>
              )}
            />
            <TextField label="Email" type="email" value={form.email} onChange={(email) => patch({ email })} />
            <TextAreaField label="Disclaimer" rows={3} value={form.disclaimer} onChange={(disclaimer) => patch({ disclaimer })} />
          </Section>
        </div>
      </div>
    </div>
  )
}
