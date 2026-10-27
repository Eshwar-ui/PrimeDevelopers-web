import { ArrowClockwise } from '@phosphor-icons/react'
import ActionButton from '../ActionButton'
import { sized } from '../../lib/images'

// One line on what happened, by useViewerState's failure reason. Short on
// purpose: the visitor came for the units, and the useful part is the line
// after it telling them where those still are.
const TITLES = {
  webgl: '3D isn’t available on this device.',
  context: 'The 3D view was interrupted.',
  load: 'The 3D model didn’t load.',
  chunk: 'The 3D model didn’t load.',
  unavailable: 'The 3D model isn’t available here.',
}

// No WebGL will not come back on a second press, and neither will a model
// URL that can never load from this origin.
const canRetry = (reason) => reason === 'context' || reason === 'load' || reason === 'chunk'

/**
 * What the plan column shows when the 3D viewer cannot, and there is no 2D
 * plan image to stand in for it.
 *
 * It replaces a skeleton that read "Loading site model…" forever. Drawn at
 * the viewer's own height so nothing below it moves, over the same poster
 * the launch button used, so it reads as the same panel having failed rather
 * than as a new one.
 */
export default function ViewerFallback({ reason, hint, poster, height, onRetry }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-2xl border border-line bg-surface-alt ${height}`}>
      {poster && (
        <img
          src={sized(poster, 'card')}
          alt=""
          loading="lazy"
          decoding="async"
          // Fainter than the launch poster's 60%: there the picture is the
          // point, here the two lines of text are.
          className="absolute inset-0 size-full object-cover opacity-10"
        />
      )}
      <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-[1.15rem] font-medium tracking-[-0.01em] text-content">
          {TITLES[reason] ?? TITLES.load}
        </p>
        {hint && <p className="max-w-sm font-body text-[14px] leading-relaxed text-content/80">{hint}</p>}
        {canRetry(reason) && onRetry && (
          <ActionButton as="button" type="button" tone="ghost" onClick={onRetry} className="mt-1 max-w-max">
            <ArrowClockwise aria-hidden weight="bold" className="size-4 shrink-0" />
            Try again
          </ActionButton>
        )}
      </div>
    </div>
  )
}

/**
 * The same news in a strip, for when a 2D plan is standing in for the model:
 * the plan already answers the visitor's question, so the failure only needs
 * a line and a way back to 3D, not the whole panel.
 */
export function ViewerNotice({ reason, onRetry }) {
  return (
    <div
      role="status"
      className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-line bg-surface-alt px-4 py-2"
    >
      <p className="font-body text-[13px] text-content/75">{TITLES[reason] ?? TITLES.load} Showing the 2D plan instead.</p>
      {canRetry(reason) && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 font-body text-[12px] font-bold text-accent transition-colors duration-200 hover:bg-accent/10"
        >
          <ArrowClockwise aria-hidden weight="bold" className="size-3.5" />
          Try 3D again
        </button>
      )}
    </div>
  )
}
