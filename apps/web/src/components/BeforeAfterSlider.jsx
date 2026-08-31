import { useState } from 'react'

export default function BeforeAfterSlider({ before, after, alt }) {
  const [position, setPosition] = useState(50)

  return (
    <figure className='relative h-[clamp(14rem,72vw,18.75rem)] w-full select-none overflow-hidden rounded-xl bg-surface-alt has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/60 sm:rounded-2xl md:h-[460px]'>
      <img src={after} alt={`${alt} after installation`} draggable='false' className='absolute inset-0 size-full object-cover' />
      <div aria-hidden className='absolute inset-0' style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={before} alt='' draggable='false' className='absolute inset-0 size-full max-w-none object-cover' />
      </div>

      <span className='pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-void/80 px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-bone backdrop-blur-sm sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[10px] md:left-5 md:top-5'>Before</span>
      <span className='pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-void/80 px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-bone backdrop-blur-sm sm:right-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[10px] md:right-5 md:top-5'>After</span>
      <input
        type='range'
        min='0'
        max='100'
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label={`Compare before and after images of ${alt}`}
        aria-valuetext={`${position}% before image visible`}
        className='peer absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0 [touch-action:pan-y]'
      />

      <div aria-hidden className='pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_10px_rgba(0,0,0,0.45)]' style={{ left: `${position}%` }}>
        <span className='absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-void/85 text-white shadow-xl backdrop-blur-sm peer-focus-visible:ring-4 peer-focus-visible:ring-accent/60 sm:size-12'>
          <svg viewBox='0 0 24 24' className='size-5 sm:size-6' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <path d='m9 18-6-6 6-6M15 6l6 6-6 6' />
          </svg>
        </span>
      </div>

      <figcaption className='pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-void/75 px-2.5 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.1em] text-bone/90 backdrop-blur-sm sm:bottom-4 sm:px-3 sm:py-1.5 sm:text-[10px]'>Drag to compare</figcaption>
    </figure>
  )
}
