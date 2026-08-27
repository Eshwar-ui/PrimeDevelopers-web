import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UnitDetailCard from './UnitDetailCard'
import { getBuildings, getUnits } from '../lib/units'
import { unitStatusMeta } from '../lib/unitStatus'
import { getSiteModel, hasSiteModel, reconcileSite, toViewerEntries } from '../lib/siteModel'
import { hasWebGL } from '../lib/webgl'

const ModelViewer = lazy(() => import('./floorplan/ModelViewer'))

// Taller than the per-building plan, and full-bleed rather than sharing the
// row with a panel. A whole site is a wide, shallow thing — squeezed into two
// thirds of the row it reads as a strip of noise, and the buildings are too
// small to tell apart. The detail panel floats over it instead, which costs
// nothing: it is only ever open while a unit is selected, and by then the
// visitor is looking at that unit rather than the rest of the plot.
const PLAN_HEIGHT = 'h-[440px] sm:h-[560px] lg:h-[calc(100dvh-9rem)]'

const norm = (value) => String(value ?? '').trim().toLowerCase()

/**
 * The whole-site counterpart to FloorPlanSection.
 *
 * Two levels, not one. At site level the plot reads as a set of building
 * masses and a road; tapping a building — from the chip rail or the model
 * itself — flies the camera to it, drops the rest of the site back to
 * context, and only then breaks that building into its own units. That is
 * the order the question actually gets asked in: which building, then which
 * unit.
 */
