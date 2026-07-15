import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import SectionHeader from './SectionHeader'

const testimonials = [
  {
    quote:
      'Prime carried our mixed-use development from permitting through handover without a single missed milestone. The build quality speaks for itself.',
    name: 'Marisol Treviño',
    role: 'Managing Partner · Balcones Capital',
  },
  {
    quote:
      'We have co-developed three properties with Prime. They underwrite conservatively and execute aggressively — a rare combination in this market.',
    name: 'Dov Ackerman',
    role: 'Principal · Lometa Holdings',
  },
  {
    quote:
      'Their team treated our retail center like their own asset. We reached 94% occupancy within eight months of delivery.',
    name: 'Priya Raghunathan',
    role: 'Director of Development · Verdanta Group',
  },
  {
    quote:
      'Straight-talking, detail-obsessed, dependable. Prime is the first call we make for ground-up commercial work in Central Texas.',
    name: 'Cael Ferro',
    role: 'VP Acquisitions · Hillstead Partners',
  },
]

const ROTATE_MS = 6500

export default function Testimonials() {
  const [index, setIndex] = useState(0)

  // Auto-rotate; any manual selection resets the timer via the effect dep.
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % testimonials.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [index])

  const active = testimonials[index]

  return (
    <section
      id="testimonials"
      className="bg-ink px-6 py-24 text-bone md:px-[75px] md:py-32"
    >
      <SectionHeader title="Voices" tone="inv" className="mb-16" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="grid items-start gap-12 lg:grid-cols-[1.55fr_1fr] lg:gap-20"
      >
        {/* Rotating featured quote */}
        <div className="relative min-h-[320px] md:min-h-[360px]">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-10 -left-2 select-none font-display text-[8rem] leading-none text-accent-soft/30"
          >
            &ldquo;
          </span>
          {/* Keyed remount: new quote fades in when index changes. */}
          <motion.blockquote
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
            className="absolute inset-0"
          >
            <p className="max-w-[42ch] font-display text-2xl font-medium leading-[1.32] tracking-[-0.01em] md:text-[34px]">
              {active.quote}
            </p>
            <footer className="mt-8">
              <p className="font-display text-lg font-bold">{active.name}</p>
              <p className="eyebrow mt-1.5 text-accent-soft">{active.role}</p>
            </footer>
          </motion.blockquote>
        </div>

        {/* Client selector */}
        <ul className="flex flex-col border-y border-[var(--color-line-inv)]">
          {testimonials.map((t, i) => {
            const isActive = i === index
            return (
              <li key={t.name} className="border-b border-[var(--color-line-inv)] last:border-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  className="group flex w-full items-center gap-4 py-5 text-left"
                >
                  <span className={`eyebrow ${isActive ? 'text-accent-soft' : 'text-bone/30'}`}>
                    0{i + 1}
                  </span>
                  <span
                    className={`font-display text-lg font-bold transition-colors duration-300 ${
                      isActive ? 'text-bone' : 'text-bone/40 group-hover:text-bone/75'
                    }`}
                  >
                    {t.name}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="testi-active"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-soft"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </motion.div>
    </section>
  )
}
