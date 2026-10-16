import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import FloorPlanInteractive from './FloorPlanInteractive'
import UnitComparePanel from './UnitComparePanel'
import UnitDetailCard from './UnitDetailCard'
import UnitList from './UnitList'
import ViewerLaunch from './floorplan/ViewerLaunch'
import { UNIT_STATUSES } from '../lib/unitStatus'
import { bearingLabel, countByStatus, findUnitByLabel, getModel, getUnits, unitPath } from '../lib/units'
import { hasWebGL } from '../lib/webgl'

// Lazy so three/fiber/drei never enter the main bundle. A visitor who does not
// open the 3D view pays nothing for it. The loader is kept by name so the
// launch button can start it on hover; the module cache makes the second call
// free.
const loadViewer = () => import('./floorplan/ModelViewer')
const ModelViewer = lazy(loadViewer)

// One source of truth for the height of the plan column, so the 3D viewer, its
// poster, its skeleton and the detail panel beside it all agree. If these drift
// the two columns stop aligning and the whole layout looks accidental.
//
// lg is deliberately *shorter* than md rather than taller: md is still the
// full-width stacked layout, while lg is the moment the panel takes a third of
// the row away. Holding the md height there would leave the model in a tall
// narrow slot, which is the worst shape to orbit a wide site plan in. The
// height climbs again as the column gets its width back.
const PLAN_HEIGHT = 'h-[340px] sm:h-[420px] md:h-[500px] lg:h-[calc(100dvh-7rem)]'

// A cap, not a height. Forcing the panel to match the plan looks composed on a
// fully filled unit and hollow on a sparse one — and unit records here are
// routinely sparse, so the hollow case is the common one. Capped instead, the
// panel sizes to what the unit actually has, the two columns still align along
// the top edge, and only an unusually wordy unit ever scrolls.
const PANEL_MAX = 'lg:h-[calc(100dvh-7rem)]'

// Enough to be useful, few enough that each column stays wide enough to read.
// Past this the table is a horizontal scroll of narrow slivers, which is worse
// than being told to drop one first.
const COMPARE_MAX = 4

const sameSelection = (a, b) => a.length === b.length && a.every((value, i) => value === b[i])

/**
 * Decides which of four tiers a visitor gets and owns the selection shared
 * between them. Tiers degrade presentation only — every one of them reaches
 * complete unit information:
 *
 *   1. 3D viewer      — WebGL available, model uploaded, visitor activates it
 *   2. 2D pin plan    — no WebGL, no model, or the viewer failed
 *   3. Unit list      — no plan image either
 *   4. Server-rendered list — no JavaScript, or a crawler
 *
 * The unit list is always in the DOM, which is what makes tier 4 real rather
 * than aspirational.
 */
