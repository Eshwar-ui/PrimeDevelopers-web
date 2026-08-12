/**
 * A square of page ground with a quarter-disc bitten out of one corner, which
 * reads against the panel behind it as a rounded corner turned inside out.
 *
 * Concave corners are what let a bay of page colour meet the edge of a frame as
 * a curve rather than a step. They come in pairs or threes: the bay carries its
 * own convex radius, and one of these closes each end where the frame's edge
 * resumes. The homepage hero cuts a bay from the left of its visual; the
 * property hero cuts one from the top of its photograph to seat the social
 * buttons. Same shape, different edge.
 *
 * `origin` is the corner the disc is removed from, in background-position terms
 * — the corner the curve sweeps *away* from. For a bay hanging below a top
 * edge, that is the bottom of the square: `0% 100%` on the bay's left, `100%
 * 100%` on its right.
 *
 * Reads `--notch-r` off the nearest ancestor that sets it, so a frame declares
 * its own corner size once and the bay and both corners stay in step by
 * construction. The half-pixel back-off closes the seam that a butt joint
 * against a fractional radius otherwise leaves.
 *
 * Filled with --color-surface rather than a literal: the bay is page ground, and
 * page ground is a different colour in each theme. Hardcoding white here is
 * exactly the bug that left two lit squares hanging off a dark panel.
 */
export const invertedCorner = (origin = '100% 100%') => ({
  backgroundImage: `radial-gradient(circle at ${origin}, transparent 0 calc(var(--notch-r) - 0.5px), var(--color-surface) var(--notch-r))`,
})
