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
