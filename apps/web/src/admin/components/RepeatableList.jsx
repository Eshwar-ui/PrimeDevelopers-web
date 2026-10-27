import { ArrowDown, ArrowUp, Plus, X } from '@phosphor-icons/react'
import { resolveNext } from '../adminUtils'
import { Button, ConfirmButton, IconButton } from './ui'

// Generic add/remove/reorder editor for an array of items, used for every
// repeatable list in the property detail model (tenants, cards, buildings, ...)
// and across site content (slides, logos, testimonials, links).
//
// Reorder is by up/down buttons rather than drag: order is what an editor is
// usually fixing ("put this slide first"), and two buttons are keyboard- and
// touch-operable with nothing to learn.
//
// Items are keyed by index. That is safe because every field inside is
// controlled — values follow the data when items move — but it does mean an
// image mid-upload should not be moved until it finishes.
//
// `onChange` always receives an updater — `(currentList) => nextList` — never
// a finished list, and each item's `set` accepts a value or an updater for
// that item (see resolveNext in adminUtils). A list built here at render time
// was a snapshot: an upload that finished later wrote that snapshot back, and
// with it undid every other edit made while the file was in flight, a second
// upload into the same list included. Callers apply the updater to their own
// current state — `patch({ items })` style helpers do that already.
//
// `canRemove(item, i)` returns true, or a reason it can't be removed (shown as
// the disabled button's label). `confirmRemove(item, i)` returns a prompt to
// confirm with first, or nothing to remove at once.
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
  canRemove,
  confirmRemove,
}) {
  const list = items ?? []

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
    <div className="flex flex-col gap-3">
      {list.map((item, i) => {
        const removable = canRemove ? canRemove(item, i) : true
        const prompt = confirmRemove ? confirmRemove(item, i) : null
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
                      <IconButton icon={ArrowUp} label={`Move item ${i + 1} up`} size="sm" disabled={i === 0} onClick={() => move(i, -1)} />
                      <IconButton
                        icon={ArrowDown}
                        label={`Move item ${i + 1} down`}
                        size="sm"
                        disabled={i === list.length - 1}
                        onClick={() => move(i, 1)}
                      />
                    </>
                  )}
                  {allowRemove &&
                    (removable === true && prompt ? (
                      <ConfirmButton icon={X} label="Remove" prompt={prompt} confirmLabel="Yes, remove" busyLabel="Removing…" onConfirm={() => remove(i)} />
                    ) : (
                      <IconButton
                        icon={X}
                        label={removable === true ? `Remove item ${i + 1}` : String(removable || `Item ${i + 1} can't be removed`)}
                        size="sm"
                        disabled={removable !== true}
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
  )
}
