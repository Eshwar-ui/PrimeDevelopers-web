import { useEffect, useId, useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import CustomSelect from './CustomSelect'
import { EMPTY_FILTERS, UNIT_FACETS, activeFilterCount } from '../lib/unitFilters'

/**
 * The search box and the filters over a unit list: availability, size and
 * pricing. The facets come from UNIT_FACETS, so a filter added there shows up
 * here with its own count and no change to this file.
 *
 * Controlled: `filters` in, `onChange(nextFilters)` out. The parent keeps them
 * in the URL, which is what makes a filtered list a link someone can send.
 *
 * `counts` is facetCounts()'s result — the number each option would show — and
 * `total`/`shown` the size of the list before and after.
 */
export default function UnitFilterBar({ filters, onChange, counts, total, shown }) {
  const searchId = useId()
  // The box keeps its own text and reports it after a pause. Writing the URL on
  // every keystroke re-filters and re-renders a few hundred cards per letter.
  const [text, setText] = useState(filters.q)
  useEffect(() => setText(filters.q), [filters.q])
  useEffect(() => {
    if (text === filters.q) return undefined
    const timer = window.setTimeout(() => onChange({ ...filters, q: text }), 200)
    return () => window.clearTimeout(timer)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps -- only a keystroke should start the timer

  const active = activeFilterCount(filters) > 0 || text.trim() !== ''
  const clear = () => {
    setText('')
    onChange({ ...EMPTY_FILTERS })
  }

  return (
    <div className="mt-8 flex flex-col gap-4" role="search" aria-label="Search and filter units">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={searchId} className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search units</span>
          <MagnifyingGlass
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-content/50"
          />
          <input
            id={searchId}
            type="search"
            value={text}
            maxLength={80}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search unit, building, tenant…"
            autoComplete="off"
            className="h-11 w-full rounded-full border border-content/20 bg-surface pl-11 pr-4 font-body text-[16px] text-content outline-none transition-[border-color,box-shadow] placeholder:text-content/50 hover:border-content/35 focus-visible:border-accent/75 focus-visible:ring-[3px] focus-visible:ring-accent/15 sm:text-[13px]"
          />
        </label>

        {UNIT_FACETS.map((facet) => (
          <div key={facet.id} className="w-full min-w-0 sm:w-auto sm:min-w-[11.5rem]">
            <CustomSelect
              label={facet.label}
              placeholder={facet.anyLabel}
              value={filters[facet.id] ?? ''}
              options={[
                { value: '', label: facet.anyLabel },
                ...facet.options.map((option) => ({
                  value: option.id,
                  label: `${option.label} (${counts?.[facet.id]?.[option.id] ?? 0})`,
                  triggerLabel: option.label,
                })),
              ]}
              onChange={(id) => onChange({ ...filters, [facet.id]: id })}
            />
          </div>
        ))}

        {active && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-body text-[13px] font-bold text-accent transition-colors duration-200 hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X aria-hidden weight="bold" className="size-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Announced as it changes, so a screen-reader user typing in the box
          hears what the list became without having to go and look. */}
      <p aria-live="polite" className="font-body text-[13px] text-content/65">
        {active ? (
          <>
            <span className="numeral font-bold text-content">{shown}</span> of {total} {total === 1 ? 'unit' : 'units'}
          </>
        ) : (
          `${total} ${total === 1 ? 'unit' : 'units'}`
        )}
      </p>
    </div>
  )
}
