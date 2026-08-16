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

export function Section({ title, description, children }) {
  return (
    <fieldset className="rounded-2xl border border-white/10 bg-carbon p-6">
      <legend className="px-1 font-display text-base font-medium text-bone">{title}</legend>
      {description && <p className="mt-1 text-xs text-bone-3">{description}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </fieldset>
  )
}
