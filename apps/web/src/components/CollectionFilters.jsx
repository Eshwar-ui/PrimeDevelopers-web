import { useEffect, useId, useRef } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import CustomSelect from './CustomSelect'
import { SIZE_TIERS } from '../lib/unitTiers'
import { PROPERTY_SORTS, UNIT_SORTS } from '../lib/collectionSearch'

// The controls over the curated collection, in the order the questions are
// actually asked:
//
//   scope    what am I looking in, and what am I looking for
//   facets   which use, which state, which size, which plaza
//   results  how many are left, in what order
//
// Three groups, three intervals. The first two are one object — tight, 12px,
// a single bar — because narrowing is one continuous act. The third is pulled
// away behind a hairline, because it does not describe the bar: it describes
// the grid underneath it, and a count that sits with the controls reads as
// another control. That rule is also what gives Sort its home. Sort is not a
// filter; it belongs with the count, at the opposite edge of the same measure
// the cards are laid out on.
//
// Every control is presentational — handed a value and a setter, knowing
// nothing about where the state lives. The page keeps it in the URL so a
// narrowed view is a link, which is the use this bar exists for: a leasing
// agent sends "every available unit over 2,000 sq ft at POW Leander", they do
// not describe a sequence of clicks.

/**
 * A count riding beside a label.
 *
 * Deliberately *not* `.numeral`. That utility is `font-weight: 800` with
 * `line-height: 0.8` and exists for the monumental index markers on section
 * intros (DESIGN.md §2); at 13px inside a button its line-height collapses the
 * span and it sits a pixel high against the label beside it, while the weight
 * makes the figure shout over the word it is counting. Tabular figures at
 * normal weight are what this actually wanted — the column of numbers still
 * lines up, and the label stays the thing you read first.
 */
function Count({ children, className = 'text-content/65' }) {
  return <span className={`ml-2 text-[12px] font-normal tabular-nums ${className}`}>{children}</span>
}

/** A facet that doesn't collapse when it would return nothing — it says so and
 *  stops taking clicks. See `countBy`: an option that silently empties the
 *  grid leaves the visitor unable to tell a bad combination from a bare
 *  portfolio. */
function Pill({ active, count, disabled, children, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      {...props}
      className={`min-h-11 shrink-0 rounded-full border px-5 py-2 font-body text-[13px] font-medium uppercase tracking-[0.1em] transition-colors duration-300 ${
        active
          ? 'border-accent bg-accent text-white dark:text-void'
          : disabled
            ? 'cursor-not-allowed border-[var(--color-line)] text-content/35'
            : 'border-[var(--color-line)] text-content/70 hover:border-content/35 hover:text-content'
      } ${className}`}
    >
      {children}
      {count != null && (
        <Count className={active ? 'text-white dark:text-void' : 'text-content/65'}>{count}</Count>
      )}
    </button>
  )
}

/**
 * The search field.
 *
 * `/` focuses it, which is the shortcut every list this dense has, and Escape
 * clears it from inside the field — not from the document, which would make
 * Escape mean two things on a page that also has a modal.
 *
 * The placeholder sits at 65% of the ink rather than the 45% that reads
 * "quiet" on a white ground and measures 2.7:1 — placeholder copy is the only
 * thing in the field until someone types, so it is body text and is held to
 * body text's floor (craft floor: ≥4.5:1; 65% measures 4.6:1 light, ~7:1 dark).
 */
function SearchField({ value, onChange, placeholder, resultLabel }) {
  const id = useId()
  const ref = useRef(null)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const el = document.activeElement
      // Not while someone is typing somewhere else — the contact form and the
      // admin both live in this app, and stealing `/` out of a textarea would
      // eat the character.
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      event.preventDefault()
      ref.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    // Its own row on a phone. Sharing one with the view toggle leaves the
    // field about 90px wide, which is narrower than the word "Search" it is
    // asking for. Capped at 30rem above that: the field grows to earn its
    // place at the head of the bar and then stops, because a 1,000px search
    // input is a text editor.
    <div className="relative min-w-0 basis-full sm:max-w-[30rem] sm:flex-1 sm:basis-auto">
      <label htmlFor={id} className="sr-only">
        Search the collection
      </label>
      <MagnifyingGlass
        aria-hidden
        weight="bold"
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-content/55"
      />
      <input
        id={id}
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault()
            event.stopPropagation()
            onChange('')
          }
        }}
        // `[&::-webkit-search-cancel-button]:hidden` — Safari and Chrome draw
        // their own clear affordance on `type="search"`, in their own colour,
        // next to the one below. One cross, ours.
        className="h-11 w-full rounded-full border border-[var(--color-line)] bg-surface pl-11 pr-10 font-body text-[14px] text-content placeholder:text-content/65 transition-colors duration-300 hover:border-content/35 focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            ref.current?.focus()
          }}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-content/60 transition-colors duration-200 hover:bg-content/10 hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X aria-hidden weight="bold" className="size-3.5" />
        </button>
      )}
      {/* The count, announced rather than drawn here — it is printed in the
          results line below, and a second visible copy beside the field would
          be the same number twice. */}
      <span aria-live="polite" className="sr-only">
        {resultLabel}
      </span>
    </div>
  )
}

