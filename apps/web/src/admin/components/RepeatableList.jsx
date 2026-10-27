import { useCallback, useContext, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from '@phosphor-icons/react'
import { resolveNext } from '../adminUtils'
import { Button, ConfirmButton, IconButton } from './ui'
import { UploadBusyContext } from './uploadBusy'

// Generic add/remove/reorder editor for an array of items, used for every
// repeatable list in the property detail model (tenants, cards, buildings, ...)
// and across site content (slides, logos, testimonials, links).
//
// Reorder is by up/down buttons rather than drag: order is what an editor is
// usually fixing ("put this slide first"), and two buttons are keyboard- and
// touch-operable with nothing to learn.
//
// Items are keyed, and updated, by index. That is safe because every field
// inside is controlled — values follow the data when items move — with one
// exception: an upload that finishes after its row moved would land in
// whichever row took its place. So while any upload inside the list is in
// flight (see uploadBusy.js), Remove and the arrows are disabled.
//
// `onChange` always receives an updater — `(currentList) => nextList` — never
// a finished list, and each item's `set` accepts a value or an updater for
// that item (see resolveNext in adminUtils). A list built here at render time
// was a snapshot: an upload that finished later wrote that snapshot back, and
// with it undid every other edit made while the file was in flight, a second
// upload into the same list included. Callers apply the updater to their own
// current state — `patch({ items })` style helpers do that already.
//
// `itemLabel(item, i)` names a row for the buttons' accessible names ("Remove
// Building 2"); without it they say "item 2". `canRemove(item, i)` returns
// true, or the reason the row can't be removed. `confirmRemove(item, i)`
// returns a prompt to confirm with first, or nothing to remove at once.
export default function RepeatableList({
  items,
  onChange,
  makeItem,
  renderItem,
  addLabel = 'Add',
  allowAdd = true,
  allowRemove = true,
  allowReorder = true,
  maxItems,
  itemLabel,
  canRemove,
  confirmRemove,
}) {
  const list = items ?? []

  // Uploads in flight anywhere inside this list, nested lists included.
  const reportToParent = useContext(UploadBusyContext)
  const [uploading, setUploading] = useState(0)
  const report = useCallback(
    (delta) => {
      setUploading((n) => n + delta)
      reportToParent?.(delta)
    },
    [reportToParent],
  )
  const locked = uploading > 0
  const lockedReason = 'wait for the upload to finish'

  const update = (i, next) =>
    onChange((current) => (current ?? []).map((it, idx) => (idx === i ? resolveNext(next, it) : it)))
  const remove = (i) => onChange((current) => (current ?? []).filter((_, idx) => idx !== i))
  const add = () => onChange((current) => [...(current ?? []), makeItem()])
  const move = (i, by) =>
    onChange((current) => {
      const next = [...(current ?? [])]
      const j = i + by
      if (j < 0 || j >= next.length) return current
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const canReorder = allowReorder && list.length > 1
  const showToolbar = canReorder || allowRemove

  return (
    <UploadBusyContext.Provider value={report}>
      <div className="flex flex-col gap-3">
        {list.map((item, i) => {
          const name = String((itemLabel && itemLabel(item, i)) || '').trim() || `item ${i + 1}`
          const removable = canRemove ? canRemove(item, i) : true
          const prompt = confirmRemove ? confirmRemove(item, i) : null
          const removeName =
            removable !== true
              ? `Can't remove ${name}: ${removable || 'locked'}`
              : locked
                ? `Can't remove ${name} yet: ${lockedReason}`
                : `Remove ${name}`
          return (
            <div key={i} className="rounded-xl border border-white/10 bg-black/15">
              {showToolbar && (
                <div className="flex items-center justify-between gap-2 border-b border-white/5 py-1 pl-4 pr-1.5">
                  <span className="text-xs font-bold tabular-nums text-bone-3">
                    {i + 1}
                    <span className="font-normal"> of {list.length}</span>
                  </span>
                  <span className="flex flex-wrap items-center justify-end">
                    {canReorder && (
                      <>
                        <IconButton
                          icon={ArrowUp}
                          label={locked ? `Can't move ${name} yet: ${lockedReason}` : `Move ${name} up`}
                          size="sm"
                          disabled={locked || i === 0}
                          onClick={() => move(i, -1)}
                        />
                        <IconButton
                          icon={ArrowDown}
                          label={locked ? `Can't move ${name} yet: ${lockedReason}` : `Move ${name} down`}
                          size="sm"
                          disabled={locked || i === list.length - 1}
                          onClick={() => move(i, 1)}
                        />
                      </>
                    )}
                    {allowRemove &&
                      (removable === true && prompt ? (
                        <ConfirmButton
                          icon={X}
                          label="Remove"
                          ariaLabel={removeName}
                          title={locked ? removeName : undefined}
                          prompt={prompt}
                          confirmLabel="Yes, remove"
                          busyLabel="Removing…"
                          disabled={locked}
                          onConfirm={() => remove(i)}
                        />
                      ) : (
                        <IconButton
                          icon={X}
                          label={removeName}
                          size="sm"
                          disabled={removable !== true || locked}
                          onClick={() => remove(i)}
                          className="hover:bg-red-400/10! hover:text-red-300!"
                        />
                      ))}
                  </span>
                </div>
              )}
              <div className="p-4">{renderItem(item, (next) => update(i, next), i)}</div>
            </div>
          )
        })}
        {allowAdd && (maxItems == null || list.length < maxItems) && (
          <Button size="sm" icon={Plus} onClick={add} className="w-fit">
            {addLabel}
          </Button>
        )}
      </div>
    </UploadBusyContext.Provider>
  )
}
