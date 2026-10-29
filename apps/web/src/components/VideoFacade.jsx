import { useState } from 'react'
import { autoplayEmbedUrl } from '../lib/video'
import { sized } from '../lib/images'

// A poster and a play button until the visitor asks for the video.
//
// Each YouTube frame pulls ~1MB of player script before anyone presses play,
// and a property page carries two of them. The poster is one of the
// property's own photographs rather than YouTube's thumbnail, which would be
// a third-party image the CSP doesn't allow. The click that mounts the frame
// is the gesture autoplay needs, so it plays straight away.
export default function VideoFacade({ url, poster, title }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <iframe
        title={title}
        src={autoplayEmbedUrl(url)}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className="group relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {poster && (
        <img
          src={sized(poster, 'card')}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-[scale] duration-700 ease-brand group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      )}
      <span aria-hidden className="absolute inset-0 bg-void/40 transition-colors duration-300 group-hover:bg-void/25" />
      <span aria-hidden className="absolute inset-0 grid place-items-center">
        <span className="grid size-16 place-items-center rounded-full bg-white text-charcoal shadow-[0_18px_40px_-18px_rgba(0,0,0,.8)] transition-transform duration-300 ease-brand group-hover:scale-110 motion-reduce:transition-none">
          <svg viewBox="0 0 24 24" className="ml-1 size-6" fill="currentColor">
            <path d="M7 4.5v15l12-7.5z" />
          </svg>
        </span>
      </span>
    </button>
  )
}
