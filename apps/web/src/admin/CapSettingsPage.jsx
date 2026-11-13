import { useEffect, useState } from 'react'
import { useCapSection, useSaveCapSection } from './capStore'
import { CheckboxField, NumberField, Section, TextAreaField, TextField } from './components/Field'
import RepeatableList from './components/RepeatableList'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { Alert } from './components/ui'
import { mergeFields, stable, useAdminTitle } from './adminUtils'
import { CALCULATOR_DEFAULTS, calculatorSettings } from '../lib/capCalculator'

const FIELDS = ['eyebrow', 'heading', 'intro', 'contacts', 'email', 'disclaimer', 'calculator']

/**
 * A list of numbers typed as "6.5, 6.75, 7". What the box shows is held apart
 * from the stored list while it has focus, so a half-typed "6." survives.
 */
function NumberListField({ label, value, onChange, hint }) {
  const [draft, setDraft] = useState(null)
  return (
    <div onBlur={() => setDraft(null)}>
      <TextField
        label={label}
        hint={hint}
        value={draft ?? (value ?? []).join(', ')}
        onChange={(text) => {
          setDraft(text)
          const numbers = text
            .split(/[,\s]+/)
            .map((part) => part.replace(/[^\d.]/g, ''))
            .filter(Boolean)
            .map(Number)
            .filter(Number.isFinite)
          onChange(numbers)
        }}
      />
    </div>
  )
}

const ASSUMPTIONS = [
  { key: 'escalation', label: 'Rent escalation', suffix: '% / yr' },
  { key: 'appreciation', label: 'Appreciation', suffix: '% / yr' },
  { key: 'closingCost', label: 'Closing cost', suffix: '% of price' },
  { key: 'landValue', label: 'Land value (not depreciated)', suffix: '% of price' },
  { key: 'depreciationYears', label: 'Depreciation life', suffix: 'years' },
  { key: 'holdYears', label: 'Hold period', suffix: 'years' },
]
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

  // What the editor typed, over the shipped values, and what visitors will
  // actually get once blanks and junk are cleaned out of it.
  const calculator = { ...CALCULATOR_DEFAULTS, ...(form.calculator ?? {}) }
  const effective = calculatorSettings(calculator)
  const setCalc = (key) => (value) => patch({ calculator: { ...calculator, [key]: value } })
  const list = (values, unit) => values.map((v) => `${v}${unit}`).join(' · ')

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

      <div>
        {error && (
          <div className="mt-4">
            <Alert>Couldn&apos;t save — {error}</Alert>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-4">
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
          <Section
            title="Investment calculator"
            description="The “Run the numbers” panel on every deal page that is listed or under contract. Same formulas as the Loan Price Sheet."
          >
            <CheckboxField
              label="Show the calculator on deal pages"
              value={calculator.enabled !== false}
              onChange={setCalc('enabled')}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberListField
                label="Interest rates (%)"
                value={calculator.rates}
                onChange={setCalc('rates')}
                hint="Comma-separated, e.g. 6.5, 6.75, 7"
              />
              <NumberListField label="Loan terms (years)" value={calculator.terms} onChange={setCalc('terms')} hint="e.g. 20, 25, 30" />
              <NumberListField
                label="Down payments (%)"
                value={calculator.downPayments}
                onChange={setCalc('downPayments')}
                hint="One value hides the choice from visitors"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberField label="Opening rate" suffix="%" value={calculator.defaultRate} onChange={setCalc('defaultRate')} />
              <NumberField label="Opening term" suffix="years" value={calculator.defaultTerm} onChange={setCalc('defaultTerm')} />
              <NumberField label="Opening down payment" suffix="%" value={calculator.defaultDown} onChange={setCalc('defaultDown')} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ASSUMPTIONS.map(({ key, label, suffix }) => (
                <NumberField key={key} label={label} suffix={suffix} value={calculator[key]} onChange={setCalc(key)} />
              ))}
            </div>
            {/* Read back through the same cleaning the public page applies, so
                a blank field or a default that is not among the options shows
                here as what visitors will get rather than as what was typed. */}
            <p className="text-xs leading-relaxed text-bone-3">
              Visitors see rates {list(effective.rates, '%')} (opening on {effective.defaultRate}%), terms{' '}
              {list(effective.terms, ' yrs')} (opening on {effective.defaultTerm}), and{' '}
              {effective.downPayments.length > 1 ? `down payments ${list(effective.downPayments, '%')}` : `${effective.downPayments[0]}% down`}
              . Owner expenses are taken as zero (NNN).
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
