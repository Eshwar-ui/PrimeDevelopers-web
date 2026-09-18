import { useEffect, useMemo, useState } from 'react'
import { lenis } from '../hooks/useSmoothScroll'

export default function PropertyDetailNav({ property, onEnquire }) {
  const items = useMemo(() => {
    const detail = property?.detail ?? {}
    const galleryExists = property?.image || property?.gallery?.length > 0 || detail.extFacade?.length > 0
    const mediaExists = galleryExists || detail.videos?.some((video) => video?.url)

    return [
      detail.overview?.heading && { id: 'overview', label: 'Overview' },
      (detail.floorPlans?.buildings?.length > 0 || property?.available > 0) && {
        id: 'availability',
        label: 'Availability',
      },
      detail.highlights?.cards?.length > 0 && { id: 'spaces', label: 'Spaces' },
      detail.location?.heading && { id: 'location', label: 'Location' },
      mediaExists && { id: 'media', label: 'Gallery' },
      detail.resourceLinks?.some((resource) => resource?.url && resource?.label) && {
        id: 'resources',
        label: 'Resources',
      },
    ].filter(Boolean)
  }, [property])

  const [activeId, setActiveId] = useState(items[0]?.id ?? '')

  useEffect(() => {
    if (!items.length) return undefined
    const sections = items.map((item) => document.getElementById(item.id)).filter(Boolean)
    if (!sections.length) return undefined

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
    <nav aria-label="Property details" className="sticky top-[68px] z-30 border-b border-line bg-base/95 px-gutter backdrop-blur-xl md:top-[72px] md:px-gutter-lg lg:top-[76px]">
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
