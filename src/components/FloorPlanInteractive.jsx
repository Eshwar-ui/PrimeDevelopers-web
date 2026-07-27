import { useState } from 'react'
import { UNIT_STATUSES, unitStatusMeta } from '../lib/unitStatus'

const STATUS_COPY = {
  available: 'Available for lease. Contact our team for pricing and tour availability.',
  leased: 'Currently leased.',
  'coming-soon': 'Coming soon — leasing details available shortly.',
  sold: 'This unit has been sold.',
}

// The real floor plan image *is* the interactive surface — each unit with a
// placed position renders as a clickable pin directly on the image; nothing
// gets abstracted into a separate grid.
export default function FloorPlanInteractive({ image, units }) {
  const placed = units.filter((u) => u.x != null && u.y != null)
  const [selected, setSelected] = useState(() => (placed[0] ? units.indexOf(placed[0]) : null))
  const unit = selected != null ? units[selected] : null
  const meta = unit ? unitStatusMeta(unit.status) : null

  if (!image) return null

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {UNIT_STATUSES.map((s) => (
          <div key={s.value} className="flex items-center gap-2">
            <span aria-hidden className={`size-2.5 rounded-sm ${s.swatch}`} />
            <span className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-bone/55">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-[var(--color-line-inv)]">
        <img src={image} alt="Floor plan" className="block w-full select-none" />
        {placed.map((u) => {
          const i = units.indexOf(u)
          const m = unitStatusMeta(u.status)
          const isSelected = i === selected
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-pressed={isSelected}
              aria-label={`Unit ${u.label || i + 1} — ${unitStatusMeta(u.status).label}`}
              style={{ left: `${u.x}%`, top: `${u.y}%` }}
              className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold shadow-lg transition-transform duration-200 ${m.chip} ${
                isSelected ? 'z-10 scale-125 ring-2 ring-bone' : 'hover:scale-110'
              }`}
            >
              {(u.label || '').slice(0, 4)}
            </button>
          )
        })}
      </div>

      {unit ? (
        <div className="mt-6 rounded-2xl border border-[var(--color-line-inv)] bg-void p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.1em] ${meta.chip}`}>
              {meta.label}
            </span>
            <span className="font-display text-lg font-medium text-bone">{unit.label || 'Unit'}</span>
            {unit.size && <span className="font-body text-sm text-bone/45">{unit.size} sq ft</span>}
          </div>
          <p className="mt-3 font-body text-sm leading-relaxed text-bone/60">
            {unit.tenant
              ? unit.status === 'leased'
                ? `Leased to ${unit.tenant}.`
                : unit.tenant
              : STATUS_COPY[unit.status]}
          </p>
        </div>
      ) : (
        <p className="mt-6 font-body text-sm text-bone/40">Click a unit on the floor plan to see its details.</p>
      )}
    </div>
  )
}
