import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Cube, WarningCircle, X } from '@phosphor-icons/react'
import { resolveNext } from '../adminUtils'
import { buildingHas3D, buildingMissing, summarise, unitMissing } from '../completeness'
import BuildingBlock from './BuildingBlock'
import ChipTabs, { ChipTag } from './ChipTabs'
import { ConfirmButton, IconButton } from './ui'
import { UploadBusyContext } from './uploadBusy'

// The Floor plans tab used to stack every building's full editor, each with
// every unit's form inside it — one page the length of the whole property.
// Here a building is a chip; picking one shows only that building, and its
// units are chips again inside it (see BuildingBlock).
//
// `onChange` takes an updater of the buildings list, as RepeatableList's does,
// so a photo upload that lands late still applies to the current list.
export default function BuildingsWorkspace({ buildings, onChange, makeBuilding, slug, siteModel }) {
  const list = useMemo(() => buildings ?? [], [buildings])
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, Math.max(list.length - 1, 0))
  const building = list[index]

  // A building added from elsewhere (or just now) becomes the one on screen.
  const previousCount = useRef(list.length)
  useEffect(() => {
    if (list.length > previousCount.current) setSelected(list.length - 1)
    previousCount.current = list.length
  }, [list.length])

  // Uploads in flight inside the selected building: moving or removing it then
  // would land the photo in whichever building took its place.
  const [uploading, setUploading] = useState(0)
  const reportToParent = useContext(UploadBusyContext)
  const report = useCallback(
    (delta) => {
      setUploading((n) => n + delta)
      reportToParent?.(delta)
    },
    [reportToParent],
  )
  const locked = uploading > 0

  const summary = useMemo(() => summarise(list, siteModel), [list, siteModel])

  const items = list.map((b, i) => {
    const missing = buildingMissing(b)
    const unitsPending = (b.unitList ?? []).filter((u) => unitMissing(u).length > 0).length
    const tags = []
    tags.push(buildingHas3D(b, siteModel) ? { text: '3D', tone: 'three-d' } : { text: 'No 3D', tone: 'no-three-d' })
    tags.push({ text: `${(b.unitList ?? []).length} units`, tone: 'neutral' })
    if (missing.length || unitsPending) tags.push({ text: 'Need to fill details', tone: 'warn' })
    else tags.push({ text: 'Complete', tone: 'ok' })
    return { title: String(b.building ?? '').trim() || `Building ${i + 1}`, tags }
  })

  const update = (i) => (next) =>
    onChange((current) => (current ?? []).map((b, idx) => (idx === i ? resolveNext(next, b) : b)))
  const remove = (i) => onChange((current) => (current ?? []).filter((_, idx) => idx !== i))
  const move = (i, by) =>
    onChange((current) => {
      const next = [...(current ?? [])]
      const j = i + by
      if (j < 0 || j >= next.length) return current
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const moveSelected = (by) => {
    move(index, by)
    setSelected(index + by)
  }

  const name = building ? String(building.building ?? '').trim() || `Building ${index + 1}` : ''
  const unitCount = (building?.unitList ?? []).length

  return (
    <UploadBusyContext.Provider value={report}>
      <div className="flex flex-col gap-4">
        <Summary summary={summary} />

        <ChipTabs
          label="Buildings"
          idPrefix="building"
          items={items}
          selected={index}
          onSelect={setSelected}
          onAdd={() => onChange((current) => [...(current ?? []), makeBuilding()])}
          addLabel="Add building"
        />

        {building ? (
          <div
            role="tabpanel"
            id="building-panel"
            aria-labelledby={`building-tab-${index}`}
            className="rounded-xl border border-white/10 bg-black/15"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-1 pl-4 pr-1.5">
              <span className="flex items-center gap-2 text-xs font-bold tabular-nums text-bone-3">
                {index + 1}
                <span className="font-normal"> of {list.length}</span>
                {buildingHas3D(building, siteModel) && (
                  <span className="flex items-center gap-1 text-accent-soft">
                    <Cube weight="bold" className="size-3.5" aria-hidden /> 3D
                  </span>
                )}
              </span>
              <span className="flex flex-wrap items-center justify-end">
                {list.length > 1 && (
                  <>
                    <IconButton
                      icon={ArrowLeft}
                      label={locked ? `Can't move ${name} yet: wait for the upload to finish` : `Move ${name} earlier`}
                      size="sm"
                      disabled={locked || index === 0}
                      onClick={() => moveSelected(-1)}
                    />
                    <IconButton
                      icon={ArrowRight}
                      label={locked ? `Can't move ${name} yet: wait for the upload to finish` : `Move ${name} later`}
                      size="sm"
                      disabled={locked || index === list.length - 1}
                      onClick={() => moveSelected(1)}
                    />
                  </>
                )}
                <ConfirmButton
                  icon={X}
                  label="Remove"
                  ariaLabel={locked ? `Can't remove ${name} yet: wait for the upload to finish` : `Remove ${name}`}
                  prompt={
                    unitCount
                      ? `Remove ${name} and its ${unitCount} unit${unitCount === 1 ? '' : 's'}?`
                      : `Remove ${name}?`
                  }
                  confirmLabel="Yes, remove"
                  busyLabel="Removing…"
                  disabled={locked}
                  onConfirm={() => remove(index)}
                />
              </span>
            </div>
            <div className="p-4">
              <BuildingBlock
                // Keyed so a different building starts with its own unit
                // selection rather than inheriting the last one's index.
                key={index}
                building={building}
                onChange={update(index)}
                folder={`projects/${slug}/building-${index}`}
                siteModel={siteModel}
              />
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-bone-3">
            No buildings yet. Add the first one to start entering units.
          </p>
        )}
      </div>
    </UploadBusyContext.Provider>
  )
}

// The tracker: how much of the property is filled in, at a glance, and what
// the unsold / in-lease / sold split is. "Need to fill details" is the same
// phrase the chips use, so the strip and the chips read as one thing.
function Summary({ summary }) {
  if (summary.units === 0 && summary.buildingsIncomplete === 0) return null
  const pct = summary.units ? Math.round((summary.complete / summary.units) * 100) : 100
  const done = summary.pending === 0 && summary.buildingsIncomplete === 0
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-void/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {done ? (
          <ChipTag tone="ok">All details filled in</ChipTag>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ember">
            <WarningCircle weight="bold" className="size-4" aria-hidden />
            Need to fill details: {summary.pending} unit{summary.pending === 1 ? '' : 's'}
            {summary.buildingsIncomplete > 0 &&
              ` · ${summary.buildingsIncomplete} building${summary.buildingsIncomplete === 1 ? '' : 's'}`}
          </span>
        )}
        <span className="ml-auto text-xs tabular-nums text-bone-3">
          {summary.complete} of {summary.units} units complete
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Units with all details filled in"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
      >
        <div className="h-full rounded-full bg-accent-soft transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <ChipTag tone="status-available">Unsold {summary.counts.available}</ChipTag>
        <ChipTag tone="status-leased">In lease {summary.counts.leased}</ChipTag>
        <ChipTag tone="status-sold">Sold {summary.counts.sold}</ChipTag>
        {summary.counts['coming-soon'] > 0 && (
          <ChipTag tone="status-coming-soon">Coming soon {summary.counts['coming-soon']}</ChipTag>
        )}
        <ChipTag tone="three-d">
          3D {summary.in3D} of {summary.units}
        </ChipTag>
      </div>
    </div>
  )
}
