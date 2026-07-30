import { useEffect, useId, useRef, useState } from 'react'
import { unitStatusMeta } from '../lib/unitStatus'
import { formatArea } from '../lib/units'

// The DOM unit list does four jobs at once, which is why it is a visible part
// of the interface rather than a hidden accessibility shim:
//
//   1. SEO      — a WebGL canvas is invisible to crawlers; this is the only
//                 place unit availability exists as indexable text.
//   2. A11y     — a canvas cannot be focused or announced; this is the
//                 keyboard and screen-reader path to every unit.
//   3. Fallback — it works with no WebGL, no model, and no JavaScript.
//   4. Utility  — scanning a list is genuinely faster than orbiting a model
//                 when you already know which unit you want.
//
// Being visible to everyone is what keeps it correct: a hidden equivalent
// rots because nobody exercises it.
export default function UnitList({ units, selectedIndex, onSelect, statusFilter, defaultOpen = true }) {
  const listRef = useRef(null)
  const panelId = useId()
  const [open, setOpen] = useState(defaultOpen)

  // Keep the list in step with selections made in the 3D viewer or 2D plan,
  // so the keyboard user's position never silently diverges from the pointer
  // user's — without stealing focus from whatever they are actually using.
  useEffect(() => {
    if (selectedIndex == null || !listRef.current) return
    const node = listRef.current.querySelector(`[data-unit-index="${selectedIndex}"]`)
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedIndex])

  if (!units.length) return null

  const onKeyDown = (event, index) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = (index + step + units.length) % units.length
    listRef.current?.querySelector(`[data-unit-index="${units[next].index}"]`)?.focus()
  }

  return (
    <div>
      {/* A disclosure rather than a permanent grid: with the 3D view working,
          tapping a unit on the model is the intended way in, and a wall of
          every unit competes with it. Collapsed still means present in the
          DOM — which is what keeps the crawler, keyboard and no-WebGL paths
          alive — and the toggle itself is focusable and labelled, so nothing
          becomes unreachable. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 items-center gap-2 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-bone/55 transition-colors duration-200 hover:text-bone"
      >
        <span aria-hidden className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
        {open ? 'Hide all units' : `Browse all ${units.length} units`}
      </button>

      {/* Selection is announced here rather than on the buttons, so a screen
          reader hears the change even when it originated in the 3D canvas. */}
      <p aria-live="polite" className="sr-only">
        {selectedIndex != null && units.find((u) => u.index === selectedIndex)
          ? `Selected unit ${units.find((u) => u.index === selectedIndex).label}`
          : ''}
      </p>

      <ul id={panelId} hidden={!open} ref={listRef} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((unit, position) => {
          const meta = unitStatusMeta(unit.status)
          const area = formatArea(unit.size)
          const isSelected = unit.index === selectedIndex
          const isFiltered = statusFilter && unit.status !== statusFilter

          return (
            <li key={unit.index}>
              <button
                type="button"
                data-unit-index={unit.index}
                onClick={() => onSelect(unit.index)}
                onKeyDown={(e) => onKeyDown(e, position)}
                aria-pressed={isSelected}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200 ${
                  isSelected
                    ? 'border-accent bg-accent/12'
                    : 'border-[var(--color-line-inv)] hover:border-bone/30'
                } ${isFiltered ? 'opacity-40' : ''}`}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-display text-base font-medium text-bone">
                    {unit.label || `Unit ${position + 1}`}
                  </span>
                  {area && <span className="font-body text-xs text-bone/45">{area}</span>}
                </span>
                {/* Status is carried by the text, not the colour — the swatch
                    is reinforcement, never the only signal. */}
                <span className="flex shrink-0 items-center gap-2">
                  <span aria-hidden className={`size-2 rounded-sm ${meta.swatch}`} />
                  <span className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-bone/55">
                    {meta.label}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