/** One of the refine selects. Half-width on a phone so three of them are two
 *  rows rather than three, fixed above that so the row doesn't breathe in and
 *  out as the labels change length. */
function Refine({ width, ...props }) {
  return (
    <div className={`min-w-0 flex-1 basis-[calc(50%-0.3125rem)] sm:flex-none sm:basis-auto ${width}`}>
      <CustomSelect {...props} />
    </div>
  )
}

export default function CollectionFilters({
  views,
  view,
  onView,
  viewCounts,
  categories,
  categoryCounts,
  filters,
  onChange,
  onClear,
  statuses,
  statusCounts,
  sizeCounts,
  properties,
  propertyCounts,
  activeCount,
  summary,
}) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const units = view === 'units'
  const sorts = units ? UNIT_SORTS : PROPERTY_SORTS
  const defaultSort = sorts[0].id
  // Relevance is the order a search produces, and it is only offered while
  // there is something to be relevant to. Shown as the current value so the
  // control doesn't claim the list is in "Featured" order when it isn't.
  const sortOptions = [
    ...(filters.q.trim() ? [{ value: 'relevance', label: 'Best match' }] : []),
    ...sorts.map((s) => ({ value: s.id, label: s.label })),
  ]
  const sortValue = sortOptions.some((o) => o.value === filters.sort)
    ? filters.sort
    : filters.q.trim()
      ? 'relevance'
      : defaultSort

  /* One availability state, two ways to set it.
     On units this and the status select were two controls governing one axis:
     `availableOnly` tested `status === 'available'`, which is what the select's
     second option already does. The switch now writes `status`, so the pair can
     never disagree — the switch is the shortcut for the question most visitors
     arrive with, the select is the full set behind it. On properties there is
     no status to speak of, and the same switch means "has space left", which is
     that question asked of a whole development. */
  const onlyAvailable = units ? filters.status === 'available' : filters.availableOnly
  const toggleAvailable = () =>
    units
      ? set({ status: onlyAvailable ? 'any' : 'available' })
      : set({ availableOnly: !onlyAvailable })

  const hasCategories = categories.length > 2

  return (
    <div>
      {/* ── The bar ──────────────────────────────────────────────────────
          Scope over facets at a 12px interval: one object, two lines. */}
      <div className="flex flex-col gap-3">
        {/* Scope. Anchored to both edges of the measure rather than huddled at
            the left of it — the field grows to its cap and the toggle is
            pushed to the far rail, which is where a view switch is looked for
            and which stops 800px of the row from reading as unfinished. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <SearchField
            value={filters.q}
            onChange={(q) => set({ q })}
            placeholder={units ? 'Search units, tenants, sizes…' : 'Search properties, areas, tenants…'}
            resultLabel={summary}
          />

          {views.length > 1 && (
            <div
              role="group"
              aria-label="Browse the collection by"
              // Flush, not inset. A `p-1` well would make the control 8px
              // taller than everything beside it, which on one line reads as a
              // misalignment rather than as emphasis.
              className="inline-flex shrink-0 rounded-full border border-[var(--color-line)] sm:ml-auto"
            >
              {views.map((v) => {
                const active = v.id === view
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onView(v.id)}
                    className={`min-h-11 rounded-full px-6 font-body text-[13px] font-bold uppercase tracking-[0.1em] transition-colors duration-300 ${
                      active ? 'bg-accent text-white dark:text-void' : 'text-content/70 hover:text-content'
                    }`}
                  >
                    {v.label}
                    <Count className={active ? 'text-white dark:text-void' : 'text-content/65'}>
                      {viewCounts[v.id]}
                    </Count>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Facets, on one line: use on the left, state on the right, a hairline
            between them. These were two rows, which made the bar three bars
            and left the last of them holding two controls on a 1560px measure.
            Stacked below `xl` only because the two groups genuinely stop
            fitting there, not as a breakpoint habit. Always rendered: the
            availability switch lives here and applies to a portfolio of any
            shape. */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
          {hasCategories && (
            // Scrolls sideways on a phone rather than stacking into four
            // rows — `-mx-gutter` so the row bleeds to the edges it scrolls
            // between, and wraps normally once there is room.
            <div
              role="group"
              aria-label="Filter by use"
              className="-mx-gutter flex snap-x gap-2.5 overflow-x-auto px-gutter pb-1 scroll-px-gutter xl:mx-0 xl:flex-wrap xl:overflow-visible xl:px-0 xl:pb-0"
            >
              {categories.map((c) => {
                // "All" counts what dropping the use filter would leave —
                // every other control still applied, not the whole
                // portfolio. Anything else would make the pill row disagree
                // with the results line the moment a search is typed.
                const count =
                  c === 'All'
                    ? [...categoryCounts.values()].reduce((sum, n) => sum + n, 0)
                    : (categoryCounts.get(c) ?? 0)
                return (
                  <Pill
                    key={c}
                    active={c === filters.category}
                    count={count}
                    disabled={count === 0 && c !== filters.category}
                    onClick={() => set({ category: c })}
                    className="snap-start"
                  >
                    {c}
                  </Pill>
                )
              })}
            </div>
          )}

          {/* The distinction the stacked rows used to carry: what kind of
              space on the left, what state it is in on the right. Dropped
              below `lg`, where the groups are on separate lines and the gap
              says it instead. */}
          {hasCategories && (
            <span aria-hidden className="hidden h-7 w-px shrink-0 bg-[var(--color-line)] xl:block" />
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {units && statuses.length > 1 && (
              <Refine
                width="sm:w-[9.5rem]"
                label="Availability"
                value={filters.status}
                onChange={(status) => set({ status })}
                options={[
                  { value: 'any', label: 'Any status' },
                  ...statuses.map((s) => ({
                    value: s.value,
                    label: `${s.label} (${statusCounts.get(s.value) ?? 0})`,
                    triggerLabel: s.label,
                    // Never the option already chosen: a combination that
                    // returns nothing would otherwise disable the one
                    // control that could undo it.
                    disabled: (statusCounts.get(s.value) ?? 0) === 0 && filters.status !== s.value,
                  })),
                ]}
              />
            )}

            {units && (
              <Refine
                width="sm:w-[11.5rem]"
                label="Size"
                value={filters.size}
                onChange={(size) => set({ size })}
                options={SIZE_TIERS.map((t) => ({
                  value: t.id,
                  label: t.id === 'all' ? 'Any size' : `${t.label} (${sizeCounts.get(t.id) ?? 0})`,
                  triggerLabel: t.id === 'all' ? 'Any size' : t.label,
                  disabled: t.id !== 'all' && (sizeCounts.get(t.id) ?? 0) === 0 && filters.size !== t.id,
                }))}
              />
            )}

            {units && properties.length > 1 && (
              <Refine
                width="sm:w-[11.5rem]"
                label="Property"
                value={filters.property}
                onChange={(property) => set({ property })}
                options={[
                  { value: 'any', label: 'Any property' },
                  ...properties.map((p) => ({
                    value: p.slug,
                    label: `${p.name} (${propertyCounts.get(p.slug) ?? 0})`,
                    triggerLabel: p.name,
                    disabled: (propertyCounts.get(p.slug) ?? 0) === 0 && filters.property !== p.slug,
                  })),
                ]}
              />
            )}

            {/* The question most visitors arrive with, given a control of
                its own rather than a menu they have to read four options to
                get through. */}
            <button
              type="button"
              role="switch"
              aria-checked={onlyAvailable}
              onClick={toggleAvailable}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-full border px-4 font-body text-[13px] font-medium transition-colors duration-300 ${
                onlyAvailable
                  ? 'border-[var(--color-status-available)] text-content'
                  : 'border-[var(--color-line)] text-content/70 hover:border-content/35 hover:text-content'
              }`}
            >
              <span
                aria-hidden
                className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${
                  onlyAvailable ? 'bg-[var(--color-status-available)]' : 'bg-content/25'
                }`}
              >
                <span
                  className={`absolute top-0.5 size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-[left] duration-300 ease-brand ${
                    onlyAvailable ? 'left-[1.125rem]' : 'left-0.5'
                  }`}
                />
              </span>
              Available only
            </button>
          </div>
        </div>
      </div>

      {/* ── The results line ─────────────────────────────────────────────
          Not part of the bar. It reports on the grid, so it is cut away from
          the controls by a rule across the full measure and sits close to the
          cards it captions — the same border-t/pt idiom this page already uses
          to seat its CAP section. The count holds the grid's left edge and the
          order holds its right: both belong to what is below, and the span
          between them is the measure, not a gap. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--color-line)] pt-5">
        <p className="font-body text-[13px] tabular-nums text-content/70">{summary}</p>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-4 font-body text-[12px] font-semibold uppercase tracking-[0.08em] text-content/70 transition-colors duration-300 hover:border-accent/60 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X aria-hidden weight="bold" className="size-3" />
            Clear
            <Count className="ml-0 text-content/70">{activeCount}</Count>
          </button>
        )}

        <div className="ml-auto w-[14.5rem] shrink-0">
          <CustomSelect
            label="Sort"
            value={sortValue}
            onChange={(sort) => set({ sort: sort === defaultSort ? '' : sort })}
            options={sortOptions.map((o) => ({ ...o, triggerLabel: `Sort: ${o.label}` }))}
            align="right"
          />
        </div>
      </div>
    </div>
  )
}
