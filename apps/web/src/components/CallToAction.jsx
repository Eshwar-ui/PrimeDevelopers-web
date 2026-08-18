import { Link } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

// Both layers fade with an alpha mask rather than a coloured gradient laid over
// the photo. Masking is alpha-only, so the panel's own ground shows through
// untouched and the blend is right in both themes for free — a gradient painted
// in the card colour would have to restate `ink`/`carbon`, and ramping one to
// `transparent` in sRGB drags the midpoint through grey.
//
// The stops trace a smoothstep rather than a straight line. A three-stop linear
// ramp changes slope abruptly at each stop, and against a flat ground the eye
// picks those corners out as banding; easing the ends is what makes the join
// read as continuous.
const mask = (stops) => ({ maskImage: stops, WebkitMaskImage: stops })

// The two alphas multiply — what the eye reads is 1-(1-blur)(1-sharp) — so the
// pair is tuned against that composite rather than each looking right alone.
// Together they trace a smoothstep: dead flat at the copy end, steepest at the
// midpoint, easing out before the panel edge. Half-open by the third of the way
// across and then crawling is the shape to avoid; it reads as the photo
// starting abruptly and then not going anywhere.

// Sharp copy — hangs back while the wash does the blending, then takes over
// through the second half and lands at full strength before the panel edge, so
// the photograph is genuinely itself by the time it gets there.
const photoFade = mask(
  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.01) 12%, rgba(0,0,0,0.04) 20%,' +
    ' rgba(0,0,0,0.10) 28%, rgba(0,0,0,0.18) 36%, rgba(0,0,0,0.29) 45%,' +
    ' rgba(0,0,0,0.45) 54%, rgba(0,0,0,0.69) 64%, rgba(0,0,0,0.88) 74%,' +
    ' rgba(0,0,0,0.97) 83%, #000 90%)'
)

// Blurred copy — the seam itself, carrying the blend while the sharp copy is
// still too faint to, and tapering away once it isn't. Peaks at 0.35 and returns
// to nothing: left opaque it would hide the ground on its own, and left up at
// the panel edge the photograph would never resolve.
//
// A blurred *duplicate* rather than `backdrop-filter` on an overlay, which was
// the previous approach and the reason the join was a visible vertical line —
// backdrop-filter clips its blurred backdrop to its own box, so its leading
// edge is a step change no mask on that same element can soften.
const seamFade = mask(
  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.02) 12%, rgba(0,0,0,0.06) 20%,' +
    ' rgba(0,0,0,0.13) 28%, rgba(0,0,0,0.22) 36%, rgba(0,0,0,0.30) 45%,' +
    ' rgba(0,0,0,0.35) 54%, rgba(0,0,0,0.30) 64%, rgba(0,0,0,0.20) 74%,' +
    ' rgba(0,0,0,0.09) 83%, transparent 90%)'
)

// The closing panel: a dark inset card, type left and a single photograph right.
//
// It no longer floats on a white band. The footer below is dark in both themes
// now, so this panel's bottom padding is dropped and its bottom corners squared:
// card and footer read as one continuous dark close rather than two dark blocks
// with a white sliver trapped between them. The side gutters still run past it,
// which is what keeps it an inset card rather than a full-bleed band.
//
// Only the homepage renders this, and <Footer /> always follows <main>, so the
// squared edge can never end up against anything but that dark ground.
export default function CallToAction() {
  const { heading, paragraph, ctaLabel, ctaHref, image } = useSection('cta_home')

  if (!heading) return null

  return (
    <section id="cta" data-band="light" className="bg-surface px-6 pt-10 md:px-[75px] md:pt-16">
      {/* In light mode the contrast against the white gutters does the work.
          Under dark mode that inverts: ink sits within a few points of the
          ground and the panel edge dissolves, so it steps *up* to carbon
          instead and stays a raised object either way — which also gives the
          join to the footer's void a readable step rather than a dead seam. */}
      <div className="relative overflow-hidden rounded-3xl rounded-b-none bg-ink text-bone dark:bg-carbon">
        {/* From md up the photo stops being a framed object in a column and
            bleeds off the panel's top, right and bottom edges, dissolving into
            the ground where the copy begins. It sits behind the grid rather
            than in it so it can reach past the padding — the column below still
            reserves the width that keeps the two off each other. */}
        {image && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] md:block"
          >
            {/* scale-125 pushes the blurred copy's own edges out of frame and
                the wrapper trims the overhang: `filter: blur()` samples the
                transparency beyond an element's box, so at its true edges the
                wash thins out — a lighter rim down the panel if it isn't
                oversized first.
                The mask goes on the wrapper rather than the image because a
                mask is resolved in the element's own box and *then* scaled with
                it: on the image, `6%` would land 25% adrift of the sixth of the
                seam it names, opening the fade before the layer even starts. */}
            <div style={seamFade} className="absolute inset-0 overflow-hidden">
              <img src={image} alt="" className="size-full scale-125 object-cover blur-xl" />
            </div>
            <img
              src={image}
              alt=""
              style={photoFade}
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        )}

        {/* The photo column only exists once there's a photo — reserving it
            unconditionally leaves half the panel empty until someone uploads
            one, which reads as a broken layout rather than an empty slot. */}
        <div
          className={`relative grid items-center gap-10 p-8 md:gap-16 md:p-16 ${
            image ? 'md:grid-cols-[1.6fr_1fr]' : ''
          }`}
        >
          <div>
            <h2 className="max-w-[16ch] font-display text-[2rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[3rem]">
              {renderEmphasis(heading)}
            </h2>

            {paragraph && (
              <p className="mt-6 max-w-[58ch] font-body text-[16px] leading-[1.6] text-bone/65">
                {paragraph}
              </p>
            )}

            {ctaLabel && (
              <Link
                to={ctaHref || '/contact'}
                className="primary-button-flood mt-9 inline-flex items-center gap-3 rounded-xl bg-accent px-8 py-4.5 font-body text-[17px] font-medium text-white dark:text-void transition-colors duration-300 hover:bg-prime-deep"
              >
                {ctaLabel}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
            )}
          </div>

          {/* Stacked layout has no side for the photo to fade into, so below md
              it stays a framed object. Empty from md up, where it does nothing
              but hold the track that keeps the copy clear of the bleed. */}
          {image && (
            <img
              src={image}
              alt=""
              className="aspect-square w-full rounded-2xl object-cover md:hidden"
            />
          )}
        </div>
      </div>
    </section>
  )
}
