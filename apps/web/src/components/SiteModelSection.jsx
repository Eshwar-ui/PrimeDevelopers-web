import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import CustomSelect from './CustomSelect'
import ErrorBoundary from './ErrorBoundary'
import FloorPlanInteractive from './FloorPlanInteractive'
import UnitDetailCard from './UnitDetailCard'
import UnitList from './UnitList'
import ViewerFallback, { ViewerNotice } from './floorplan/ViewerFallback'
import ViewerLaunch from './floorplan/ViewerLaunch'
import { loadViewer, useViewerState } from './floorplan/useViewerState'
import { bearingLabel, formatUnitLabel, getBuildings, getUnits, unitLabelParts, unitPath } from '../lib/units'
import { UNIT_STATUSES, unitStatusMeta } from '../lib/unitStatus'
import { getSiteModel, hasSiteModel, reconcileSite, toViewerEntries } from '../lib/siteModel'
import { sized } from '../lib/images'
import { scrollToElement } from '../lib/scrollToElement'

// From `lg` up the plan and its panel are one row exactly as tall as the
// screen under the two bars pinned to the top — the site header and the
// section nav, 141px between them — so the whole picker (filter, building,
// unit, model, details) is in view at once with nothing to scroll past. The
// floor keeps it usable on a short window. Below `lg` the plan is a fixed
// height, tall enough that the picker over its top leaves room for the model.
const PLAN_HEIGHT = 'h-[440px] sm:h-[460px] md:h-[500px] lg:h-[max(30rem,calc(100dvh-9rem))]'

// Where the picker sits over the plan: on one line with the viewer's own 2D/3D
// button, which owns the top-left corner. That button is a bare icon on a
// phone and carries its label from `sm`, so the offset follows it.
const TOOLBAR_IN_VIEWER = 'absolute left-[4.25rem] right-4 top-4 z-30 sm:left-[6.5rem]'
// Over the launch poster or the 2D plan there is no such button.
const TOOLBAR_OVER_PLAN = 'absolute inset-x-4 top-4 z-30'

// Sentinels for "nothing chosen" in the pickers. A building label could never
// be either of these.
const SITE = '__site'
const ALL = '__all'

// A cap rather than a height — see the note on FloorPlanSection's PANEL_MAX.
const PANEL_MAX = 'lg:max-h-[max(30rem,calc(100dvh-9rem))]'

const norm = (value) => String(value ?? '').trim().toLowerCase()

// A closed picker has a third of a phone's width, so its label says less there
// and the whole of it from `sm` up. The menu always has the full text.
const shortOnPhone = (short, full) => (
  <>
    <span className="sm:hidden">{short}</span>
    <span className="hidden sm:inline">{full}</span>
  </>
)

const statusOf = (unit) => unit.status || 'available'

