import { useRef } from 'react'
import { Plus } from '@phosphor-icons/react'
import { focusRing } from './ui'

// One chip per item, each a real ARIA tab: arrow keys move between them, the
// selected one is the only one in the tab order. Used for the buildings of a
// property and the units of a building, so each can be edited on its own
// instead of scrolling a page that holds all of them at once.
//
// `item.tags` is an array of { text, tone } rendered inside the chip:
// tone 'three-d' (the 3D tag), 'warn' (needs details), 'status-<value>'.
const TONES = {
  'three-d': 'bg-accent-soft/20 text-accent-soft',
  'no-three-d': 'border border-white/15 text-bone-3',
  warn: 'bg-ember/20 text-ember',
  ok: 'bg-status-available/15 text-status-available',
  'status-available': 'bg-status-available/15 text-status-available',
  'status-leased': 'bg-status-leased/15 text-status-leased',
  'status-sold': 'bg-accent-soft/15 text-accent-soft',
  'status-coming-soon': 'bg-ember/15 text-ember',
  neutral: 'bg-white/10 text-bone-2',
}

export function ChipTag({ tone = 'neutral', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide ${TONES[tone] ?? TONES.neutral}`}
    >
      {children}
    </span>
  )
}

export default function ChipTabs({ label, items, selected, onSelect, onAdd, addLabel, idPrefix }) {
  const refs = useRef([])

  const onKeyDown = (event, i) => {
    const last = items.length - 1
    let next = null
    if (event.key === 'ArrowRight') next = i === last ? 0 : i + 1
    else if (event.key === 'ArrowLeft') next = i === 0 ? last : i - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    onSelect(next)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap items-stretch gap-2">
      {items.map((item, i) => {
        const active = i === selected
        return (
          <button
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${i}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex min-h-11 cursor-pointer flex-col items-start justify-center gap-1 rounded-2xl border px-4 py-2 text-left transition-colors ${focusRing} ${
              active
                ? 'border-accent-soft bg-accent-soft/10 text-bone'
                : 'border-white/15 text-bone-2 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <span className="text-sm font-medium">{item.title}</span>
            {item.tags?.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <ChipTag key={tag.text} tone={tag.tone}>
                    {tag.text}
                  </ChipTag>
                ))}
              </span>
            )}
          </button>
        )
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/25 px-4 text-xs font-bold uppercase tracking-wide text-bone-2 hover:border-accent-soft hover:text-accent-soft ${focusRing}`}
        >
          <Plus weight="bold" className="size-3.5" aria-hidden />
          {addLabel}
        </button>
      )}
    </div>
  )
}
