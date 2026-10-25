import { useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'

// Shared by every text control. 16px on phones because anything smaller makes
// iOS zoom the page on focus; 14px from `sm` up, where the denser form reads
// better. min-h-11 is the 44px touch floor. The focus state is a ring as well
// as a border change — a 1px border shift on its own was the only sign of
// focus, and easy to lose on a long form.
export const inputClass =
  'min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-[16px] text-bone outline-none transition-colors placeholder:text-bone-3/70 hover:border-white/25 focus:border-accent-soft focus:ring-2 focus:ring-accent-soft/25 sm:text-sm'

const labelClass = 'text-xs font-bold uppercase tracking-wide text-bone-3'

/** Helper copy under a field. Lives with the field, so it can't drift off it. */
function Hint({ children }) {
  if (!children) return null
  return <span className="text-xs leading-relaxed text-bone-3">{children}</span>
}

// A field another system owns (see UnitFields): readable, visibly not editable.
const disabledClass = 'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/15'

export function TextField({ label, value, onChange, type = 'text', placeholder, required, hint, list, disabled }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className={labelClass}>{label}</span>}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        required={required}
        list={list}
        disabled={disabled}
        className={`${inputClass} ${disabledClass}`}
      />
      <Hint>{hint}</Hint>
    </label>
  )
}

/**
 * A figure that may be unset. `type="number"` turns an empty box into 0,
 * which on a listing would publish "$0" as a price; this keeps empty as
 * null. Accepts what people paste — "$1,145,018", "5.5%" — and stores the
 * number alone. `prefix` / `suffix` are shown, never stored.
 */
export function NumberField({ label, value, onChange, prefix, suffix, hint, placeholder }) {
  // What the box shows while it has focus. Held apart from `value` so a
  // half-typed "5." or "1,1" survives the round trip through a number.
  const [draft, setDraft] = useState(null)
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className={labelClass}>{label}</span>}
      <span className="relative flex items-center">
        {prefix && <span className="pointer-events-none absolute left-3 text-sm text-bone-3">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={draft ?? (value ?? '')}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value)
            const raw = e.target.value.replace(/[^\d.-]/g, '')
            if (raw === '' || raw === '-' || raw === '.') return onChange(null)
            const n = Number(raw)
            if (Number.isFinite(n)) onChange(n)
          }}
          onBlur={() => setDraft(null)}
          className={`${inputClass} tabular-nums ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-14' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 text-sm text-bone-3">{suffix}</span>}
      </span>
      <Hint>{hint}</Hint>
    </label>
  )
}

export function TextAreaField({ label, value, onChange, rows = 3, placeholder, hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className={labelClass}>{label}</span>}
      {/* resize-y: an editor writing a long body can pull the box taller
          rather than scrolling a 3-line window. */}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`${inputClass} resize-y leading-relaxed`}
      />
      <Hint>{hint}</Hint>
    </label>
  )
}

export function SelectField({ label, value, onChange, options, hint, disabled }) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className={labelClass}>{label}</span>}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${inputClass} ${disabledClass} cursor-pointer`}
      >
        {normalized.map((o) => (
          <option key={o.value} value={o.value} className="bg-carbon">
            {o.label}
          </option>
        ))}
      </select>
      <Hint>{hint}</Hint>
    </label>
  )
}

export function CheckboxField({ label, value, onChange, hint }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        // accent-color rather than a hand-built control: the native box already
        // carries the focus ring, the keyboard behaviour and the indeterminate
        // state, and a div pretending to be a checkbox has to reimplement all
        // three to end up somewhere worse.
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--color-accent-soft)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className={labelClass}>{label}</span>
        {hint && <span className="text-xs leading-relaxed text-bone-3">{hint}</span>}
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
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-2xl p-5 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft sm:p-6 [&::-webkit-details-marker]:hidden">
        <div>
          <span className="font-display text-[16px] font-medium text-bone">{title}</span>
          {description && <p className="mt-1 max-w-prose text-sm text-bone-3">{description}</p>}
        </div>
        <CaretDown
          weight="bold"
          className="mt-1 size-4 shrink-0 text-bone-3 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-5 px-5 pb-6 pt-1 sm:px-6">{children}</div>
    </details>
  )
}
