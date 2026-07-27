import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import PillButton from './PillButton'
import SectionHeader from './SectionHeader'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import watermark from '../assets/watermark-p.svg'

export default function About() {
  const { heading, paragraph1, paragraph2, ctaLabel, stats } = useSection('about_home')
  const scope = useRef(null)
  const go = useSectionNav()

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

      // The P monogram fades in, then turns + drifts as the section passes.
      const wm = scope.current.querySelector('[data-watermark]')
      gsap.fromTo(
        wm,
        { autoAlpha: 0, scale: 0.85 },
        {
          autoAlpha: 0.06,
          scale: 1,
          duration: 1.4,
          ease: 'power3.out',
          scrollTrigger: { trigger: scope.current, start: 'top 80%' },
        }
      )
      gsap.fromTo(
        wm,
        { rotate: -42 },
        {
          rotate: -4,
          ease: 'none',
          scrollTrigger: { trigger: scope.current, start: 'top bottom', end: 'bottom top', scrub: true },
        }
      )
      gsap.fromTo(
        wm,
        { yPercent: 8 },
        {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: { trigger: scope.current, start: 'top bottom', end: 'bottom top', scrub: true },
        }
      )
    },
    { scope }
  )

  return (
    <section
      id="about"
      ref={scope}
      className="relative overflow-hidden bg-void px-6 py-24 text-bone md:px-[75px] md:py-32"
    >
      {/* Large P monogram — inverted to read on the dark ground. */}
      <img
        src={watermark}
        alt=""
        data-watermark
        className="pointer-events-none absolute -top-4 right-0 z-0 hidden w-[44%] max-w-none opacity-0 invert lg:block"
      />

      <SectionHeader index="01" title="Ethos" className="relative z-10 mb-12" />

      {/* Narrative */}
      <div className="relative z-10 flex max-w-[720px] flex-col gap-9">
        <h3
          data-fade
          className="font-display text-[2rem] font-light leading-[1.08] tracking-[-0.015em] text-bone md:text-h2"
        >
          {renderEmphasis(heading)}
        </h3>

        <div
          data-fade
          className="flex max-w-[540px] flex-col gap-6 font-body text-base leading-relaxed text-bone/60"
        >
          <p>{paragraph1}</p>
          <p>{paragraph2}</p>
        </div>

        <div data-fade className="w-fit">
          <PillButton
            href="/about"
            variant="bone"
            onClick={(e) => {
              e.preventDefault()
              go('/about')
            }}
          >
            {ctaLabel}
          </PillButton>
        </div>
      </div>

      {/* Stats band — hairline-divided on dark, ember numerals */}
      <div
        data-stats
        className="relative z-10 mt-20 grid grid-cols-2 gap-px border-y border-[var(--color-line-inv)] bg-[var(--color-line-inv)] md:grid-cols-4"
      >
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-3 bg-void px-1 py-9 md:px-8">
            <span
              data-count={s.value}
              className="numeral text-ember text-stat"
            >
              0+
            </span>
            <span className="eyebrow text-bone/45">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
