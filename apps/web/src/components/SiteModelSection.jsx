import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FloorPlanInteractive from './FloorPlanInteractive'
import UnitDetailCard from './UnitDetailCard'
import UnitList from './UnitList'
import { formatUnitLabel, getBuildings, getUnits } from '../lib/units'
import { unitStatusMeta } from '../lib/unitStatus'
import { getSiteModel, hasSiteModel, reconcileSite, toViewerEntries } from '../lib/siteModel'
import { hasWebGL } from '../lib/webgl'
import { scrollToElement } from '../lib/scrollToElement'

const ModelViewer = lazy(() => import('./floorplan/ModelViewer'))

// Matches FloorPlanSection's own PLAN_HEIGHT, and for the same reason: the
// detail panel now takes a column out of this row from `lg` up, so the model
// no longer has the full width to be wide and shallow in. Holding the old
// full-bleed `100dvh-9rem` there would leave a site plan in a tall narrow
// slot — the worst shape to orbit one in.
const PLAN_HEIGHT = 'h-[340px] sm:h-[420px] md:h-[500px] lg:h-[calc(100dvh-7rem)]'

// A cap rather than a height — see the note on FloorPlanSection's PANEL_MAX.
const PANEL_MAX = 'lg:h-[calc(100dvh-7rem)]'

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
 *
 * Selection is held as two labels rather than as viewer indexes. Which
 * building and which unit is the state a URL, a unit list, a 2D pin plan and
 * a 3D mesh can all agree on; a mesh index is meaningful only to the model
 * that produced it, and every one of those other surfaces has to be able to
 * drive the selection too.
 */