/** Units per status, in suites rather than rows. */
const tally = (list) => {
  const counts = {}
  for (const u of list) {
    const key = statusOf(u)
    counts[key] = (counts[key] ?? 0) + Math.max(1, unitLabelParts(u.label).length)
  }
  return counts
}

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
  // One status at a time, or null for all. Mutes the other units in the
  // model rather than hiding them, as the per-building plan's filter does.
  const [statusFilter, setStatusFilter] = useState(null)
  // Which way each unit looks out, as the viewer measures it from the model.
  const [facings, setFacings] = useState(null)
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

  /** Every shape that belongs to a building — shells and units — as the set
   *  the camera rests on. Roads and ground are left out on purpose: they are
   *  most of the model by area and none of what the visitor came to see. */
  const homeIndexes = useMemo(() => taggedBuildings.flatMap((b) => b.indexes), [taggedBuildings])

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

  /** Site-wide count per status, for the filter row.
   *
   *  Counted in suites, not rows: "101+102+103" is one row but three units,
   *  and counted as rows the filter disagreed with the headline totals the
   *  panel and hero show (46 sold against 63 reserved on Centro Plaza). */
  const statusCounts = useMemo(() => tally(allUnits), [allUnits])
  const focusedCounts = useMemo(() => tally(focusedUnits), [focusedUnits])
  const filterOptions = UNIT_STATUSES.filter((s) => statusCounts[s.value] > 0)
  const filterMeta = unitStatusMeta(statusFilter ?? 'available')

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

  /** The unit rail under the filter. The open unit stays in it whatever its
   *  status, so filtering never takes away the chip for what is on screen. */
  const railUnits = statusFilter
    ? focusedUnits.filter((u) => statusOf(u) === statusFilter || u.index === selectedUnit?.index)
    : focusedUnits

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
  // The admin's turn that puts true north at the top. Without it nothing here
  // knows which way a unit faces, and says nothing rather than guess.
  const orientation = Number.isFinite(siteModel?.orientation) ? siteModel.orientation : null
  const isLocalhostUrl = modelUrl ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(modelUrl) : false
  // The model waits for "View 3D model" rather than mounting with the page.
  // Selection is held as labels, not mesh indexes, so everything chosen
  // before the press — from the rails, the panel or a deep link — is simply
  // what the camera frames once it arrives.
  //
  // WebGL is checked on that press, not here. This line runs on every render,
  // and the probe it used to make created a fresh context each time.
  const viewer = useViewerState(modelUrl)
  const { Viewer } = viewer
  const canShow3D = Boolean(modelUrl) && !isLocalhostUrl && !viewer.failure
  const unavailableReason = viewer.failure?.reason ?? (isLocalhostUrl ? 'unavailable' : null)

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

  // ── pickers ───────────────────────────────────────────────────────────
  //
  // Each option has a full label for the menu and a short `triggerLabel` for
  // the closed control, which has a third of a phone's width to itself.
  const statusOptions = [
    { value: ALL, label: 'All units', triggerLabel: shortOnPhone('All', 'All units') },
    ...filterOptions.map((s) => ({
      value: s.value,
      triggerLabel: s.label,
      label: (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className={`size-2 rounded-full ${s.swatch}`} />
          {s.label}
          <span className="tabular-nums text-bone/50">{statusCounts[s.value]}</span>
        </span>
      ),
    })),
  ]

  // A building deep-linked to but with no geometry still has to read as the
  // current one, so it joins the list rather than leaving the control blank.
  const pickable =
    focusedBuilding && !taggedBuildings.some((b) => b.label === focusedBuilding.label)
      ? [...taggedBuildings, focusedBuilding]
      : taggedBuildings
  const buildingOptions = [
    { value: SITE, label: 'Site overview', triggerLabel: shortOnPhone('Site', 'Site overview') },
    ...pickable.map((b) => {
      const units = getUnits(b.building)
      // Follows the filter: available by default, otherwise the status being
      // shown, so the menu says where the matches are.
      const matching = units.filter((u) => statusOf(u) === filterMeta.value).length
      return {
        value: b.label,
        triggerLabel: shortOnPhone(b.label.replace(/^Building\s+/i, 'Bldg '), b.label),
        label: (
          <span className="inline-flex items-center gap-2">
            {b.label}
            {units.length > 0 && (
              <span className="tabular-nums text-bone/50">
                <span aria-hidden>
                  {matching}/{units.length}
                </span>
                <span className="sr-only">
                  , {matching} of {units.length} units {filterMeta.label.toLowerCase()}
                </span>
              </span>
            )}
          </span>
        ),
      }
    }),
  ]

  const unitOptions = [
    { value: ALL, label: 'All units', triggerLabel: shortOnPhone('All', 'All units') },
    ...railUnits.map((u) => {
      const meta = unitStatusMeta(u.status)
      return {
        value: u.label,
        triggerLabel: formatUnitLabel(u.label) || '—',
        label: (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${meta.swatch}`} />
            {formatUnitLabel(u.label) || '—'}
          </span>
        ),
      }
    }),
  ]
  const noUnits = focusedBuilding && railUnits.length === 0

  // The panel's facts about the open unit that only the model knows.
  const selectedEntry = selectedUnit ? unitEntryByLabel.get(norm(selectedUnit.label)) : null
  const aspect = orientation != null && selectedEntry ? bearingLabel(facings?.get(selectedEntry.index)) : null
  const counts = focusedBuilding ? focusedCounts : statusCounts
  const breakdown = UNIT_STATUSES.filter((s) => counts[s.value] > 0).map((s) => ({ ...s, count: counts[s.value] }))

  // Content-sized, shrinking only when the bar runs out of room: equal thirds
  // gave "All" as much width as "Building 10" and cut the long one.
  const toolbar = (
    <div role="group" aria-label="Choose what the plan shows" className="flex items-center gap-1.5 sm:gap-2">
      {filterOptions.length > 1 && (
        <div className="min-w-0 shrink">
          <CustomSelect
            variant="overlay"
            label="Filter units by status"
            value={statusFilter ?? ALL}
            options={statusOptions}
            onChange={(value) => setStatusFilter(value === ALL ? null : value)}
          />
        </div>
      )}
      <div className="min-w-0 shrink">
        <CustomSelect
          variant="overlay"
          label="Building"
          value={focusedBuilding?.label ?? SITE}
          options={buildingOptions}
          onChange={(value) => (value === SITE ? goSite() : openBuilding(value))}
        />
      </div>
      <div className="min-w-0 shrink">
        <CustomSelect
          variant="overlay"
          align="right"
          label="Unit"
          disabled={!focusedBuilding || noUnits}
          value={selectedUnit?.label ?? (focusedBuilding && !noUnits ? ALL : '')}
          // Short, because it has a third of the bar. Idle either because no
          // building is open yet, or because the filter has left the open one
          // with nothing to pick.
          placeholder={!focusedBuilding ? 'Unit' : 'No units'}
          options={unitOptions}
          onChange={(value) => selectUnit(value === ALL ? null : (focusedUnits.find((u) => u.label === value) ?? null))}
        />
      </div>
      {focusedBuilding && taggedBuildings.length > 1 && (
        // Not on a phone: it is a refinement, and the one line the bar has there
        // is worth more to the labels.
        <button
          type="button"
          aria-pressed={isolate}
          aria-label="Hide other buildings"
          title="Hide other buildings"
          onClick={() => setIsolate((v) => !v)}
          className={`grid size-11 shrink-0 place-items-center rounded-full border backdrop-blur-xl transition-colors duration-200 max-sm:hidden ${
            isolate
              ? 'border-accent bg-accent text-white dark:text-void'
              : 'border-white/12 bg-black/58 text-bone/80 hover:border-white/30 hover:bg-black/72'
          }`}
        >
          {isolate ? <EyeSlash aria-hidden className="size-4" weight="bold" /> : <Eye aria-hidden className="size-4" weight="bold" />}
        </button>
      )}
    </div>
  )

  if (!hasSiteModel(property)) return null

  return (
    <div ref={rootRef} className="flex scroll-mt-36 flex-col gap-4">
      {/* ── the plan and its detail panel ───────────────────────── */}
      {/* Side by side from lg up, matching the per-building plan. The panel
          used to float over the canvas, which meant the answer to "what did
          I just click" sat on top of the thing being clicked — and on a
          phone it covered a third of the model. Its own column costs the
          model some width and buys back the whole surface.

          The model takes the larger share — it is the thing being worked —
          and the panel keeps a 21rem floor so a unit's figures stay above
          the fold beside it.

          The pickers are over the plan rather than above it. Three rows of
          chips ahead of the model pushed it below the fold; as dropdowns on
          the model itself, the row is the whole section. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(21rem,1fr)] lg:items-start">
        <div className="relative min-w-0">
          {canShow3D && !viewer.activated ? (
            <ViewerLaunch
              poster={siteModel?.poster}
              height={PLAN_HEIGHT}
              onLaunch={viewer.activate}
              onPrefetch={loadViewer}
            />
          ) : canShow3D ? (
            // The boundary catches the viewer's own chunk failing to arrive,
            // which would otherwise unmount the page around it. Failures
            // inside the canvas (the model, the GPU) come through onError.
            <ErrorBoundary key={viewer.attempt} onError={(error) => viewer.fail(error, 'chunk')}>
              <Suspense fallback={<ViewerSkeleton poster={siteModel?.poster} />}>
                <Viewer
                  url={modelUrl}
                  siteEntries={entries}
                  selection={selection}
                  onSelect={onSelect}
                  focusMeshes={focusMeshes}
                  isolateFocus={isolate}
                  statusFilter={statusFilter}
                  // The plaza itself, not the model's whole extent, which
                  // is mostly road. Zoom-out stays free; zoom-in stops at
                  // whatever frame the camera is resting on.
                  homeIndexes={homeIndexes}
                  fixedZoom
                  toolbar={<div className={TOOLBAR_IN_VIEWER}>{toolbar}</div>}
                  // Building names across the site, unit numbers once inside one.
                  labelKinds={focusedBuilding ? ['unit', 'road'] : ['building', 'road']}
                  resetToken={resetToken}
                  groundless
                  orientation={orientation}
                  onFacings={setFacings}
                  onError={viewer.fail}
                  poster={siteModel?.poster}
                  fileSize={siteModel?.fileSize}
                  // Straight into 3D: the button said "3D model".
                  defaultMode="3d"
                  height={PLAN_HEIGHT}
                />
              </Suspense>
            </ErrorBoundary>
          ) : planImage ? (
            /* Tier 2 — the focused building's pin plan, with a line saying
               why it is standing in for the model and a way back to 3D. */
            <>
              <FloorPlanInteractive
                image={planImage}
                units={focusedUnits}
                selection={selectedUnit ? [selectedUnit.index] : []}
                onSelect={selectByUnitIndex}
                statusFilter={statusFilter}
              />
              <ViewerNotice reason={unavailableReason} onRetry={viewer.retry} />
            </>
          ) : (
            /* Tier 3 — no model to show and no plan image. The panel beside
               this and the list below still carry every unit in full, which
               is the whole point of holding selection as labels; the
               fallback says so and offers a retry where one can help. */
            <ViewerFallback
              reason={unavailableReason}
              hint={
                focusedBuilding
                  ? 'Every unit in this building is listed below.'
                  : 'Choose a building above to see its units.'
              }
              poster={siteModel?.poster}
              height={PLAN_HEIGHT}
              onRetry={viewer.retry}
            />
          )}
          {/* The live viewer carries its own copy, inside its container, so
              it stays on screen in fullscreen. */}
          {!(canShow3D && viewer.activated) && <div className={TOOLBAR_OVER_PLAN}>{toolbar}</div>}
        </div>

        <aside className="lg:sticky lg:top-36">
          <UnitDetailCard
            unit={selectedUnit}
            buildingLabel={focusedBuilding?.label ?? ''}
            aspect={aspect}
            breakdown={breakdown}
            units={focusedBuilding ? focusedUnits : allUnits}
            totals={
              !focusedBuilding && property.buildings > 0
                ? { total: property.buildings, available: property.available ?? 0 }
                : null
            }
            onEnquire={enquire}
            // `selectUnit` already defaults to the focused building, and a
            // unit is only ever selected while one is focused — so the units
            // offered here are always that building's own.
            onSelectUnit={selectUnit}
            maxHeight={canShow3D ? PANEL_MAX : ''}
            detailsHref={selectedUnit && focusedBuilding ? unitPath(property.slug, focusedBuilding.label, selectedUnit.label) : null}
            emptyHint={
              focusedBuilding
                ? 'Select any unit on the plan — or from the Unit menu — to see its size, floor, availability and who is in it.'
                : 'Select a building on the plan — or from the Building menu — to see its units, their sizes and who is in them.'
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
          // Keyed on the tier as well, as FloorPlanSection's is, so a viewer
          // that fails opens the list: it is now the way in.
          key={`${focusedBuilding.label}:${canShow3D ? 'plan' : 'flat'}`}
          units={focusedUnits}
          selection={selectedUnit ? [selectedUnit.index] : []}
          onSelect={selectByUnitIndex}
          statusFilter={statusFilter}
          defaultOpen={!canShow3D}
        />
      )}
    </div>
  )
}

// Only while the viewer's code downloads. A failure no longer lands here —
// it gets ViewerFallback, which says what happened.
function ViewerSkeleton({ poster }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface-alt ${PLAN_HEIGHT}`}>
      {poster && <img src={sized(poster, 'card')} alt="" className="h-full w-full object-contain opacity-25" />}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="eyebrow text-content/70">Loading site model…</span>
      </div>
    </div>
  )
}
