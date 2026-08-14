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
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line)]">
      <img src={image} alt="Floor plan" className="block w-full select-none" />
      <div
        role="img"
        aria-label="North reference"
        title="North"
        className="pointer-events-none absolute bottom-4 right-4 z-20 flex size-14 items-center justify-center rounded-full border border-[var(--color-line-inv)] bg-void/85 shadow-[0_12px_30px_-18px_rgba(0,0,0,.8)] backdrop-blur"
      >
        <div className="relative size-full">
          <span className="absolute left-1/2 top-1.5 -translate-x-1/2 font-body text-[9px] font-bold tracking-[0.12em] text-accent-soft">N</span>
          <span className="absolute left-1/2 top-[15px] h-3.5 w-px -translate-x-1/2 bg-accent-soft" />
          <span className="absolute left-1/2 top-[13px] size-1.5 -translate-x-1/2 rotate-45 border-l border-t border-accent-soft" />
          <span className="absolute bottom-[12px] left-1/2 h-3 w-px -translate-x-1/2 bg-bone/25" />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-[var(--color-line-inv)] bg-void/75 px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.1em] text-bone/65 backdrop-blur sm:block">
        Select a unit to view details
      </div>
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
            className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold shadow-lg transition-transform duration-200 ${meta.chip} ${
              isSelected ? 'z-10 scale-125 ring-2 ring-accent' : 'hover:scale-110'
            } ${isExcluded ? 'opacity-35' : ''}`}
          >
            {(unit.label || '').slice(0, 4)}
          </button>
        )
      })}
    </div>
  )
}