export default function SiteModelSection({ property }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [focusedLabel, setFocusedLabel] = useState(null)
  const [selectedLabel, setSelectedLabel] = useState(null)
  const [isolate, setIsolate] = useState(false)
  const [viewerFailed, setViewerFailed] = useState(false)
  // Bumped on the way back out to the site, to re-frame the whole plot.
  const [resetToken, setResetToken] = useState(0)
  const rootRef = useRef(null)
  // A deep link should bring the plan to the visitor; a click inside it
  // should not move the page under their hands. Only the first sync scrolls.
  const hasScrolled = useRef(false)
  const cancelScroll = useRef(null)

  // Unmount-only, so an in-flight arrival scroll cannot outlive this section.
  // Without it the correction loop kept running for up to five seconds against
  // a detached node and dragged the *next* route's scroll position around.
  //
  // Resetting the guard here rather than leaving it set is what keeps this
  // correct under StrictMode, which mounts, tears down and remounts: with the
  // flag left true the remount would skip the scroll and a deep link would
  // silently stop working in development.
  useEffect(
    () => () => {
      cancelScroll.current?.()
      cancelScroll.current = null
      hasScrolled.current = false
    },
    [],
  )

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

  /** Every building in the CMS, whether or not it has geometry.
   *
   *  The rail is built from the tagged set — an untagged building has
   *  nothing to fly to — but a deep link, the unit list and the 2D plan all
   *  have to reach one anyway, because its units are real and its details
   *  are complete. Only its camera move is missing. */
  const buildingFor = useCallback(
    (label) =>
      taggedBuildings.find((b) => norm(b.label) === norm(label)) ??
      (buildings.find((b) => norm(b.building) === norm(label))
        ? { label, building: buildings.find((b) => norm(b.building) === norm(label)), indexes: [] }
        : null),
    [taggedBuildings, buildings],
  )

  const focusedBuilding = useMemo(
    () => (focusedLabel ? buildingFor(focusedLabel) : null),
    [buildingFor, focusedLabel],
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

  /** Every unit on the plot, for the panel's empty state at site level.
   *
   *  Without this the panel opens on "0", because at site level there is no
   *  focused building and so no units to count — a giant zero beside a full
   *  plaza, which reads as a broken page rather than as nothing selected. The
   *  site-wide count is also the better answer to the question a visitor
   *  arrives with. */
  const allUnits = useMemo(() => buildings.flatMap((b) => getUnits(b)), [buildings])

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

  const selectedUnit = useMemo(
    () => (selectedLabel ? focusedUnits.find((u) => norm(u.label) === norm(selectedLabel)) ?? null : null),
    [focusedUnits, selectedLabel],
  )

  /** What the camera frames: the selected unit if it has geometry, otherwise
   *  the whole focused building, otherwise the site. A selected unit with no
   *  shape in the model leaves the camera on its building rather than
   *  jumping to nothing — the panel beside it still describes the unit. */
  const selection = useMemo(() => {
    const entry = selectedLabel ? unitEntryByLabel.get(norm(selectedLabel)) : null
    if (entry) return [entry.index]
    return focusedBuilding?.indexes ?? []
  }, [selectedLabel, unitEntryByLabel, focusedBuilding])

  // ── deep link ────────────────────────────────────────────────────────
  //
  // `?building=B-06&unit=605` is what the homepage unit cards link to, and
  // what a broker gets when they share the page with a unit open. The
  // building is carried explicitly because unit labels are only unique
  // within a building — two plazas both have a 101.
  //
  // A unit named without a building is still resolved, by searching every
  // building for it: links written before this existed, and anything typed by
  // hand, should land somewhere sensible rather than nowhere.
  useEffect(() => {
    const rawBuilding = searchParams.get('building')
    const rawUnit = searchParams.get('unit') ?? searchParams.get('units')?.split(',')[0]
    if (!rawBuilding && !rawUnit) return

    let building = rawBuilding ? buildings.find((b) => norm(b.building) === norm(rawBuilding)) : null
    let unit = null

    if (rawUnit) {
      const search = building ? [building] : buildings
      for (const candidate of search) {
        const match = getUnits(candidate).find((u) => norm(u.label) === norm(rawUnit))
        if (match) {
          building = candidate
          unit = match
          break
        }
      }
    }

    // An unknown building or unit is not an error — a stale shared link
    // should open the plan in its default state, not blank the section.
    if (!building) return
    setFocusedLabel((current) => (norm(current) === norm(building.building) ? current : building.building))
    setSelectedLabel((current) => (norm(current) === norm(unit?.label) ? current : (unit?.label ?? null)))

    if (!hasScrolled.current) {
      hasScrolled.current = true
      cancelScroll.current = scrollToElement(rootRef.current)
    }
  }, [searchParams, buildings])

  /** Deep link out. Writes the same two parameters the effect above reads,
   *  so every selection is shareable and the back button walks the plan. */
  const writeParams = useCallback(
    (buildingLabel, unitLabel) => {
      const params = new URLSearchParams(searchParams)
      params.delete('units')
      if (buildingLabel) params.set('building', buildingLabel)
      else params.delete('building')
      if (unitLabel) params.set('unit', unitLabel)
      else params.delete('unit')
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const modelUrl = siteModel?.url ?? null
  const isLocalhostUrl = modelUrl ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(modelUrl) : false
  const canShow3D = Boolean(modelUrl) && !isLocalhostUrl && !viewerFailed && hasWebGL()

  // Tier 2 for a site model: the focused building's own plan image, if it has
  // one. There is no site-wide pin plan to fall back to — the site model *is*
  // the site-level view — so without a building focused this is simply the
  // poster, and the unit list below carries the inventory either way.
  const planImage = focusedBuilding?.building?.planImage ?? null

  const openBuilding = (label) => {
    setFocusedLabel(label)
    setSelectedLabel(null)
    writeParams(label, null)
  }

  const selectUnit = (unit, buildingLabel = focusedLabel) => {
    setFocusedLabel(buildingLabel)
    setSelectedLabel(unit?.label ?? null)
    writeParams(buildingLabel, unit?.label ?? null)
  }

  const goSite = () => {
    setFocusedLabel(null)
    setSelectedLabel(null)
    writeParams(null, null)
    setResetToken((n) => n + 1)
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
    if (insideFocused && e.kind === 'unit') selectUnit(e.unit)
    else openBuilding(e.building.building)
  }

  /** The unit list and the 2D pin plan address units by their array index
   *  within the focused building, which is the one selection space that has
   *  nothing to do with the model. */
  const selectByUnitIndex = (index) => {
    const unit = focusedUnits.find((u) => u.index === index)
    if (unit) selectUnit(unit)
  }

  // Identical query contract to FloorPlanSection's enquire(), so lead
  // attribution needs no changes for a property on a site model.
  const enquire = (unit) =>
    navigate(
      `/contact?${new URLSearchParams({
        unit: unit.label ?? '',
        building: focusedBuilding?.label ?? '',
        status: unit.status ?? '',
        property: property?.id ?? '',
        from: `${window.location.pathname}?${new URLSearchParams({
          building: focusedBuilding?.label ?? '',
          unit: unit.label ?? '',
        })}`,
      })}`,
    )

  if (!hasSiteModel(property)) return null

  return (
    <div ref={rootRef} className="flex scroll-mt-24 flex-col gap-4">
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
          const isActive = focusedBuilding?.label === b.label
          return (
            <Chip key={b.label} active={isActive} onClick={() => openBuilding(b.label)}>
              <span className="inline-flex items-center gap-2">
                {b.label}
                {/* A separate pill, not a dimmed suffix. Run together with the
                    name — "Building 1" followed by "0/1" — the eye reads
                    "Building 10/1", and the rail became a column of building
                    numbers nobody could trust. Its own ground breaks the
                    number away from the name for good. */}
                {units.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-px font-body text-[10px] font-bold tabular-nums ${
                      isActive ? 'bg-void/20 text-void' : 'bg-content/10 text-content/60'
                    }`}
                  >
                    {/* The slash form is for the eye only. Read aloud it is
                        "Building 1, 0 slash 1" — or worse, run together with
                        the name as "Building 10 slash 1" — so the spoken
                        version is spelled out instead. */}
                    <span aria-hidden>
                      {free}/{units.length}
                    </span>
                    <span className="sr-only">
                      , {free} of {units.length} units available
                    </span>
                  </span>
                )}
              </span>
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
            const meta = unitStatusMeta(u.status)
            // Every unit is selectable, whether or not it has a shape in the
            // model and whatever its status: a let unit has a tenant,
            // photographs and a size, which is exactly what a prospect
            // deciding on the unit next door wants to see. One without
            // geometry simply leaves the camera on the building.
            return (
              <Chip
                key={u.index}
                active={selectedUnit?.index === u.index}
                onClick={() => selectUnit(u)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-1.5 rounded-full ${meta.swatch}`} />
                  {formatUnitLabel(u.label) || '—'}
                </span>
              </Chip>
            )
          })}
        </div>
      )}

      {/* ── the plan and its detail panel ───────────────────────── */}
      {/* Side by side from lg up, matching the per-building plan. The panel
          used to float over the canvas, which meant the answer to "what did
          I just click" sat on top of the thing being clicked — and on a
          phone it covered a third of the model. Its own column costs the
          model some width and buys back the whole surface. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(19rem,1fr)] lg:items-start">
        <div className="relative min-w-0">
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
          ) : planImage ? (
            /* Tier 2 — the focused building's pin plan. */
            <FloorPlanInteractive
              image={planImage}
              units={focusedUnits}
              selection={selectedUnit ? [selectedUnit.index] : []}
              onSelect={selectByUnitIndex}
            />
          ) : (
            /* Tier 3 — no model and no plan image. The panel beside this and
               the list below still carry every unit in full, which is the
               whole point of holding selection as labels. */
            <ViewerSkeleton poster={siteModel?.poster} />
          )}
        </div>

        <aside className="lg:sticky lg:top-24">
          <UnitDetailCard
            unit={selectedUnit}
            units={focusedBuilding ? focusedUnits : allUnits}
            onEnquire={enquire}
            maxHeight={canShow3D ? PANEL_MAX : ''}
            emptyHint={
              focusedBuilding
                ? ''
                : 'Select a building on the plan — or from the row above — to see its units, their sizes and who is in them.'
            }
          />
        </aside>
      </div>

      {/* Tier 3 / 4 — every unit of the focused building as indexable,
          focusable text.

          This was previously left out because it duplicated the unit rail
          above. It is back because the rail is a row of labels and this is
          the inventory: it carries status and size per unit, it is the only
          crawler and no-JS path to any of it, and it is the only way to
          reach a unit that has no shape in the model. The duplication is
          real and is the price of those four things — the same price
          FloorPlanSection has always paid. */}
      {focusedBuilding && (
        <UnitList
          key={focusedBuilding.label}
          units={focusedUnits}
          selection={selectedUnit ? [selectedUnit.index] : []}
          onSelect={selectByUnitIndex}
          defaultOpen={!canShow3D}
        />
      )}
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
