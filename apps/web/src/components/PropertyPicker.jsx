import { sized } from '../lib/images'

/**
 * The visual stand-in for a `<select>` of properties — Franchise and Collab
 * both ask "which of the six properties, or no preference", and a plain
 * dropdown buries the one piece of context (what does the place look like)
 * that actually helps someone choose. Chips carry the property's own photo,
 * so picking one is a glance rather than a read.
 *
 * Selection lives in the parent, not here: both callers feed the choice into
 * their `QuoteForm`'s `context` prop, so the form needs no field of its own
 * for it and the picker is free to be pure display plus one callback.
 */
export default function PropertyPicker({ properties, value, onChange }) {
  return (
    <div role="group" aria-label="Desired property" className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      <button
        type="button"
        onClick={() => onChange('')}
        aria-pressed={value === ''}
        className={`flex h-16 shrink-0 snap-start items-center rounded-2xl border px-5 font-body text-[13px] font-bold transition-colors ${
          value === '' ? 'border-accent bg-accent/10 text-accent' : 'border-content/15 text-content/60 hover:border-content/35'
        }`}
      >
        No preference
      </button>
      {properties.map((p) => (
        <button
          key={p.slug}
          type="button"
          onClick={() => onChange(p.slug)}
          aria-pressed={value === p.slug}
          className={`group flex h-16 w-[min(78vw,19rem)] shrink-0 snap-start items-center gap-3 overflow-hidden rounded-2xl border pr-4 text-left transition-colors sm:w-auto sm:max-w-[22rem] sm:pr-5 ${
            value === p.slug ? 'border-accent bg-accent/10' : 'border-content/15 hover:border-content/35'
          }`}
        >
          <span className="block h-full w-14 shrink-0 overflow-hidden bg-surface-alt">
            {p.image && (
              <img src={sized(p.image, 'thumb')} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            )}
          </span>
          <span className={`min-w-0 truncate font-body text-[13px] font-bold ${value === p.slug ? 'text-accent' : 'text-content/75'}`}>{p.name}</span>
        </button>
      ))}
    </div>
  )
}
