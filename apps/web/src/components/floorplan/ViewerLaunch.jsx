import { Cube } from '@phosphor-icons/react'
import ActionButton from '../ActionButton'
import { sized, srcSetFor } from '../../lib/images'

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
      {/* Resized: the poster was the 965 KB original. The card ladder tops out
          at 1200px, which is the widest this column renders on a 2x laptop;
          the resizer serves WebP to match.

          Contained, not covered. The column is half the row and taller than it
          is wide, so `object-cover` cut a landscape photograph down to its
          middle third. The whole picture now shows, over a blurred copy of
          itself so the spare space reads as part of the image rather than as
          empty bars. Both use the same URL, so it downloads once. */}
      {poster && (
        <>
          <img
            src={sized(poster, 'card')}
            srcSet={srcSetFor(poster, 'card')}
            sizes="(min-width: 1024px) 50vw, 100vw"
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl"
          />
          <img
            src={sized(poster, 'card')}
            srcSet={srcSetFor(poster, 'card')}
            sizes="(min-width: 1024px) 50vw, 100vw"
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-contain"
          />
        </>
      )}
      {/* A light scrim, so the button reads against whatever the picture
          happens to be without hiding the picture. Theme-keyed. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-alt/20 p-6 text-center">
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
        <p className="rounded-full bg-surface-alt/75 px-3 py-1 font-body text-[12px] text-content/80 backdrop-blur-sm">
          Rotate, zoom and select a unit
        </p>
      </div>
    </div>
  )
}