export default function FloorPlanSection({ building, propertyId }) {
  // The route's own slug: this section only ever renders on /properties/:slug.
  const { slug: propertySlug } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Unit indexes in the order they were picked. The *last* one is the primary
  // selection — what the detail panel describes and what the camera flies to —
  // so adding a unit to a comparison also shows you the unit you just added
  // rather than leaving the panel on the first one you picked.
  const [selection, setSelection] = useState([])
  // Whether a plain tap adds to the selection or replaces it. A mode rather
  // than modifier-only, because a modifier key does not exist on the phones
  // and tablets brokers actually show sites on. Modifier-click still works and
  // needs no mode, for anyone on a desktop who already expects it.
  const [compareMode, setCompareMode] = useState(false)
  const [statusFilter, setStatusFilter] = useState(null)
  const [activated, setActivated] = useState(false)
  const [viewerFailed, setViewerFailed] = useState(false)
  // Unit index -> compass bearing, measured off the geometry once the model is
  // in. Absent until then, and absent entirely when the admin has not set an
  // orientation — aspect is a claim about the real world, so it is only made
  // when someone has said which way the model actually points.
  const [facings, setFacings] = useState(null)

  const units = useMemo(() => getUnits(building), [building])
  const model = getModel(building)
  const bindings = useMemo(() => model?.bindings ?? {}, [model])
  const counts = useMemo(() => countByStatus(units), [units])

  // Never try to load a localhost URL from a deployed origin — it will always
  // fail with a CORS/ERR_FAILED error and can crash the WebGL context.
  const modelUrl = model?.url ?? null
  const isLocalhostUrl = modelUrl ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(modelUrl) : false
  const canShow3D = Boolean(modelUrl) && !isLocalhostUrl && !viewerFailed
  const poster = model?.poster || building?.planImage || null

  // Deep link in. An unknown unit is not an error — the viewer simply opens in
  // its default state, which is what a stale shared link should do. `unit` is
  // the original single-unit parameter and is still read, so links shared
  // before comparison existed keep working.
  //
  // The equality guard is load-bearing: `select` below writes these same
  // parameters, so without it every write would feed back in here as a fresh
  // array and re-render on a loop.
  useEffect(() => {
    const raw = searchParams.get('units') ?? searchParams.get('unit')
    if (!raw) return
    const next = raw
      .split(',')
      .map((label) => findUnitByLabel(units, label)?.index)
      .filter((index) => index != null)
      .slice(0, COMPARE_MAX)
    setSelection((current) => (sameSelection(current, next) ? current : next))
  }, [searchParams, units])

  // Deep link out, so a broker can send a colleague straight to one unit — or
  // to the exact comparison they were just looking at.
  const applySelection = useCallback(
    (next) => {
      setSelection(next)
      const labels = next.map((index) => units.find((unit) => unit.index === index)?.label).filter(Boolean)
      const params = new URLSearchParams(searchParams)
      params.delete('unit')
      params.delete('units')
      // One unit keeps writing the singular parameter, so the common case
      // still produces the short link people were already sharing.
      if (labels.length === 1) params.set('unit', labels[0])
      else if (labels.length > 1) params.set('units', labels.join(','))
      setSearchParams(params, { replace: true })
    },
    [units, searchParams, setSearchParams],
  )

  const select = useCallback(
    (index, additive = false) => {
      if (!(additive || compareMode)) {
        applySelection([index])
        return
      }
      // Additive taps toggle, so the same gesture that adds a unit to the
      // comparison takes it back out — there is no separate "deselect".
      if (selection.includes(index)) {
        applySelection(selection.filter((value) => value !== index))
        return
      }
      if (selection.length >= COMPARE_MAX) return
      applySelection([...selection, index])
    },
    [selection, compareMode, applySelection],
  )

  const clearSelection = useCallback(() => applySelection([]), [applySelection])

  const activate = useCallback(() => {
    if (!hasWebGL()) {
      setViewerFailed(true)
      return
    }
    setActivated(true)
  }, [])

  // No observer mounting the viewer as it scrolls into reach any more: the
  // model waits for the visitor to press "View 3D model". See ViewerLaunch.

  // The most recent pick, not the first: see the note on `selection`.
  const primaryIndex = selection.length ? selection[selection.length - 1] : null
  const selectedUnit = units.find((unit) => unit.index === primaryIndex) ?? null
  // Kept in selection order rather than list order, so the columns of the
  // comparison sit in the order the visitor built them.
  const comparedUnits = useMemo(
    () => selection.map((index) => units.find((unit) => unit.index === index)).filter(Boolean),
    [selection, units],
  )

  // Only published when the admin has set an orientation — without one the
  // bearings are measured against an arbitrary axis and would name a direction
  // nobody has verified. A broker repeats these to a client.
  const hasOrientation = Number.isFinite(model?.orientation)
  const aspectOf = (index) =>
    hasOrientation && facings && index != null ? bearingLabel(facings.get(index)) : null

  // Status travels with the enquiry so sales can tell a genuine enquiry from
  // one made against data that has since changed. `property` carries the
  // property's row id — the API requires propertyId and unitLabel together to
  // attribute a lead to a unit, and rejects a half-specified pair. Without it
  // the contact page has no way to attribute the enquiry to a unit at all.
  const enquire = (unit) =>
    navigate(
      `/contact?${new URLSearchParams({
        unit: unit.label ?? '',
        building: building?.building ?? '',
        status: unit.status ?? '',
        property: propertyId ?? '',
        // Carried explicitly: this is a client-side route change, so
        // document.referrer stays empty and the contact page has no other way
        // to know which property page the enquiry came from.
        from: `${window.location.pathname}?unit=${encodeURIComponent(unit.label ?? '')}`,
      })}`,
    )

  if (!units.length && !building?.planImage && !model?.url) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Plan and detail sit side by side from lg up. Clicking a unit and then
          having to look away from the model to read what you clicked is the
          single worst moment in the old stacked layout — on a tall viewer the
          answer was below the fold entirely. Two columns keep the question and
          the answer in one glance. Below lg there is no room for that, so the
          panel falls back underneath, which is where it always was. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)] lg:items-start">
        <div className="relative min-w-0">
          <div className="absolute right-4 top-4 z-20 flex max-w-[calc(100%-6.5rem)] flex-nowrap justify-end gap-2 overflow-x-auto sm:right-5 sm:top-5">
            {UNIT_STATUSES.map((status) => {
              const count = counts[status.value] ?? 0
              const isActive = statusFilter === status.value
              return (
                <button
                  key={status.value}
                  type="button"
                  disabled={!count}
                  aria-pressed={isActive}
                  onClick={() => setStatusFilter(isActive ? null : status.value)}
                  className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors duration-200 disabled:opacity-25 ${
                    isActive ? 'border-white/35 bg-white/16 shadow-[0_12px_28px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl' : 'border-white/12 bg-black/48 shadow-[0_12px_28px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl hover:border-white/28 hover:bg-black/62'
                  }`}
                >
                  <span aria-hidden className={`size-2.5 rounded-sm ${status.swatch}`} />
                  <span className="font-body text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">{status.label}</span>
                  <span className="font-body text-[10px] text-white/40">{count}</span>
                </button>
              )
            })}
            {statusFilter && (
              <button type="button" onClick={() => setStatusFilter(null)} aria-label="Clear status filter" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/12 bg-black/48 text-sm text-white/60 backdrop-blur-xl hover:border-white/28 hover:bg-black/62 hover:text-white">×</button>
            )}
          </div>
          {/* Tier 1 — the interactive model, mounted only once the visitor
              presses for it, so WebGL is never spun up for one who doesn't.
              It opens in 3D rather than the viewer's usual plan view: the
              button said "3D model", and the plan is one tap back. */}
          {canShow3D && activated && (
            <Suspense fallback={<ViewerSkeleton poster={poster} />}>
              <ModelViewer
                url={modelUrl}
                units={units}
                bindings={bindings}
                selection={selection}
                onSelect={select}
                statusFilter={statusFilter}
                orientation={Number.isFinite(model?.orientation) ? model.orientation : null}
                onFacings={setFacings}
                onError={() => setViewerFailed(true)}
                defaultMode="3d"
                height={PLAN_HEIGHT}
              />
            </Suspense>
          )}

          {canShow3D && !activated && (
            <ViewerLaunch poster={poster} height={PLAN_HEIGHT} onLaunch={activate} onPrefetch={loadViewer} />
          )}

          {/* Tier 2 — the original pin plan, retained rather than replaced. */}
          {!canShow3D && building?.planImage && (
            <FloorPlanInteractive
              image={building.planImage}
              units={units}
              selection={selection}
              onSelect={select}
              statusFilter={statusFilter}
            />
          )}
        </div>

        {/* Sticky because the 2D plan is image-height driven and can run far
            taller than the viewport; the panel then stays with the pins you
            are clicking instead of scrolling off the top. The cap is only
            applied against the fixed-height plan tiers — capping against a
            plan image of unknown height would crop the panel for no reason. */}
        <aside className="lg:sticky lg:top-24">
          <UnitDetailCard
            unit={selectedUnit}
            units={units}
            aspect={aspectOf(primaryIndex)}
            onEnquire={enquire}
            maxHeight={canShow3D ? PANEL_MAX : ''}
            detailsHref={selectedUnit && propertySlug ? unitPath(propertySlug, building?.building, selectedUnit.label) : null}
          />
        </aside>
      </div>

      {/* Below the plan, not inside the detail column: see the note in
          UnitComparePanel. The plan stays on screen above it, so the model
          keeps showing *where* the units being compared are. */}
      <UnitComparePanel
        units={comparedUnits}
        aspectOf={aspectOf}
        onRemove={(index) => select(index, true)}
        onClear={clearSelection}
        onEnquire={enquire}
      />

      {/* Tier 3 / 4 — always rendered. SEO surface, keyboard path, fallback.
          Collapsed by default once the 3D view is live, since tapping a unit
          on the model is then the intended way in; expanded when it is not,
          because it is the only way in. */}
      <UnitList
        // Keyed on the tier alone, not on activation, so pressing "View 3D
        // model" does not reset a list the visitor has already opened.
        key={canShow3D ? 'plan' : 'flat'}
        units={units}
        selection={selection}
        onSelect={select}
        statusFilter={statusFilter}
        defaultOpen={!canShow3D}
      />
    </div>
  )
}

function ViewerSkeleton({ poster }) {
  // surface-alt, not surface: the viewport is a recessed well the plan sits in,
  // and on the light ground a white skeleton is indistinguishable from the
  // section around it — the panel would appear not to exist until the model
  // lands. Matches the ground ModelViewer's own container paints.
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface-alt ${PLAN_HEIGHT}`}>
      {poster && <img src={poster} alt="" className="h-full w-full object-cover opacity-25" />}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* "3D model", because the viewer now opens in 3D — it only loads
            once someone has pressed a button that says so. */}
        <span className="eyebrow text-content/70">Loading 3D model…</span>
      </div>
    </div>
  )
}
