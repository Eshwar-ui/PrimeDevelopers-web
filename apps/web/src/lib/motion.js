/**
 * The site's shared entrance: a block lifts 26px into place while the set it
 * belongs to comes up in sequence.
 *
 * Held here rather than restated per page because three copies had already
 * appeared — the homepage hero, the properties hero, the property highlights —
 * and a fourth would eventually have drifted by a hundredth of a second and
 * made two sections that should feel identical feel merely similar.
 *
 * `delayChildren` is a beat of stillness before anything moves, so the sequence
 * reads as deliberate rather than as the page still loading.
 */
export const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}

/**
 * For a block that has scrolled to rather than arrived with the page. `once`
 * because a section that replays every time it passes the viewport reads as a
 * glitch, and the margin starts it a little before the edge so the movement is
 * already underway by the time it is properly in view.
 */
export const inViewOnce = { once: true, margin: '-15% 0px' }

/* ── The card entrance, for Motion ────────────────────────────────────────
   The Motion twin of `dealCards` in lib/reveal.js, so a card grid built on
   Motion variants (/properties, the property and info pages) arrives exactly
   like the homepage's GSAP-dealt cards: a 56px rise, settling up from .96,
   clearing a light blur, 1s on the brand curve, 0.12s apart. The blur is
   desktop only — on a phone a blurred card is a full repaint every frame of
   the entrance, landing mid-swipe. Read once at load: a window resized across
   the breakpoint keeps the choice it started with, which costs nothing. */
const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

export const cardRise = {
  hidden: { opacity: 0, y: 56, scale: 0.96, ...(wide ? { filter: 'blur(6px)' } : {}) },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    ...(wide ? { filter: 'blur(0px)' } : {}),
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
  },
}

export const cardStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
}

/** Props for a single card that meets the reader on its own (no parent stagger). */
export const cardInView = {
  initial: cardRise.hidden,
  whileInView: cardRise.show,
  viewport: inViewOnce,
}
