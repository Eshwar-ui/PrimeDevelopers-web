import { useSection } from '../context/ContentContext'

const STAR = 'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z'

function Stars({ count = 5 }) {
  // Clamped rather than trusted: rating is free-entry in the admin, and a typo
  // of 50 would otherwise paint a row of stars across the whole card.
  const filled = Math.max(0, Math.min(5, Math.round(count)))
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden className="size-4">
          <path d={STAR} className={i < filled ? 'fill-saffron' : 'fill-content/15'} />
        </svg>
      ))}
    </div>
  )
}

// Drawn rather than typed. A typographic &ldquo; inherits whatever the display
// face gives it, which is a thin angular mark; the design calls for a pair of
// rounded, solid speech marks, and only a path guarantees that shape. Sized to
// the design's 40×32 quote frame.
function QuoteMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-9 shrink-0 text-accent/35"
    >
      <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
      <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
    </svg>
  )
}

// Initials stand in when no portrait is uploaded — the design's avatar is a
// fixed 48px circle, and leaving it empty punches a hole in the card's footer.
function Avatar({ src, name }) {
  if (src) {
    return <img src={src} alt="" className="size-12 shrink-0 rounded-full object-cover" />
  }
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-prime-soft font-display text-sm font-bold text-accent">
      {initials}
    </span>
  )
}

// The design lays the quotes out as a single row of three. A fourth wraps onto
// a row of its own and reads as an orphan, so the homepage shows three and the
// rest stay available to whatever else wants them.
const TEASER_COUNT = 3

export default function Testimonials() {
  const { heading, paragraph, items: all } = useSection('testimonials')
  const items = all.slice(0, TEASER_COUNT)

  if (items.length === 0) return null

  return (
    <section
      id="testimonials"
      data-band="light"
      className="bg-surface-alt px-6 py-16 text-content md:px-[75px] md:py-16"
    >
      <div className="mb-10">
        <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.01em] text-content">
          {heading}
        </h2>
        {paragraph && (
          <p className="mt-4 font-body text-[16px] leading-normal text-content/70">{paragraph}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <figure key={t.name} className="flex flex-col rounded-2xl bg-surface p-8">
            <QuoteMark />

            <blockquote className="mt-4 flex-1 font-body text-[15px] leading-[1.65] text-content/80">
              {t.quote}
            </blockquote>

            <div className="mt-7">
              <Stars count={t.rating ?? 5} />
            </div>

            <figcaption className="mt-5 flex items-center gap-3">
              <Avatar src={t.avatar} name={t.name} />
              <div className="min-w-0">
                <p className="font-display text-[16px] font-bold leading-tight text-content">
                  {t.name}
                </p>
                <p className="mt-1 font-body text-[15px] text-content/70">{t.role}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
