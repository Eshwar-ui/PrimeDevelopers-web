import { useRef, useState, useEffect } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import PillButton from './PillButton'
import ArrowRight from './ArrowRight'
import watermark from '../assets/watermark-p.svg'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

const SLIDE_MS = 6000

// Letterbox reveal: each headline line slides up from behind its own mask.
const line = {
  hidden: { y: '115%' },
  show: { y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
}
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } },
}
const soft = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: 'easeOut' } },
}

export default function Hero() {
  const hero = useSection('hero')
  const slides = hero.slides.length ? hero.slides : [{ image: '', place: '', kind: '' }]
  const scope = useRef(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const jump = (n) => setIndex(n)
  const next = () => setIndex((i) => (i + 1) % slides.length)
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)

  // Auto-advance; resetting on `index` gives a full dwell after a manual pick,
  // and hovering the bottom bar pauses the cycle so reading stays deliberate.
  useEffect(() => {
    if (paused || slides.length < 2) return
    const id = setTimeout(next, SLIDE_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, slides.length])

  useGSAP(
    () => {
      gsap.to('[data-hero-bg]', {
        yPercent: 14,
        ease: 'none',
        scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.to('[data-hero-copy]', {
        yPercent: -10,
        ease: 'none',
        scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: true },
      })
    },
    { scope }
  )

  const active = slides[index] ?? slides[0]

  return (
    <section
      id="hero"
      ref={scope}
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-ink text-bone"
    >
      {/* ── Full-bleed cinematic backdrop ─────────────────────────── */}
      <div data-hero-bg className="absolute inset-0">
        {active.image && (
          <img
            src={active.image}
            alt=""
            className="hero-slide-active absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* single light scrim — only the lower band darkens so copy stays readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
      </div>

      {/* faint brand P watermark, flattened to a soft white silhouette on the dark backdrop */}
      <img
        src={watermark}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 w-[46vw] max-w-[620px] opacity-[0.05] brightness-0 invert"
      />

      {/* ── drawing-sheet frame — a thin inset border with ember corner ticks,
          framing the photo like an architectural sheet. Desktop only. ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-5 z-[5] hidden rounded-sm border border-white/12 md:block"
      >
        <span className="absolute -left-px -top-px size-4 border-l-2 border-t-2 border-ember/80" />
        <span className="absolute -right-px -top-px size-4 border-r-2 border-t-2 border-ember/80" />
      </div>

      {/* ── vertical thumbnail rail — sheet index, right edge ── */}
      {slides.length > 1 && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="absolute right-10 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 xl:flex"
        >
          {slides.map((slide, i) => (
            <motion.button
              key={i}
              variants={soft}
              type="button"
              onClick={() => jump(i)}
              aria-label={`Show ${slide.place}`}
              aria-current={i === index ? 'true' : undefined}
              className={`group relative h-14 w-20 overflow-hidden rounded-lg border transition-all duration-300 ${
                i === index
                  ? 'border-ember shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]'
                  : 'border-white/15 opacity-45 hover:opacity-80'
              }`}
            >
              {slide.image && <img src={slide.image} alt="" className="h-full w-full object-cover" />}
              <span
                className={`absolute bottom-1 left-1.5 font-arimo text-[9px] font-bold tabular-nums ${
                  i === index ? 'text-ember' : 'text-bone/80'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* ── main copy column ─────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col px-6 pt-28 sm:px-10 md:px-12 md:pt-32 lg:px-16">
        {/* headline + supporting copy, anchored low over the photo */}
        <div data-hero-copy className="mb-12 mt-auto max-w-4xl pt-16 lg:mb-16">
          {/* brand eyebrow — sits directly with the headline it introduces */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="mb-6 flex items-center gap-4"
          >
            <motion.span variants={soft} className="h-px w-12 bg-accent-soft" />
            <motion.span
              variants={soft}
              className="font-arimo text-[12px] font-bold uppercase tracking-[0.24em] text-accent-soft"
            >
              {hero.eyebrow}
            </motion.span>
          </motion.div>

          <motion.h1
            variants={container}
            initial="hidden"
            animate="show"
            className="font-rubik font-bold leading-[0.96] tracking-[-0.03em] text-bone"
            style={{ fontSize: 'clamp(2.75rem, 7.5vw, 7rem)' }}
          >
            <span className="reveal-mask">
              <motion.span variants={line} className="block">
                {renderEmphasis(hero.heading)}
              </motion.span>
            </span>
          </motion.h1>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="mt-9 flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-12"
          >
            <motion.p variants={soft} className="max-w-md font-arimo text-[15px] leading-relaxed text-bone/75">
              {hero.paragraph}
            </motion.p>
            <motion.div variants={soft}>
              <PillButton href={hero.ctaHref} variant="prime" className="shrink-0 font-arimo">
                {hero.ctaLabel}
              </PillButton>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ── simple bottom bar — place, type, index, and controls on one line ── */}
      <motion.div
        variants={soft}
        initial="hidden"
        animate="show"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="relative z-10 border-t border-white/15"
      >
        {/* slim cycle progress riding the top hairline */}
        <span aria-hidden className="absolute inset-x-0 -top-px block h-[2px] overflow-hidden">
          <motion.span
            key={`${index}-${paused}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: paused ? 0 : 1 }}
            transition={{ duration: paused ? 0 : SLIDE_MS / 1000, ease: 'linear' }}
            className="block h-full w-full origin-left bg-ember"
          />
        </span>

        <div className="flex items-center justify-between gap-6 px-6 py-5 sm:px-10 lg:px-16">
          {/* current property */}
          <span className="flex items-baseline gap-3">
            <span className="truncate font-rubik text-xl font-bold text-bone md:text-2xl">
              {active.place}
            </span>
            <span className="hidden font-arimo text-[11px] font-bold uppercase tracking-[0.2em] text-bone/50 sm:block">
              {active.kind}
            </span>
          </span>

          <div className="flex shrink-0 items-center gap-5">
            <span className="font-rubik text-base font-bold tabular-nums md:text-lg">
              <span className="text-ember">{String(index + 1).padStart(2, '0')}</span>
              <span className="text-bone/40"> / {String(slides.length).padStart(2, '0')}</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous property"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-bone transition-colors hover:border-ember/70 hover:text-ember"
              >
                <ArrowRight className="size-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next property"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-bone transition-colors hover:border-ember/70 hover:text-ember"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
