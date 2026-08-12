import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FloorPlanInteractive from './FloorPlanInteractive'
import UnitComparePanel from './UnitComparePanel'
import UnitDetailCard from './UnitDetailCard'
import UnitList from './UnitList'
import { UNIT_STATUSES } from '../lib/unitStatus'
import { bearingLabel, countByStatus, findUnitByLabel, getModel, getUnits } from '../lib/units'
import { hasWebGL } from '../lib/webgl'

// Lazy so three/fiber/drei never enter the main bundle. A visitor who does not
// open the 3D view pays nothing for it.
const ModelViewer = lazy(() => import('./floorplan/ModelViewer'))

// One source of truth for the height of the plan column, so the 3D viewer, its
// poster, its skeleton and the detail panel beside it all agree. If these drift
// the two columns stop aligning and the whole layout looks accidental.
//
// lg is deliberately *shorter* than md rather than taller: md is still the
// full-width stacked layout, while lg is the moment the panel takes a third of
// the row away. Holding the md height there would leave the model in a tall
// narrow slot, which is the worst shape to orbit a wide site plan in. The
// height climbs again as the column gets its width back.
const PLAN_HEIGHT = 'h-[420px] md:h-[520px] lg:h-[480px] xl:h-[560px] 2xl:h-[620px]'

// A cap, not a height. Forcing the panel to match the plan looks composed on a
// fully filled unit and hollow on a sparse one — and unit records here are
// routinely sparse, so the hollow case is the common one. Capped instead, the
// panel sizes to what the unit actually has, the two columns still align along
// the top edge, and only an unusually wordy unit ever scrolls.
const PANEL_MAX = 'lg:max-h-[480px] xl:max-h-[560px] 2xl:max-h-[620px]'

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
  const planRef = useRef(null)

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

  // The plan mounts itself when it scrolls into reach, rather than waiting for
  // a button press. Nothing about a leasing map is improved by making someone
  // click "show me the plan" before they can see the plan.
  //
  // Still deferred rather than mounted with the page: three/fiber/drei is
  // ~620KB gzipped in its own lazy chunk, and a visitor who never reaches this
  // section should not pay for it. Observing instead of pressing keeps that
  // property while removing the press — the chunk starts fetching a screen
  // early, so by the time the section is actually in view it is usually there.
  useEffect(() => {
    if (!canShow3D || activated) return
    const node = planRef.current
    if (!node) return
    // No IntersectionObserver means an old browser, and an old browser should
    // get the plan rather than a permanent skeleton.
    if (typeof IntersectionObserver === 'undefined') {
      activate()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        activate()
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [canShow3D, activated, activate])

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
    <div className="flex flex-col gap-8">
      {/* Legend doubles as the status filter — the highest-value interaction
          on a leasing map, and nearly free once materials are per-unit. */}
      <div className="flex flex-wrap gap-x-3 gap-y-2">
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
              className={`flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors duration-200 disabled:opacity-30 ${
                isActive ? 'border-accent bg-accent/15' : 'border-[var(--color-line-inv)] hover:border-bone/30'
              }`}
            >
              <span aria-hidden className={`size-2.5 rounded-sm ${status.swatch}`} />
              <span className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-bone/60">
                {status.label}
              </span>
              <span className="font-body text-[11px] text-bone/35">{count}</span>
            </button>
          )
        })}
        {statusFilter && (
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-accent-soft hover:text-bone"
          >
            Clear filter
          </button>
        )}

        {/* Sits with the legend rather than inside the 3D viewer because it
            governs every tier — the model, the pin plan and the unit list all
            honour it, and a control that only existed on the canvas would be
            missing exactly where WebGL is not. */}
        {units.length > 1 && (
          <button
            type="button"
            aria-pressed={compareMode}
            onClick={() => setCompareMode((value) => !value)}
            className={`ml-auto flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors duration-200 ${
              compareMode ? 'border-accent bg-accent/15' : 'border-[var(--color-line-inv)] hover:border-bone/30'
            }`}
          >
            <span className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-bone/60">
              Compare
            </span>
            {selection.length > 1 && (
              <span className="font-body text-[11px] text-accent-soft">{selection.length}</span>
            )}
          </button>
        )}
      </div>

      {/* Shown at the cap even with compare mode off, because modifier-click
          reaches the cap too and a tap that silently does nothing reads as a
          broken control rather than as a limit. */}
      {(compareMode || selection.length >= COMPARE_MAX) && (
        <p className="-mt-4 font-body text-xs text-bone/45">
          {selection.length >= COMPARE_MAX
            ? `Comparing ${COMPARE_MAX} units — remove one to add another.`
            : 'Tap units on the plan or in the list to compare them side by side.'}
        </p>
      )}

      {/* Plan and detail sit side by side from lg up. Clicking a unit and then
          having to look away from the model to read what you clicked is the
          single worst moment in the old stacked layout — on a tall viewer the
          answer was below the fold entirely. Two columns keep the question and
          the answer in one glance. Below lg there is no room for that, so the
          panel falls back underneath, which is where it always was. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div ref={planRef} className="min-w-0">
          {/* Tier 1 — the interactive plan, mounted once it scrolls into
              reach so WebGL is never spun up for a visitor who never gets
              here. See the observer above. */}
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
                height={PLAN_HEIGHT}
              />
            </Suspense>
          )}

          {canShow3D && !activated && <ViewerSkeleton poster={poster} />}

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
        // Keyed on the tier alone, not on activation. Activation is now
        // automatic, so keying on it would expand the list and then collapse
        // it under the visitor a moment later as the plan mounts.
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
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-void ${PLAN_HEIGHT}`}>
      {poster && <img src={poster} alt="" className="h-full w-full object-cover opacity-25" />}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* "Floor plan", not "3D model": this is what the visitor is about to
            see, and the plan is now what loads. */}
        <span className="eyebrow text-bone/45">Loading floor plan…</span>
      </div>
    </div>
  )
}
