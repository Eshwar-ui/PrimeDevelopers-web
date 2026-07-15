import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import PillButton from './PillButton'
import SectionHeader from './SectionHeader'
import { useSectionNav } from '../hooks/useSectionNav'
import watermark from '../assets/watermark-p.svg'

const stats = [
  { value: 9, label: 'Years of Experience' },
  { value: 10, label: 'Projects Completed' },
  { value: 5, label: 'Team Collaborations' },
  { value: 3, label: 'Industry Awards Won' },
]

export default function About() {
  const scope = useRef(null)
  const go = useSectionNav()

  useGSAP(
    () => {
      // Reveal text blocks on scroll.
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

      // The P monogram pops in, then turns + drifts as the section scrolls
      // through. Each effect owns a separate transform property so they compose.
      const wm = scope.current.querySelector('[data-watermark]')
      gsap.fromTo(
        wm,
        { autoAlpha: 0, scale: 0.85 },
        {
          autoAlpha: 0.28,
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
      className="relative overflow-hidden bg-bone px-6 py-20 md:px-[75px] md:py-24"
    >
      {/* Large P monogram — floats upper-right, out of flow so it doesn't
          stretch the section height. */}
      <img
        src={watermark}
        alt=""
        data-watermark
        className="pointer-events-none absolute -top-4 right-0 z-0 hidden w-[44%] max-w-none opacity-0 lg:block"
      />

      <SectionHeader title="Ethos" className="relative z-10 mb-10" />

      {/* Narrative */}
      <div className="relative z-10 flex max-w-[560px] flex-col gap-8">
        <p
          data-fade
          className="font-display text-2xl font-medium leading-[1.25] tracking-[-0.01em] text-ink md:text-[30px]"
        >
          Experienced professionals crafting iconic properties across the Texan landscape.
        </p>

        <div data-fade className="flex max-w-[520px] flex-col gap-6 font-body text-base leading-relaxed text-muted">
          <p>
            Since 2017, Prime Developer has grown into one of Texas&apos;s most active real estate
            developers — owning and operating iconic commercial and residential properties in a
            dynamic, fast-moving market.
          </p>
          <p>
            Our team pairs a proven track record in large-scale, complex development with a
            hands-on approach to investment — from permitting through handover, every detail
            engineered to last.
          </p>
        </div>

        <div data-fade className="w-fit">
          <PillButton
            href="/about"
            variant="ink"
            onClick={(e) => {
              e.preventDefault()
              go('/about')
            }}
          >
            About Prime Developers
          </PillButton>
        </div>
      </div>

      {/* Stats band — hairline-divided */}
      <div
        data-stats
        className="relative z-10 mt-16 grid grid-cols-2 gap-px border-y border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-4"
      >
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-3 bg-bone px-1 py-9 md:px-8">
            <span
              data-count={s.value}
              className="font-display font-light leading-none text-ink text-[var(--text-stat)]"
            >
              0+
            </span>
            <span className="eyebrow text-accent">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
