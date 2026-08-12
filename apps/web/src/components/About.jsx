import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { autoplayEmbedUrl, isEmbedUrl, isInstagramUrl } from '../lib/video'

gsap.registerPlugin(ScrollTrigger)

export default function About() {
  const { heading, paragraph1, stats, videoUrl, videoPoster } = useSection('about_home')
  const [playing, setPlaying] = useState(false)
  const [armed, setArmed] = useState(false)
  const scope = useRef(null)
  const frameRef = useRef(null)
  const videoRef = useRef(null)

  const embed = isEmbedUrl(videoUrl)
  // An autoplaying loop is motion whether or not it carries sound, so the
  // reduced-motion preference falls back to the poster and a play button.
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const loops = Boolean(videoUrl) && !embed && !reduced

  // The file is megabytes, so it isn't fetched until the frame is near the
  // viewport — `armed` is what puts a src on the element. The same observer
  // then parks the loop whenever it scrolls away, since a video decoding
  // off-screen costs a phone real battery for nothing.
  useEffect(() => {
    const el = frameRef.current
    if (!el || !loops) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setArmed(true)
          videoRef.current?.play().catch(() => {})
        } else {
          videoRef.current?.pause()
        }
      },
      { rootMargin: '200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loops])

  // React doesn't reliably reflect `muted` to the DOM property, and autoplay
  // is refused without it — so it's set on the element directly, before any
  // src exists to be blocked.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = true
  }, [loops])

  useGSAP(
    () => {
      gsap.from('[data-fade]', {
        y: 40,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.15,
        scrollTrigger: { trigger: scope.current, start: 'top 70%' },
      })

      // Each stat springs in and counts up from 0, staggered.
      gsap.utils.toArray('[data-count]').forEach((el, i) => {
        const end = Number(el.dataset.count)
        const obj = { v: 0 }
        gsap
          .timeline({
            delay: i * 0.14,
            scrollTrigger: { trigger: '[data-stats]', start: 'top 85%' },
          })
          .fromTo(
            el,
            { autoAlpha: 0, scale: 0.4, y: 12 },
            { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' },
            0
          )
          .to(
            obj,
            {
              v: end,
              duration: 1.3,
              ease: 'power1.out',
              onUpdate: () => {
                el.textContent = `${Math.round(obj.v)}+`
              },
            },
            0
          )
      })
    },
    { scope }
  )

  return (
    // data-band="light" is what flips the fixed header to charcoal chrome as
    // this section passes under it — load-bearing now that the band is white.
    <section
      id="about"
      data-band="light"
      ref={scope}
      // --edge-shade is the same ink the hero frames its panel and thumbnails
      // with, so the two sections' edges read as one treatment.
      className="relative bg-surface px-6 py-24 text-content [--edge-shade:rgba(18,30,38,0.26)] md:px-[75px] md:py-32"
    >
      {/* ── intro row — statement left, context right ──────────────
          The paragraph is set flush right so the two blocks close on
          the measure's outer edges rather than drifting toward each
          other, which is what makes the wide gap between them read as
          deliberate instead of as a gap. */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-20">
        <h2
          data-fade
          className="max-w-[24ch] font-display font-bold leading-[1.26] tracking-[-0.005em] text-accent"
          style={{ fontSize: 'clamp(1.35rem, 1.45vw, 1.75rem)' }}
        >
          {/* Emphasis renders in the same ink — the statement is one blue
              mass by design — but *asterisks* still honour line breaks. */}
          {renderEmphasis(heading, '')}
        </h2>

        <p
          data-fade
          className="max-w-[62ch] font-body leading-[1.62] text-content lg:text-right"
          style={{ fontSize: 'clamp(0.95rem, 1.05vw, 1.15rem)' }}
        >
          {paragraph1}
        </p>
      </div>

      {/* ── the film ───────────────────────────────────────────────
          A hosted file runs as a silent loop; a hosted embed can't be
          trusted to autoplay without chrome, so those keep the poster
          and a play button. */}
      <div
        ref={frameRef}
        data-fade
        // Screen-tall, but never taller than the film's own 16:9 at this
        // width. Height alone would let a narrow window crop the frame
        // sideways instead — and the film carries burned-in location titles
        // hard against all four edges, so whichever way it crops, they go.
        // Capping at the 16:9 height means the trim only ever comes off the
        // top and bottom, and only on windows wider than they are tall.
        className="relative mt-14 aspect-video overflow-hidden rounded-[32px] bg-surface-alt md:mt-16 md:aspect-auto md:h-[min(100dvh,calc((100vw_-_150px)*0.5625))] md:rounded-[40px]"
      >
        {loops ? (
          <video
            ref={videoRef}
            // No src until the observer arms it — see above.
            src={armed ? videoUrl : undefined}
            poster={videoPoster || undefined}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            // Silent, unstoppable and decorative of the copy beside it —
            // there is nothing here for a screen reader to announce.
            aria-hidden
            tabIndex={-1}
          />
        ) : (
          <>
            {videoPoster && !playing && (
              <img src={videoPoster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}

            {playing ? (
              embed ? (
                // A reel is 9:16 and arrives inside Instagram's own post
                // chrome, so it can only be centred on a dark ground —
                // stretched to the panel it would be cropped to a strip
                // through the middle. Every other host fills the frame.
                <div
                  className={`absolute inset-0 ${
                    isInstagramUrl(videoUrl) ? 'grid place-items-center bg-void px-4 py-4' : ''
                  }`}
                >
                  <iframe
                    title="Prime Developers"
                    src={autoplayEmbedUrl(videoUrl)}
                    scrolling="no"
                    className={
                      isInstagramUrl(videoUrl)
                        ? 'h-full w-full max-w-[min(100%,26rem)] rounded-2xl bg-surface'
                        : 'h-full w-full'
                    }
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video
                  src={videoUrl}
                  poster={videoPoster || undefined}
                  className="absolute inset-0 h-full w-full object-cover"
                  controls
                  autoPlay
                  playsInline
                />
              )
            ) : (
              videoUrl && (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label="Play film"
                  className="group absolute inset-0 grid place-items-center"
                >
                  {/* A disc, not a bare glyph: the poster behind it is client
                      photography we can't predict, and a black triangle
                      disappears against half of it. */}
                  <span className="flex size-16 items-center justify-center rounded-full bg-surface/90 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-transform duration-300 ease-out group-hover:scale-110 md:size-20">
                    <svg viewBox="0 0 24 24" aria-hidden className="ml-1 size-5 fill-[#232323] md:size-6">
                      <path d="M8 5.14v13.72L19 12z" />
                    </svg>
                  </span>
                </button>
              )
            )}
          </>
        )}

        {/* Inner shadow along the panel's edges, matching the hero's frames.
            Its own layer rather than an inset box-shadow on the parent: that
            would paint beneath the video, not over it. */}
        <span
          aria-hidden
          style={{ boxShadow: 'inset 0 0 22px var(--edge-shade)' }}
          className="pointer-events-none absolute inset-0 rounded-[32px] md:rounded-[40px]"
        />
      </div>

      {/* ── stats band ─────────────────────────────────────────────
          Hairlines come from a one-pixel gap over a ruled ground rather
          than per-cell borders: the same markup then divides cleanly at
          two columns and at four, with no first/last-in-row exceptions
          to keep in step. */}
      {stats.length > 0 && (
        <div data-stats className="mt-1.5 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center gap-4 bg-surface py-9 pr-4 md:gap-6 md:py-14 ${
                i === 0 ? '' : 'pl-4 md:pl-12'
              }`}
            >
              <span
                data-count={s.value}
                className="numeral shrink-0 text-content"
                style={{ fontSize: 'clamp(2.25rem, 3.2vw, 3.75rem)' }}
              >
                0+
              </span>
              <span
                className="font-body uppercase leading-[1.35] tracking-[0.04em] text-accent"
                style={{ fontSize: 'clamp(0.78rem, 0.95vw, 1rem)' }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
