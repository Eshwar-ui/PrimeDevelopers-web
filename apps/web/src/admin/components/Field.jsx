import { CaretDown } from '@phosphor-icons/react'

export function TextField({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-bold uppercase tracking-wide text-bone-3">{label}</span>}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-bone outline-none focus:border-ember"
      />
    </label>
  )
}

export function TextAreaField({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-bold uppercase tracking-wide text-bone-3">{label}</span>}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="resize-none rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-bone outline-none focus:border-ember"
      />
    </label>
  )
}

export function SelectField({ label, value, onChange, options }) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-bold uppercase tracking-wide text-bone-3">{label}</span>}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-bone outline-none focus:border-ember"
      >
        {normalized.map((o) => (
          <option key={o.value} value={o.value} className="bg-carbon">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CheckboxField({ label, value, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        // accent-color rather than a hand-built control: the native box already
        // carries the focus ring, the keyboard behaviour and the indeterminate
        // state, and a div pretending to be a checkbox has to reimplement all
        // three to end up somewhere worse.
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-ember)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wide text-bone-3">{label}</span>
        {hint && <span className="text-[11px] leading-snug text-bone-3/80">{hint}</span>}
      </span>
    </label>
  )
}

// A native <details> disclosure rather than a hand-built accordion: the
// browser owns the open/closed state, keyboard toggling, and the semantics —
// nothing here has to reimplement any of that. `defaultOpen` only sets the
// *initial* state (native `open` is uncontrolled), so a caller can collapse
// a rarely-touched section without any of this component's ~100 other call
// sites changing behaviour.
//
// `open` + `onToggle` opt into a controlled mode instead, for the one caller
// that needs the state to outlive the element: PropertyEditPage unmounts whole
// tab panels, and an uncontrolled <details> comes back at `defaultOpen` every
// time, so a section an editor collapsed reopened itself on the next tab
// switch. Pass both or neither — with `open` set and nothing listening to
// `onToggle`, a user's click changes the DOM without changing the prop, and
// React leaves the two disagreeing.
export function Section({ title, description, children, defaultOpen = true, open, onToggle, id }) {
  const controlled = open !== undefined

  return (
    <details
      id={id}
      open={controlled ? open : defaultOpen}
      onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined}
      className="group scroll-mt-24 rounded-2xl border border-white/10 bg-carbon"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
        <div>
          <span className="font-display text-base font-medium text-bone">{title}</span>
          {description && <p className="mt-1 text-xs text-bone-3">{description}</p>}
        </div>
        <CaretDown
          weight="bold"
          className="mt-1 size-4 shrink-0 text-bone-3 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-5 px-6 pb-6 pt-1">{children}</div>
    </details>
  )
}
