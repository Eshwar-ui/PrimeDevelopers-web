import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSection, useProperties } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

function Chevron({ dir }) {
  return (
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
      <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}

// Split layout: a fixed information column on the left, and a clipped carousel
// on the right whose next card deliberately peeks past the section edge.
//
// The carousel is a scroll-snap container rather than a transform-driven track.
// The design's card is a fixed 580px that has to become fluid below desktop,
// and a transform needs that width in JS — measured, and re-measured on every
// resize. Snapping lets CSS own the width and keeps the arrows to one scrollTo.
export default function Gallery() {
  const { eyebrow, heading, paragraph, features } = useSection('gallery')
  const properties = useProperties()
  const navigate = useNavigate()
  const trackRef = useRef(null)
  const [index, setIndex] = useState(0)

  // Derive the active card from scroll position rather than tracking it on
  // click alone — a swipe or a trackpad flick moves the track too, and the dots
  // have to follow those as well.
  const syncIndex = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const cards = [...track.children]
    const nearest = cards.reduce(
      (best, card, i) =>
        Math.abs(card.offsetLeft - track.scrollLeft) < best.distance
          ? { i, distance: Math.abs(card.offsetLeft - track.scrollLeft) }
          : best,
      { i: 0, distance: Infinity }
    )
    setIndex(nearest.i)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    track.addEventListener('scroll', syncIndex, { passive: true })
    return () => track.removeEventListener('scroll', syncIndex)
  }, [syncIndex])

  const goTo = (i) => {
    const track = trackRef.current
    const card = track?.children[i]
    if (card) track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
  }

  if (properties.length === 0) return null

  const atStart = index === 0
  const atEnd = index >= properties.length - 1

  return (
    <section
      id="gallery"
      data-band="light"
      // Only the left edge is padded on desktop: the carousel has to run past
      // the right edge for the next card to peek, which a symmetric pad
      // would cut off.
      className="overflow-hidden bg-surface py-16 pl-6 text-content md:py-10 md:pl-[100px]"
    >
      <div className="flex flex-col gap-10 pr-6 md:flex-row md:items-center md:gap-20 md:pr-0">
        {/* Left — information column */}
        <div className="shrink-0 md:w-[400px] md:py-16">
          {eyebrow && <p className="eyebrow text-accent">{eyebrow}</p>}

          <h2 className="mt-3 font-display text-[2.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-content">
            {renderEmphasis(heading)}
          </h2>

          {paragraph && (
            <p className="mt-6 font-body text-[16px] leading-[1.55] text-content/70">{paragraph}</p>
          )}

          {features?.length > 0 && (
            <ul className="mt-8">
              {features.map((f, i) => (
                <li
                  key={f.title}
                  className="flex items-center gap-3 border-t border-line py-4 last:border-b"
                >
                  <span className="numeral text-[15px] font-bold text-content">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-body text-[16px] text-content/80">{f.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right — clipped carousel */}
        <div className="min-w-0 flex-1">
          <div
            ref={trackRef}
            // relative is load-bearing, not cosmetic: the arrows and dots
            // compare each card's offsetLeft against the track's scrollLeft,
            // and offsetLeft is measured from the nearest *positioned*
            // ancestor. Without this the cards resolve against a container
            // outside the scroller and every jump overshoots by the left
            // column's width.
            className="relative flex snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain"
          >
            {properties.map((p) => (
              <figure
                key={p.slug}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/properties/${p.slug}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/properties/${p.slug}`)}
                className="group w-[85vw] shrink-0 cursor-pointer snap-start sm:w-[420px] md:w-[580px]"
              >
                <div className="overflow-hidden rounded-2xl">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-[260px] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] md:h-[400px]"
                  />
                </div>
                <figcaption className="mt-4">
                  <p className="font-display text-[20px] font-bold leading-tight tracking-[-0.01em] text-content">
                    {p.name}
                  </p>
                  {p.address && (
                    <p className="mt-1.5 font-body text-[15px] text-content/55">{p.address}</p>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      {/* Controls — dots track the left column, arrows sit under the carousel */}
      <div className="mt-8 flex items-center justify-between gap-6 pr-6 md:mt-6 md:pr-[100px]">
        <div className="flex items-center gap-2">
          {properties.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${p.name}`}
              aria-current={i === index}
              className={`rounded-full transition-all duration-300 ${
                i === index ? 'size-2.5 bg-accent' : 'size-2 bg-content/20 hover:bg-content/40'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={atStart}
            aria-label="Previous"
            className="flex size-13 items-center justify-center rounded-full border border-line text-content transition-colors duration-300 enabled:hover:border-content/40 disabled:opacity-35"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={atEnd}
            aria-label="Next"
            className="flex size-13 items-center justify-center rounded-full bg-accent text-white transition-colors duration-300 enabled:hover:bg-prime-deep disabled:opacity-35"
          >
            <Chevron dir="right" />
          </button>
        </div>
      </div>
    </section>
  )
}
