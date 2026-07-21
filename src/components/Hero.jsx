import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import PillButton from './PillButton'
import ArrowRight from './ArrowRight'
import watermark from '../assets/watermark-p.svg'
import s1 from '../assets/hero/slide-1-enhanced.png'
import s2 from '../assets/hero/slide-2-enhanced.png'
import s3 from '../assets/hero/slide-3-enhanced.png'
import s4 from '../assets/hero/slide-4-enhanced.png'
import s5 from '../assets/hero/slide-5-enhanced.png'
import s6 from '../assets/hero/slide-6-enhanced.png'

const slides = [
  { src: s1, place: 'Lewisville', kind: 'Mixed-use' },
  { src: s2, place: 'Leander', kind: 'Residential' },
  { src: s3, place: 'Cedar Park', kind: 'Commercial' },
  { src: s4, place: 'Liberty Hill', kind: 'Master-planned' },
  { src: s5, place: 'Austin', kind: 'High-rise' },
  { src: s6, place: 'Dallas–Fort Worth', kind: 'Retail' },
]
const SLIDE_MS = 6000

// Full-bleed background cross-fade — slower, heavier drift than the showcase card.
const bgVariants = {
  enter: { opacity: 0, scale: 1.06 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.0 },
}

// Showcase card — swings in around the Y axis like a plaque pivoting into frame.
const cardVariants = {
  enter: (dir) => ({ opacity: 0, rotateY: dir >= 0 ? 60 : -60, scale: 0.94 }),
  center: { opacity: 1, rotateY: 0, scale: 1 },
  exit: (dir) => ({ opacity: 0, rotateY: dir >= 0 ? -60 : 60, scale: 0.94 }),
}

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
  const scope = useRef(null)
  const [[index, dir], setPage] = useState([0, 1])
  const [paused, setPaused] = useState(false)

  const jump = (n) => setPage(([i]) => [n, n >= i ? 1 : -1])
  const next = () => setPage(([i]) => [(i + 1) % slides.length, 1])
  const prev = () => setPage(([i]) => [(i - 1 + slides.length) % slides.length, -1])

  // Auto-advance; resetting on `index` gives a full dwell after a manual pick,
  // and hovering the card pauses the cycle so selection stays deliberate.
  useEffect(() => {
    if (paused) return
    const id = setTimeout(next, SLIDE_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused])

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

  // Tilt-toward-cursor — motion values drive a spring so the card settles
  // back to flat the instant the pointer leaves.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const tiltX = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), { stiffness: 300, damping: 30 })
  const tiltY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 300, damping: 30 })

  const handleCardMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - rect.left) / rect.width - 0.5)
    py.set((e.clientY - rect.top) / rect.height - 0.5)
  }
  const handleCardLeave = () => {
    px.set(0)
    py.set(0)
    setPaused(false)
  }

  const active = slides[index]

  return (
    <section
      id="hero"
      ref={scope}
      className="relative min-h-[100dvh] w-full overflow-hidden bg-ink text-bone"
    >
      {/* ── Full-bleed cinematic backdrop ─────────────────────────── */}
      <div data-hero-bg className="absolute inset-0">
        <AnimatePresence initial={false}>
          <motion.img
            key={index}
            src={active.src}
            alt=""
            variants={bgVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1] }}
            className="hero-slide-active absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        {/* legibility scrims — heavier lower-left where copy sits, thin overall wash */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/20 to-transparent" />
        <div className="absolute inset-0 bg-ink/10" />
      </div>

      {/* faint brand P watermark, flattened to a soft white silhouette on the dark backdrop */}
      <img
        src={watermark}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 w-[46vw] max-w-[620px] opacity-[0.05] brightness-0 invert"
      />

      {/* ── oversized poster-scale wordmark — bleeds off the frame, blended into the photo's own
          tones rather than sitting as a flat watermark. Sits above the backdrop, below the copy. ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[6%] z-[1] select-none overflow-hidden text-center sm:top-[9%]"
      >
        <span
          className="mix-blend-overlay inline-block font-rubik font-black leading-none text-white"
          style={{ fontSize: 'clamp(5rem, 19vw, 17rem)', letterSpacing: '-0.04em' }}
        >
          TEXAS
        </span>
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 pb-6 pt-28 sm:px-10 md:pt-32 lg:px-16">
        {/* ── eyebrow ────────────────────────────────────────────── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex items-center gap-4"
        >
          <motion.span variants={soft} className="h-px w-12 bg-accent-soft" />
          <motion.span
            variants={soft}
            className="font-arimo text-[12px] font-bold uppercase tracking-[0.24em] text-accent-soft"
          >
            Prime Developer — Est. 2017
          </motion.span>
        </motion.div>

        {/* ── floating glass stat card — riffs on the brand's saffron energy accent ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-6 top-28 hidden w-[15rem] flex-col gap-1 rounded-2xl border border-white/15 bg-white/10 p-5 text-bone backdrop-blur-xl sm:right-10 md:top-32 lg:right-16 lg:flex"
        >
          {/* corner-bracket accent — quieter than a full border, echoes the brand's architectural-plan motif */}
          <span aria-hidden className="absolute right-3 top-3 size-3 border-r-2 border-t-2 border-ember/70" />
          <span className="font-rubik text-4xl font-bold text-ember">10+</span>
          <span className="font-arimo text-[12px] font-bold uppercase leading-snug tracking-[0.12em] text-bone/70">
            Developments live across Dallas–Fort Worth and Austin
          </span>
        </motion.div>

        {/* ── headline + project showcase, anchored low over the photo ───────────── */}
        <div
          data-hero-copy
          className="mt-auto flex flex-col gap-10 pb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:pb-14"
        >
          <div className="max-w-3xl">
            <motion.h1
              variants={container}
              initial="hidden"
              animate="show"
              className="font-rubik font-bold leading-[0.96] tracking-[-0.03em] text-bone"
              style={{ fontSize: 'clamp(2.75rem, 7vw, 6.5rem)' }}
            >
              {[
                <>We build the</>,
                <>
                  <span className="text-accent-soft">landmarks</span> of
                </>,
                <>Texas</>,
              ].map((frag, i) => (
                <span key={i} className="reveal-mask">
                  <motion.span variants={line} className="block">
                    {frag}
                  </motion.span>
                </span>
              ))}
            </motion.h1>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between lg:block lg:space-y-7"
            >
              <motion.p variants={soft} className="max-w-md font-arimo text-[15px] leading-relaxed text-bone/75">
                Retail in Cedar Park. Flex space in Leander. Open lots in
                Liberty Hill. One team, start to finish — acquisition,
                design, and handover.
              </motion.p>
              <motion.div variants={soft}>
                <PillButton href="#projects" variant="prime" className="shrink-0 font-arimo">
                  View Projects
                </PillButton>
              </motion.div>
            </motion.div>
          </div>

          {/* ── 3D tilt project showcase — single card, flips between projects ── */}
          <motion.div
            variants={soft}
            initial="hidden"
            animate="show"
            className="mx-auto w-full max-w-[19rem] shrink-0 lg:mx-0"
          >
            <div style={{ perspective: 1400 }}>
              <motion.div
                onMouseMove={handleCardMove}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={handleCardLeave}
                style={{ rotateX: tiltX, rotateY: tiltY }}
                className="group"
              >
                <div className="relative aspect-[4/5] cursor-pointer overflow-hidden rounded-3xl border border-white/15 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.65)]">
                  <AnimatePresence custom={dir} initial={false}>
                    <motion.div
                      key={index}
                      custom={dir}
                      variants={cardVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
                      className="absolute inset-0"
                    >
                      <img src={active.src} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/15 to-transparent" />
                    </motion.div>
                  </AnimatePresence>

                  {/* kind tag */}
                  <span className="absolute left-4 top-4 z-10 rounded-full bg-accent px-3 py-1 font-arimo text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                    {active.kind}
                  </span>

                  {/* place + index, bottom overlay */}
                  <div className="absolute inset-x-0 bottom-0 z-10 p-5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-rubik text-2xl font-bold tabular-nums text-ember">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="font-arimo text-[11px] text-bone/50">/ {String(slides.length).padStart(2, '0')}</span>
                    </div>
                    <h3 className="mt-0.5 font-rubik text-2xl font-bold text-bone">{active.place}</h3>
                    <span className="relative mt-3 block h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                      <motion.span
                        key={`${index}-${paused}`}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: paused ? 0 : 1 }}
                        transition={{ duration: paused ? 0 : SLIDE_MS / 1000, ease: 'linear' }}
                        className="block h-full w-full origin-left rounded-full bg-ember"
                      />
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* controls — prev/next + direct-jump dots */}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous project"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-bone transition-colors hover:border-white/40 hover:bg-white/10"
              >
                <ArrowRight className="size-4 rotate-180" />
              </button>
              <div className="flex items-center gap-1.5">
                {slides.map((slide, i) => (
                  <button
                    key={slide.place}
                    type="button"
                    onClick={() => jump(i)}
                    aria-label={`Show ${slide.place}`}
                    aria-current={i === index ? 'true' : undefined}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === index ? 'w-4 bg-accent-soft' : 'w-1.5 bg-bone/25 hover:bg-bone/50'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={next}
                aria-label="Next project"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-bone transition-colors hover:border-white/40 hover:bg-white/10"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* scroll cue */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.8 }}
        className="pointer-events-none absolute bottom-6 right-6 z-10 hidden items-center gap-3 text-bone/55 sm:right-10 lg:flex"
      >
        <span className="font-arimo text-[11px] font-bold uppercase tracking-[0.24em]">Scroll</span>
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="text-base leading-none"
        >
          ↓
        </motion.span>
      </motion.div>
    </section>
  )
}
