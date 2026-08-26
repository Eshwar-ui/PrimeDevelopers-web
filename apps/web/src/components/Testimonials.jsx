import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Quotes, Star } from '@phosphor-icons/react'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import watermark from '../assets/watermark-p.svg'

function Stars({ count = 5 }) {
  const filled = Math.max(0, Math.min(5, Math.round(count)))

  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          weight={index < filled ? 'fill' : 'regular'}
          className={index < filled ? 'size-4 text-[#ffb000]' : 'size-4 text-bone/20'}
        />
      ))}
    </div>
  )
}

function Avatar({ src, name }) {
  if (src) {
    return (
      <img
        src={sized(src, 'logo')}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-12 shrink-0 rounded-full object-cover"
      />
    )
  }

  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 font-body text-sm font-bold text-accent-soft">
      {initials}
    </span>
  )
}

function ParallaxWatermark({ index }) {
  const frameRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: frameRef,
    offset: ['start end', 'end start'],
  })
  const distance = 34 + (index % 3) * 8
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance])
  const rotate = -13 + (index % 3) * 2

  return (
    <span ref={frameRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.img
        src={watermark}
        alt=""
        style={reducedMotion ? { rotate } : { y, rotate }}
        className="absolute -bottom-24 -right-10 w-60 max-w-none opacity-[0.14] will-change-transform"
      />
    </span>
  )
}

export default function Testimonials() {
  const { eyebrow, heading, paragraph, items } = useSection('testimonials')

  if (!items?.length) return null

  return (
    <section id="testimonials" className="bg-base px-gutter py-20 text-content md:px-gutter-lg md:py-24 lg:py-28">
      <div className="mx-auto max-w-[1560px]">
        <header className="mx-auto flex max-w-[1040px] flex-col items-center text-center">
          {eyebrow && (
            <p className="flex items-center gap-3 font-body text-xs font-medium uppercase tracking-[0.04em] text-[#00a9ee]">
              <span aria-hidden className="h-px w-16 bg-[#00a9ee]/55" />
              {eyebrow}
              <span aria-hidden className="h-px w-16 bg-[#00a9ee]/55" />
            </p>
          )}

          {heading && (
            <h2 className="mt-5 font-display text-[clamp(2rem,3.15vw,3rem)] font-bold leading-[1.08] tracking-[-0.025em] text-content md:whitespace-nowrap">
              {heading}
            </h2>
          )}

          {paragraph && (
            <p className="mt-5 max-w-[56ch] font-body text-[14px] leading-[1.55] text-content/60">
              {paragraph}
            </p>
          )}
        </header>

        <ul className="mt-14 grid gap-6 md:mt-16 md:grid-cols-2 xl:grid-cols-3 xl:gap-7">
          {items.map((testimonial, index) => (
            <li key={testimonial.name} className="min-w-0">
              <figure className="group relative flex h-full min-h-[390px] flex-col overflow-hidden rounded-[20px] bg-[#141e22] px-8 py-9 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.8)] transition-[transform,box-shadow] duration-500 ease-brand hover:-translate-y-1 hover:shadow-[0_24px_54px_-28px_rgba(0,0,0,0.95)] motion-reduce:transform-none md:px-9 md:py-10">
                <ParallaxWatermark index={index} />

                <Quotes aria-hidden className="relative size-8 text-[#006a9d]" />

                <blockquote className="relative mt-7 flex-1 font-body text-[16px] leading-[1.78] text-white/92">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                <div className="relative mt-5">
                  <Stars count={testimonial.rating ?? 5} />
                </div>

                <figcaption className="relative mt-6 flex items-center gap-3.5">
                  <Avatar src={testimonial.avatar} name={testimonial.name} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-[16px] font-semibold leading-tight text-white">
                      {testimonial.name}
                    </p>
                    {/* The role wraps to a second line rather than truncating.
                        It reads "Managing Partner · Balcones Capital" — title
                        then company — so one clipped line loses exactly the
                        half that identifies who is speaking, and on a 360px
                        card it was clipping every one of them. The card's
                        `min-h` already leaves room for the extra line. */}
                    {testimonial.role && (
                      <p className="mt-1 line-clamp-2 font-body text-[12px] leading-snug text-[#6d7f9d]">
                        {testimonial.role}
                      </p>
                    )}
                  </div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}