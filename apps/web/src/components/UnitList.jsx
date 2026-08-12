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
    <div className="rounded-2xl border border-[var(--color-line)] bg-surface p-6 md:p-7">
      {/* A disclosure rather than a permanent grid: with the 3D view working,
          tapping a unit on the model is the intended way in, and a wall of
          every unit competes with it. Collapsed still means present in the
          DOM — which is what keeps the crawler, keyboard and no-WebGL paths
          alive — and the toggle itself is focusable and labelled, so nothing
          becomes unreachable. */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-[1.25rem] font-bold tracking-[-0.01em] text-content">
          Unit availability
        </h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--color-line)] px-4 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-content/60 transition-colors duration-200 hover:border-content/30 hover:text-content"
        >
          <span aria-hidden className={`transition-transform duration-200 ${open ? 'rotate-90' : '-rotate-90'}`}>
            ›
          </span>
          {open ? 'Hide all units' : `Browse all ${units.length}`}
        </button>
      </div>

      {/* Selection is announced here rather than on the buttons, so a screen
          reader hears the change even when it originated in the 3D canvas. */}
      <p aria-live="polite" className="sr-only">
        {selectedIndex != null && units.find((u) => u.index === selectedIndex)
          ? `Selected unit ${units.find((u) => u.index === selectedIndex).label}`
          : ''}
      </p>

      {/* Two columns, not three: the design reads down a pair of columns, and
          at three the sq ft under each label starts colliding with the status
          on narrow desktops. Column rule rather than gaps — the rows are one
          list split in half, not two lists. */}
      <ul
        id={panelId}
        hidden={!open}
        ref={listRef}
        className="mt-5 grid sm:grid-cols-2 sm:gap-x-10"
      >
        {units.map((unit, position) => {
          const meta = unitStatusMeta(unit.status)
          const area = formatArea(unit.size)
          const isSelected = unit.index === selectedIndex
          const isFiltered = statusFilter && unit.status !== statusFilter

          return (
            <li key={unit.index} className="border-b border-[var(--color-line)] last:border-b-0">
              <button
                type="button"
                data-unit-index={unit.index}
                onClick={() => onSelect(unit.index)}
                onKeyDown={(e) => onKeyDown(e, position)}
                aria-pressed={isSelected}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-4 text-left transition-colors duration-200 ${
                  isSelected ? 'bg-accent/10' : 'hover:bg-content/4'
                } ${isFiltered ? 'opacity-40' : ''}`}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-display text-[1.15rem] font-bold tracking-[-0.01em] text-content">
                    {unit.label || `Unit ${position + 1}`}
                  </span>
                  {area && <span className="font-body text-[13px] text-content/45">{area}</span>}
                </span>
                {/* Status is carried by the text, not the colour — the dot is
                    reinforcement, never the only signal. */}
                <span
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 ${meta.pill}`}
                >
                  <span aria-hidden className={`size-1.5 rounded-full ${meta.swatch}`} />
                  <span className="font-body text-[11px] font-bold uppercase tracking-[0.1em]">
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
