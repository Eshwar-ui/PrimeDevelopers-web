import { useEffect, useState } from 'react'
import { lenis } from '../hooks/useSmoothScroll'

/**
 * Every section this nav can point at, and what to call it.
 *
 * The order here is not the order they are shown in — see below. Neither is
 * membership: which of these exist for a given property is the page's business.
 */
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'floor-plans', label: 'Availability' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'location', label: 'Location' },
  { id: 'media', label: 'Gallery' },
  { id: 'video', label: 'Video' },
  { id: 'resources', label: 'Resources' },
]

export default function PropertyDetailNav({ property, onEnquire }) {
  /**
   * The sections the page actually rendered, read from the DOM rather than
   * re-derived from the CMS record.
   *
   * This was six conditions mirroring the page's own render guards —
   * `detail.highlights?.cards?.length`, `detail.location?.heading` and so on.
   * They were already wrong when this component arrived: it was written
   * against a different draft of the page, and of its six anchors only
   * `overview` still existed. A copy of someone else's conditions is a copy
   * that goes stale silently, and the failure it produces is a tab that
   * renders and then does nothing when clicked.
   *
   * Asking the document instead means the page stays the single source of
   * truth about its own contents: add a section with one of these ids and the
   * tab appears, drop one and the tab goes, with nothing to keep in step.
   */
  const [items, setItems] = useState([])

  useEffect(() => {
    const present = SECTIONS.map((section) => ({ ...section, el: document.getElementById(section.id) })).filter(
      (section) => section.el,
    )

    // Sorted by where the sections actually sit, not by the order they happen
    // to be listed above. The page renders Spaces before Availability and the
    // list had them the other way round, so the rail read left to right while
    // the page ran the other way — and the scrollspy then appeared to jump
    // backwards on a steady downward scroll. Comparing document position means
    // reordering the page reorders the rail, with nothing to remember.
    present.sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )

    setItems(present.map(({ id, label }) => ({ id, label })))
  }, [property])

  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    if (!items.length) return undefined
    const sections = items.map((item) => document.getElementById(item.id)).filter(Boolean)
    if (!sections.length) return undefined
    setActiveId((current) => current || items[0].id)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-144px 0px -58% 0px', threshold: [0, 0.15, 0.5] },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [items])

  if (!items.length) return null

  const handleJump = (event) => {
    const id = event.currentTarget.getAttribute('href')?.slice(1)
    const section = id ? document.getElementById(id) : null
    if (!section) return
    event.preventDefault()
    if (lenis.current) lenis.current.scrollTo(section, { offset: -144 })
    else section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    /* The offsets are the *surfaced* header's height at each breakpoint, and it
       is not one number: the row is as tall as its tallest control, which is the
       burger (44) below lg and the enquire pill (48) at lg, over py-3 / py-3.5.
       68 / 72 / 76. A single md:top-[76px] left a 4px strip of the page
       scrolling through the seam on tablets. */
    /* `px-gutter` alone. This carried `md:px-gutter-lg` from the branch it was
       written on, and that token no longer exists — the stepped gutter was
       retired for one fluid `--spacing-gutter` because the jump at `md` was
       taking width away at the exact pixel it was meant to add it. A section
       reaching for a second value is a section disagreeing with the page. */
    <nav aria-label="Property details" className="sticky top-[68px] z-30 border-b border-line bg-base/95 px-gutter backdrop-blur-xl md:top-[72px] lg:top-[76px]">
      <div className="mx-auto flex max-w-[1560px] items-center gap-4 py-2.5">
        {/* Only the rail scrolls. The enquire button used to sit inside this
            overflow box, so on a phone the page's primary action was parked off
            the right edge, reachable only by swiping the bar sideways. The
            negative margin cancels the padding the focus ring needs: an
            overflow-x box resolves overflow-y to auto, which would otherwise
            clip the ring top and bottom. */}
        <div className="-my-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={handleJump}
              aria-current={activeId === item.id ? 'location' : undefined}
              className={`flex min-h-11 shrink-0 items-center rounded-full px-4 font-body text-[12px] font-bold uppercase tracking-[0.12em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                activeId === item.id
                  ? 'bg-prime-soft text-accent'
                  : 'text-content/60 hover:bg-content/5 hover:text-content'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={onEnquire}
          className="min-h-11 shrink-0 rounded-full bg-accent px-5 font-body text-[12px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-prime-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:text-void"
        >
          Enquire
        </button>
      </div>
    </nav>
  )
}
