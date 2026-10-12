import { Cube } from '@phosphor-icons/react'
import ActionButton from '../ActionButton'

/**
 * What a 3D section shows until the visitor asks for the model.
 *
 * The canvas is not mounted with the page. three/fiber/drei is ~620KB gzipped
 * in its own lazy chunk, a model file can be several megabytes on top of
 * that, and a live canvas on a phone takes the drag the page needs to scroll
 * with. So the section waits for a press — the client asked for exactly that
 * — and only then pays for any of it.
 *
 * Drawn at the viewer's own height, so the press swaps one box for another
 * and the page does not move under the visitor's hand.
 *
 * `onPrefetch` starts the chunk on hover or focus, which is usually a few
 * hundred milliseconds before the click — enough that most of it is already
 * in by the time the skeleton would have shown.
 */
export default function ViewerLaunch({ poster, height, onLaunch, onPrefetch }) {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-line bg-surface-alt ${height}`}
    >
      {poster && (
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover opacity-60"
        />
      )}
      {/* A scrim over the poster, so the button reads against whatever the
          picture happens to be. Theme-keyed, so it darkens with the page. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-t from-surface-alt/85 via-surface-alt/40 to-surface-alt/70 p-6 text-center">
        <ActionButton
          as="button"
          type="button"
          onClick={onLaunch}
          onPointerEnter={onPrefetch}
          onFocus={onPrefetch}
          // `w-full` below `sm` is right for a card's row of buttons and wrong
          // for one button centred in a panel; capped, it hugs its label.
          className="max-w-max"
        >
          <Cube aria-hidden weight="bold" className="size-4 shrink-0" />
          View 3D model
        </ActionButton>
        <p className="font-body text-[12px] text-content/70">Rotate, zoom and select a unit</p>
      </div>
    </div>
  )
}