export default function SiteModelSection({ property }) {
  const navigate = useNavigate()
  const [selection, setSelection] = useState([])
  const [focusedLabel, setFocusedLabel] = useState(null)
  const [isolate, setIsolate] = useState(false)
  const [viewerFailed, setViewerFailed] = useState(false)
  // Bumped on the way back out to the site, to re-frame the whole plot.
  const [resetToken, setResetToken] = useState(0)

  const buildings = useMemo(() => getBuildings(property), [property])
  const siteModel = getSiteModel(property)
  const meshNames = useMemo(() => siteModel?.meshNames ?? [], [siteModel])

  const report = useMemo(() => reconcileSite(meshNames, buildings, siteModel), [meshNames, buildings, siteModel])
  const entries = useMemo(() => toViewerEntries(report), [report])

  const entryByIndex = useMemo(() => {
    const map = new Map()
    for (const e of entries) if (!map.has(e.index)) map.set(e.index, e)
    return map
  }, [entries])

  /** Buildings that actually have geometry in the model — a building nobody
   *  has tagged yet has nothing to fly to, so it gets no chip.
   *
   *  `indexes` is every entry the building owns, shell and units alike, not
   *  just its shell. The viewer frames a multi-entry selection by unioning
   *  their boxes, so handing it the whole set is what makes the camera land
   *  on the building rather than on whichever single mesh happened to be
   *  tagged as its shell. */
  const taggedBuildings = useMemo(() => {
    const seen = new Map()
    for (const e of entries) {
      if (!e.building) continue
      const label = e.building.building
      if (!seen.has(label)) seen.set(label, { label, building: e.building, indexes: new Set() })
      seen.get(label).indexes.add(e.index)
    }
    // Sorted by label, not by the order meshes happen to appear in the
    // file — the rail is a directory, and a directory that reads
    // B-02, B-04, B-10, B-06 is one nobody can find anything in.
    return [...seen.values()]
      .map((b) => ({ ...b, indexes: [...b.indexes] }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  }, [entries])

  const focusedBuilding = useMemo(
    () => taggedBuildings.find((b) => b.label === focusedLabel) ?? null,
    [taggedBuildings, focusedLabel],
  )

  /** Every mesh belonging to the focused building — its shell and its units.
   *  Null at site level, which is what tells the viewer to show everything
   *  at equal weight. */
  const focusMeshes = useMemo(() => {
    if (!focusedBuilding) return null
    const names = new Set()
    for (const e of entries) {
      if (e.building && e.building.building === focusedBuilding.label) names.add(e.meshName)
      // Roads stay lit while drilled in — they are the reason a unit is
      // worth anything, and dimming them hides the frontage being sold.
      if (e.kind === 'road') names.add(e.meshName)
    }
    return names
  }, [entries, focusedBuilding])

  const focusedUnits = useMemo(
    () => (focusedBuilding ? getUnits(focusedBuilding.building) : []),
    [focusedBuilding],
  )

  /** Units of the focused building that are actually tagged in the model,
   *  keyed by label, so a chip can fly the camera to one. */
  const unitEntryByLabel = useMemo(() => {
    const map = new Map()
    if (!focusedBuilding) return map
    for (const e of entries) {
      if (e.kind !== 'unit') continue
      if (e.building.building !== focusedBuilding.label) continue
      map.set(norm(e.unit.label), e)
    }
    return map
  }, [entries, focusedBuilding])

  const modelUrl = siteModel?.url ?? null
  const isLocalhostUrl = modelUrl ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(modelUrl) : false
  const canShow3D = Boolean(modelUrl) && !isLocalhostUrl && !viewerFailed && hasWebGL()

  const openBuilding = (b) => {
    if (!b) return
    setFocusedLabel(b.label)
    // Every entry the building owns — the viewer unions their frames, which
    // is what lands the camera on the whole building.
    setSelection(b.indexes ?? [])
  }

  const buildingFor = (label) => taggedBuildings.find((b) => b.label === label) ?? null

  const goSite = () => {
    setFocusedLabel(null)
    setSelection([])
    setResetToken((n) => n + 1)
  }

  const openUnitEntry = (entry) => {
    setFocusedLabel(entry.building.building)
    setSelection([entry.index])
  }

  /** A tap on the model itself. At site level any shape belonging to a
   *  building opens that building; once inside one, a shape is its unit. */
  const onSelect = (index) => {
    const e = entryByIndex.get(index)
    if (!e || e.kind === 'road' || !e.building) return
    // A tap outside the building you are in takes you to that building, not
    // to one of its units — otherwise the camera jumps somewhere the
    // visitor has not asked to go and lands on a unit they cannot see.
    const insideFocused = focusedBuilding && e.building.building === focusedBuilding.label
    if (insideFocused && e.kind === 'unit') openUnitEntry(e)
    else openBuilding(buildingFor(e.building.building))
  }

  // Only ever a unit, and only when exactly one thing is selected — a
  // building selection is several entries at once, and has no unit to
  // describe.
  const primaryEntry = selection.length === 1 ? entryByIndex.get(selection[0]) : null
  const selectedUnit = primaryEntry?.kind === 'unit' ? primaryEntry.unit : null

  // Identical query contract to FloorPlanSection's enquire(), so lead
  // attribution needs no changes for a property on a site model.
  const enquire = (unit) =>
    navigate(
      `/contact?${new URLSearchParams({
        unit: unit.label ?? '',
        building: focusedBuilding?.label ?? '',
        status: unit.status ?? '',
        property: property?.id ?? '',
        from: `${window.location.pathname}?unit=${encodeURIComponent(unit.label ?? '')}`,
      })}`,
    )

  if (!hasSiteModel(property)) return null

  return (
    <div className="flex flex-col gap-4">
      {/* ── building rail ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-content/45">
          {property?.name}
        </span>
        <Chip active={!focusedBuilding} onClick={goSite} tone="accent">
          Site overview
        </Chip>
        {taggedBuildings.map((b) => {
          const units = getUnits(b.building)
          const free = units.filter((u) => u.status === 'available').length
          return (
            <Chip key={b.label} active={focusedBuilding?.label === b.label} onClick={() => openBuilding(b)}>
              {b.label}
              {units.length > 0 && <span className="ml-1.5 font-normal opacity-55">{free}/{units.length}</span>}
            </Chip>
          )
        })}
        {taggedBuildings.length > 1 && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 font-body text-[12px] text-content/55">
            <input type="checkbox" checked={isolate} onChange={(e) => setIsolate(e.target.checked)} className="accent-[var(--color-accent)]" />
            Hide other buildings
          </label>
        )}
      </div>

      {/* ── unit rail, only once inside a building ──────────────── */}
      {focusedBuilding && focusedUnits.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-content/45">Units</span>
          {focusedUnits.map((u) => {
            const entry = unitEntryByLabel.get(norm(u.label))
            const meta = unitStatusMeta(u.status)
            return (
              <Chip
                key={u.index}
                active={selectedUnit && norm(selectedUnit.label) === norm(u.label)}
                onClick={() => entry && openUnitEntry(entry)}
                // A unit with no shape in the model cannot be flown to. It
                // still appears — it is real, and the list below reaches it
                // — but it should not look tappable here.
                disabled={!entry}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-1.5 rounded-full ${meta.swatch}`} />
                  {u.label || '—'}
                </span>
              </Chip>
            )
          })}
        </div>
      )}

      {/* ── the plan, full width ────────────────────────────────── */}
      <div className="relative">
        {canShow3D ? (
          <Suspense fallback={<ViewerSkeleton poster={siteModel?.poster} />}>
            <ModelViewer
              url={modelUrl}
              siteEntries={entries}
              selection={selection}
              onSelect={onSelect}
              focusMeshes={focusMeshes}
              isolateFocus={isolate}
              // Building names across the site, unit numbers once inside one.
              labelKinds={focusedBuilding ? ['unit', 'road'] : ['building', 'road']}
              resetToken={resetToken}
              groundless
              orientation={Number.isFinite(siteModel?.orientation) ? siteModel.orientation : null}
              onError={() => setViewerFailed(true)}
              height={PLAN_HEIGHT}
            />
          </Suspense>
        ) : (
          <ViewerSkeleton poster={siteModel?.poster} />
        )}

        {/* Floating rather than a column of its own — see PLAN_HEIGHT. Kept
            below the viewer's own top-left controls so the two never sit on
            top of each other. */}
        {selectedUnit && (
          <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-[min(20rem,calc(100%-2rem))] sm:top-20 sm:bottom-auto">
            <UnitDetailCard unit={selectedUnit} units={focusedUnits} onEnquire={enquire} />
          </div>
        )}
      </div>

      {/* No unit list below the plan. It duplicated the unit rail above,
          which already names every unit and its status and is reachable
          from the keyboard — two lists of the same ten units read as a
          mistake rather than a fallback.
          
          What that gives up is the crawler and no-JS path the
          per-building section still keeps (see FloorPlanSection's
          tier 3/4 note): on a property using a site model, the units
          now exist in the DOM only once a building is selected. Worth
          revisiting if these pages are ever meant to rank on unit
          availability. */}
    </div>
  )
}

function Chip({ active, onClick, disabled, tone, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-3.5 py-1.5 font-body text-[12px] font-semibold tracking-[0.01em] transition-colors duration-200 disabled:cursor-default disabled:opacity-35 ${
        active
          ? tone === 'accent'
            ? 'border-accent bg-accent text-white dark:text-void'
            : 'border-ember bg-ember text-void'
          : 'border-[var(--color-line)] bg-surface text-content/75 hover:border-content/35 hover:text-content'
      }`}
    >
      {children}
    </button>
  )
}

function ViewerSkeleton({ poster }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface-alt ${PLAN_HEIGHT}`}>
      {poster && <img src={poster} alt="" className="h-full w-full object-cover opacity-25" />}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="eyebrow text-content/70">Loading site model…</span>
      </div>
    </div>
  )
}
