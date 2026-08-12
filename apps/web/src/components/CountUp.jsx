import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'

/**
 * Counts a CMS statistic up from zero the first time it scrolls into view.
 *
 * The values are free text an admin typed — `9,270+`, `185,238 SQ FT`, `2.5
 * Acres` — so the number is found inside the string rather than passed
 * separately, and whatever wraps it is put back untouched. Anything with no
 * number in it renders as written and never animates.
 */
const parse = (raw) => {
  // Separators have to sit *between* digits. A looser `[\d,\s]*` also eats the
  // space in `185,238 SQ FT` into the number, which is then stripped along with
  // the thousands commas — and the unit comes back welded to the figure.
  const match = String(raw ?? '').match(/^(\D*?)(\d+(?:[,\s]\d+)*(?:\.\d+)?)(.*)$/s)
  if (!match) return null
  const [, prefix, digits, suffix] = match
  const number = Number(digits.replace(/[,\s]/g, ''))
  if (!Number.isFinite(number)) return null
  const decimals = (digits.split('.')[1] ?? '').length
  // Separators are echoed from the source, not assumed: an admin who wrote a
  // bare `9270` should not have it handed back as `9,270`.
  const grouped = /[,\s]/.test(digits)
  return { prefix, suffix, number, decimals, grouped }
}

const render = ({ number, decimals, grouped }, value) =>
  grouped
    ? value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value.toFixed(decimals)

export default function CountUp({ value, className = '' }) {
  const ref = useRef(null)
  // `once` because a figure that re-counts every time it passes the viewport
  // reads as a glitch rather than an entrance.
  const inView = useInView(ref, { once: true, margin: '-12% 0px' })
  const reduced = useReducedMotion()
  const parts = parse(value)

  useEffect(() => {
    const node = ref.current
    if (!parts || reduced || !inView || !node) return

    // Written straight to the node rather than held in state: this updates on
    // every frame, and a re-render per frame is not worth a number nothing
    // else reads. Same reasoning as the header rail's width.
    const controls = animate(0, parts.number, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = parts.prefix + render(parts, v) + parts.suffix
      },
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, parts?.number])

  // The final value is what renders. A count-up that never runs — no JS, no
  // observer, reduced motion — has to leave the real figure on the page, not a
  // zero waiting for an animation that isn't coming.
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}
