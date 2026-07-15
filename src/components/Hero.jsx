import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import PillButton from './PillButton'
import s1 from '../assets/hero/slide-1-enhanced.png'
import s2 from '../assets/hero/slide-2-enhanced.png'
import s3 from '../assets/hero/slide-3-enhanced.png'
import s4 from '../assets/hero/slide-4-enhanced.png'
import s5 from '../assets/hero/slide-5-enhanced.png'
import s6 from '../assets/hero/slide-6-enhanced.png'

const slides = [s1, s2, s3, s4, s5, s6]
const SLIDE_MS = 5000

// Vertical slide: forward advances bottom→top (new enters from below, old
// exits up); reverse goes the opposite way.
const slideVariants = {
  enter: (dir) => ({ y: dir >= 0 ? '100%' : '-100%' }),
  center: { y: 0 },
  exit: (dir) => ({ y: dir >= 0 ? '-100%' : '100%' }),
}

// Staggered entrance for the hero copy.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
}
const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
}

export default function Hero() {
  const scope = useRef(null)
  const [[index, dir], setPage] = useState([0, 1])

  // Auto-advance forward.
  useEffect(() => {
    const id = setInterval(() => setPage(([i]) => [(i + 1) % slides.length, 1]), SLIDE_MS)
    return () => clearInterval(id)
  }, [])

  const goTo = (n) => setPage(([i]) => [n, n >= i ? 1 : -1])

  // Cursor-following "Scroll" badge, shown while hovering the hero.
  const [hovering, setHovering] = useState(false)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 350, damping: 30, mass: 0.4 })
  const sy = useSpring(my, { stiffness: 350, damping: 30, mass: 0.4 })
  const onMove = (e) => {
    const r = scope.current.getBoundingClientRect()
    mx.set(e.clientX - r.left)
    my.set(e.clientY - r.top)
  }

  useGSAP(
    () => {
      gsap.to('[data-hero-img]', {
        yPercent: 18,
        ease: 'none',
        scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.to('[data-hero-copy]', {
        yPercent: -40,
        opacity: 0.4,
        ease: 'none',
        scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: true },
      })
    },
    { scope }
  )

  return (
    <section
      id="hero"
      ref={scope}
      onMouseMove={onMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="relative min-h-[100dvh] w-full overflow-hidden"
    >
      {/* Sliding background carousel (parallax plane) */}
      <div data-hero-img className="absolute inset-x-0 top-[-10%] h-[120%] w-full">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={index}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
            className="absolute inset-0"
          >
            <img
              src={slides[index]}
              alt=""
              className="hero-slide-active h-full w-full object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* sky-blue radial glow anchored bottom-left, as in the design */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 0% 100%, rgba(0,155,222,0.55) 0%, rgba(0,155,222,0) 100%)',
        }}
      />

      <motion.div
        data-hero-copy
        variants={container}
        initial="hidden"
        animate="show"
        className="absolute inset-x-6 bottom-12 z-10 flex flex-col items-start gap-6 md:inset-x-11 md:flex-row md:items-end md:justify-between"
      >
        <div className="max-w-[640px] text-bone">
          <motion.span
            variants={item}
            className="eyebrow mb-4 block text-bone/70"
          >
            Prime Developers <span className="text-accent-soft">—</span> Est. 2017
          </motion.span>
          <motion.h1
            variants={item}
            className="font-display font-light uppercase leading-[1.05] tracking-[0.02em] text-[var(--text-display)]"
          >
            We build the
            <br />
            landmarks of Texas
          </motion.h1>
          <motion.p variants={item} className="mt-5 max-w-md font-body text-base text-bone/75">
            Pioneering real estate projects that redefine the Texan landscape.
          </motion.p>
        </div>

        <motion.div variants={item} className="shrink-0">
          <PillButton href="#projects" variant="accent">
            View Projects
          </PillButton>
        </motion.div>
      </motion.div>

      {/* Carousel indicators */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? 'w-6 bg-bone' : 'w-1.5 bg-bone/50 hover:bg-bone/80'
            }`}
          />
        ))}
      </div>

      {/* Cursor-following scroll indicator (hover only, desktop pointers) */}
      <motion.div
        aria-hidden
        style={{ left: sx, top: sy }}
        className="pointer-events-none absolute z-20 hidden -translate-x-1/2 -translate-y-1/2 md:block"
      >
        <AnimatePresence>
          {hovering && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-full border border-bone/70 text-bone backdrop-blur-[2px]"
            >
              <span className="eyebrow text-[0.6rem]">Scroll</span>
              <motion.span
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-lg leading-none"
              >
                ↓
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
