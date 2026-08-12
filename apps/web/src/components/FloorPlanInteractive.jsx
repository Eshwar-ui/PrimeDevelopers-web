import { unitStatusMeta } from '../lib/unitStatus'

// Tier 2: the real floor plan image *is* the interactive surface — each unit
// with a placed position renders as a clickable pin directly on the image.
//
// Retained, not replaced, now that a 3D viewer exists. This is what a visitor
// gets when there is no model, no WebGL, or the model failed to load, so it
// has to stay a first-class experience rather than a stub.
export default function FloorPlanInteractive({ image, units, selection = [], onSelect, statusFilter }) {
  if (!image) return null

  const placed = units.filter((unit) => unit.x != null && unit.y != null)
  const selected = new Set(selection)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-inv)]">
      <img src={image} alt="Floor plan" className="block w-full select-none" />
      {placed.map((unit) => {
        const meta = unitStatusMeta(unit.status)
        const isSelected = selected.has(unit.index)
        const isExcluded = statusFilter && unit.status !== statusFilter
        return (
          <button
            key={unit.index}
            type="button"
            // Modifier-click adds to the comparison without needing the mode,
            // matching what a desktop user already expects from a pin map.
            onClick={(event) => onSelect(unit.index, event.shiftKey || event.metaKey || event.ctrlKey)}
            aria-pressed={isSelected}
            aria-label={`Unit ${unit.label || unit.index + 1} — ${meta.label}`}
            style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
            className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold shadow-lg transition-transform duration-200 ${meta.chip} ${
              isSelected ? 'z-10 scale-125 ring-2 ring-bone' : 'hover:scale-110'
            } ${isExcluded ? 'opacity-35' : ''}`}
          >
            {(unit.label || '').slice(0, 4)}
          </button>
        )
      })}
    </div>
  )
}
