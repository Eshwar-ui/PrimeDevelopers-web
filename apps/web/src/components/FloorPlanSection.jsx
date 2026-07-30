import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FloorPlanInteractive from './FloorPlanInteractive'
import UnitDetailCard from './UnitDetailCard'
import UnitList from './UnitList'
import { UNIT_STATUSES } from '../lib/unitStatus'
import { countByStatus, findUnitByLabel, getModel, getUnits } from '../lib/units'
import { hasWebGL } from '../lib/webgl'

// Lazy so three/fiber/drei never enter the main bundle. A visitor who does not
// open the 3D view pays nothing for it.
const ModelViewer = lazy(() => import('./floorplan/ModelViewer'))

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
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [activated, setActivated] = useState(false)
  const [viewerFailed, setViewerFailed] = useState(false)

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
  // its default state, which is what a stale shared link should do.
  useEffect(() => {
    const label = searchParams.get('unit')
    if (!label) return
    const unit = findUnitByLabel(units, label)
    if (unit) setSelectedIndex(unit.index)
  }, [searchParams, units])

  // Deep link out, so a broker can send a colleague straight to one unit.
  const select = useCallback(
    (index) => {
      setSelectedIndex(index)
      const label = units.find((unit) => unit.index === index)?.label
      if (!label) return
      const next = new URLSearchParams(searchParams)
      next.set('unit', label)
      setSearchParams(next, { replace: true })
    },
    [units, searchParams, setSearchParams],
  )

  const activate = () => {
    if (!hasWebGL()) {
      setViewerFailed(true)
      return
    }
    setActivated(true)
  }

  const selectedUnit = units.find((unit) => unit.index === selectedIndex) ?? null

  // Status travels with the enquiry so sales can tell a genuine enquiry from
  // one made against data that has since changed. `property` carries the
  // property's row id — needed to write a website_lead_unit_attributions row
  // (lead_id, property_id, unit_label, building_label), which is how unit
  // attribution is modelled on the shared production database (see
  // supabase/migrations/00000000000006_production_cms_setup.sql). Without it
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
      </div>

      {/* Tier 1 — 3D, behind an explicit activation so WebGL is never spun up
          for a visitor who is only scrolling past. */}
      {canShow3D && activated && (
        <Suspense fallback={<ViewerSkeleton poster={poster} />}>
          <ModelViewer
            url={modelUrl}
            units={units}
            bindings={bindings}
            selectedIndex={selectedIndex}
            onSelect={select}
            statusFilter={statusFilter}
            onError={() => setViewerFailed(true)}
          />
        </Suspense>
      )}

      {canShow3D && !activated && <ViewerPoster poster={poster} onActivate={activate} />}

      {/* Tier 2 — the original pin plan, retained rather than replaced. */}
      {!canShow3D && building?.planImage && (
        <FloorPlanInteractive
          image={building.planImage}
          units={units}
          selectedIndex={selectedIndex}
          onSelect={select}
          statusFilter={statusFilter}
        />
      )}

      <UnitDetailCard unit={selectedUnit} onEnquire={enquire} />

      {/* Tier 3 / 4 — always rendered. SEO surface, keyboard path, fallback.
          Collapsed by default once the 3D view is live, since tapping a unit
          on the model is then the intended way in; expanded when it is not,
          because it is the only way in. */}
      <UnitList
        // Remount when the tier changes so the collapsed/expanded default is
        // re-applied — activating the 3D view should fold the list away.
        key={canShow3D && activated ? '3d' : 'flat'}
        units={units}
        selectedIndex={selectedIndex}
        onSelect={select}
        statusFilter={statusFilter}
        defaultOpen={!(canShow3D && activated)}
      />
    </div>
  )
}

function ViewerPoster({ poster, onActivate }) {
  return (
    <div className="relative h-[420px] overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-void md:h-[560px]">
      {poster && <img src={poster} alt="" className="h-full w-full object-cover opacity-45" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <button
          type="button"
          onClick={onActivate}
          className="rounded-full bg-accent px-7 py-3 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-bone transition-colors duration-300 hover:bg-accent-soft"
        >
          Explore in 3D
        </button>
        <span className="font-body text-xs text-bone/45">Rotate the building and click any unit for details</span>
      </div>
    </div>
  )
}

function ViewerSkeleton({ poster }) {
  return (
    <div className="relative h-[420px] overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-void md:h-[560px]">
      {poster && <img src={poster} alt="" className="h-full w-full object-cover opacity-25" />}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="eyebrow text-bone/45">Loading 3D model…</span>
      </div>
    </div>
  )
}
