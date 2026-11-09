/**
 * Perspective shift on hover: the card turns a few degrees toward the
 * pointer, and its photograph slides the other way inside the frame so the
 * picture reads as sitting behind the card's face.
 *
 * Kept small on purpose. These cards are up to ~1400px wide, and on a wide
 * card a degree of `rotateY` swings each end ~12px toward or away from the
 * viewer; past about 3 the far edge starts to look like it is falling over
 * rather than leaning. Vertical tilt gets more room because the card is short.
 *
 * Mouse and trackpad only (`hover: hover` and `pointer: fine`), never under
 * reduced motion. It writes `transform` alone on the card, which nothing else
 * there owns (the hover lift is Tailwind's `translate`), and `translate` on the
 * photograph, which composes with the hover zoom (`scale`) and the scroll
 * unveil (`transform`). Each pointermove only stores the position; the write
 * happens once a frame.
 */
export function attachTilt(card, { maxX = 4, maxY = 2.5, shift = 10, photo = 'img' } = {}) {
  if (!card) return () => {}
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  const img = photo ? card.querySelector(photo) : null
  let frame = 0
  let nx = 0
  let ny = 0

  const write = () => {
    frame = 0
    card.style.transform = `perspective(1600px) rotateX(${(-ny * maxX).toFixed(2)}deg) rotateY(${(nx * maxY).toFixed(2)}deg)`
    if (img) img.style.translate = `${(-nx * shift).toFixed(1)}px ${(-ny * shift).toFixed(1)}px`
  }

  const onEnter = () => {
    // Quick to pick up, so the card answers the pointer without lagging it.
    card.style.transition = 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1), translate 500ms cubic-bezier(0.16, 1, 0.3, 1), border-color 500ms, box-shadow 500ms'
    card.style.willChange = 'transform'
    if (img) img.style.transition = 'translate 400ms cubic-bezier(0.16, 1, 0.3, 1), scale 700ms cubic-bezier(0.16, 1, 0.3, 1)'
  }

  const onMove = (e) => {
    const r = card.getBoundingClientRect()
    nx = (e.clientX - r.left) / r.width - 0.5
    ny = (e.clientY - r.top) / r.height - 0.5
    if (!frame) frame = requestAnimationFrame(write)
  }

  const onLeave = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    // Settles back slower than it follows: leaving should look like letting go.
    card.style.transition = 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), translate 500ms cubic-bezier(0.16, 1, 0.3, 1), border-color 500ms, box-shadow 500ms'
    card.style.transform = 'perspective(1600px) rotateX(0deg) rotateY(0deg)'
    if (img) img.style.translate = '0px 0px'
    setTimeout(() => {
      card.style.willChange = ''
    }, 700)
  }

  card.addEventListener('pointerenter', onEnter)
  card.addEventListener('pointermove', onMove)
  card.addEventListener('pointerleave', onLeave)

  return () => {
    if (frame) cancelAnimationFrame(frame)
    card.removeEventListener('pointerenter', onEnter)
    card.removeEventListener('pointermove', onMove)
    card.removeEventListener('pointerleave', onLeave)
    card.style.removeProperty('transform')
    card.style.removeProperty('transition')
    card.style.removeProperty('will-change')
    if (img) {
      img.style.removeProperty('translate')
      img.style.removeProperty('transition')
    }
  }
}
