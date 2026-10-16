import { ArrowDown, ArrowUp, Plus, X } from '@phosphor-icons/react'
import { Button, IconButton } from './ui'

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
}) {
  const list = items ?? []

  const update = (i, next) => onChange(list.map((it, idx) => (idx === i ? next : it)))
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i))
  const add = () => onChange([...list, makeItem()])
  const move = (i, by) => {
    const j = i + by
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const canReorder = allowReorder && list.length > 1
  const showToolbar = canReorder || allowRemove

  return (
    <div className="flex flex-col gap-3">
      {list.map((item, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-black/15">
          {showToolbar && (
            <div className="flex items-center justify-between gap-2 border-b border-white/5 py-1 pl-4 pr-1.5">
              <span className="text-xs font-bold tabular-nums text-bone-3">
                {i + 1}
                <span className="font-normal"> of {list.length}</span>
              </span>
              <span className="flex items-center">
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
                {allowRemove && (
                  <IconButton
                    icon={X}
                    label={`Remove item ${i + 1}`}
                    size="sm"
                    onClick={() => remove(i)}
                    className="hover:bg-red-400/10! hover:text-red-300!"
                  />
                )}
              </span>
            </div>
          )}
          <div className="p-4">{renderItem(item, (next) => update(i, next), i)}</div>
        </div>
      ))}
      {allowAdd && (maxItems == null || list.length < maxItems) && (
        <Button size="sm" icon={Plus} onClick={add} className="w-fit">
          {addLabel}
        </Button>
      )}
    </div>
  )
}
