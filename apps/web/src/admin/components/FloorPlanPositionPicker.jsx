import { unitStatusMeta } from '../../lib/unitStatus'

// Click-to-place: admin arms a unit via "Place on map" (passing its index as
// `placingIndex`), then clicks anywhere on the floor plan image to drop its
// pin there — no coordinate typing, no drawing tool.
export default function FloorPlanPositionPicker({ image, units, placingIndex, onClickImage }) {
  const handleClick = (e) => {
    if (placingIndex === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10
    onClickImage(x, y)
  }

  if (!image) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/15 text-center text-xs text-bone/40">
        Upload a floor plan image above to place units on it.
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      className={`relative overflow-hidden rounded-lg border border-white/15 ${
        placingIndex !== null ? 'cursor-crosshair ring-2 ring-ember' : ''
      }`}
    >
      <img src={image} alt="" className="block w-full select-none" draggable={false} />
      {units.map((u, i) => {
        if (u.x == null || u.y == null) return null
        const m = unitStatusMeta(u.status)
        const isPlacing = i === placingIndex
        return (
          <span
            key={i}
            style={{ left: `${u.x}%`, top: `${u.y}%` }}
            className={`pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-bold ${m.chip} ${
              isPlacing ? 'ring-2 ring-white' : ''
            }`}
          >
            {(u.label || '').slice(0, 3)}
          </span>
        )
      })}
      {placingIndex !== null && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-ember px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-void">
          Click the image to place unit {units[placingIndex]?.label || `#${placingIndex + 1}`}
        </div>
      )}
    </div>
  )
}
