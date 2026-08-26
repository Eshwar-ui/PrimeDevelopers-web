import { useEffect, useRef, useState } from 'react'
import { useSection } from '../context/ContentContext'
import { autoplayEmbedUrl, isEmbedUrl, isInstagramUrl } from '../lib/video'

/**
 * The company film, full measure, on the page's own dark ground.
 *
 * What used to sit around it — the blue statement heading, the lede, the four
 * statistics — now opens [`Partners`](./Partners.jsx), where the new design
 * puts them. This component kept the one thing that had nowhere else to go.
 *
 * The film is not in the approved comp at all. It is here because it is real
 * commissioned work that would otherwise have been dropped from the homepage
 * silently, and because a full-bleed frame on a dark ground is the one place it
 * can sit without contradicting anything the comp does draw. Deleting the
 * section is one line in App.jsx if the client would rather follow the comp
 * exactly.
 */
export default function About() {
  const { videoUrl, videoPoster } = useSection('about_home')
  const [playing, setPlaying] = useState(false)
  const [armed, setArmed] = useState(false)
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

  if (!videoUrl) return null

  return (
    <section id="film" data-band="light" className="bg-base px-gutter pb-6 text-content md:px-gutter-lg">
      <div className="mx-auto max-w-[1560px]">
        <div
          ref={frameRef}
          // Screen-tall, but never taller than the film's own 16:9 at this
          // width. Height alone would let a narrow window crop the frame
          // sideways instead — and the film carries burned-in location titles
          // hard against all four edges, so whichever way it crops, they go.
          // Capping at the 16:9 height means the trim only ever comes off the
          // top and bottom, and only on windows wider than they are tall.
          className="relative aspect-video overflow-hidden rounded-frame bg-surface-alt md:aspect-auto md:h-[min(88dvh,calc((100vw_-_200px)*0.5625))]"
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
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label="Play film"
                  className="group absolute inset-0 grid place-items-center"
                >
                  {/* A disc, not a bare glyph: the poster behind it is client
                      photography we can't predict, and a black triangle
                      disappears against half of it. */}
                  <span className="flex size-16 items-center justify-center rounded-full bg-white/90 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-transform duration-300 ease-out group-hover:scale-110 md:size-20">
                    <svg viewBox="0 0 24 24" aria-hidden className="ml-1 size-5 fill-charcoal md:size-6">
                      <path d="M8 5.14v13.72L19 12z" />
                    </svg>
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
