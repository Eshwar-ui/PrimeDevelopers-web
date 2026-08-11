import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import SectionHeader from '../components/SectionHeader'
import PillButton from '../components/PillButton'
import Parallax from '../components/Parallax'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import { renderEmphasis } from '../lib/emphasis'
import watermark from '../assets/watermark-p.svg'

export default function AboutPage() {
  const p = useSection('about_page')
  const scope = useRef(null)
  const go = useSectionNav()

  useGSAP(
    () => {
      gsap.from('[data-hero] > *', {
        y: 44,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.12,
      })
      gsap.from('[data-hero-img]', {
        scale: 1.12,
        opacity: 0,
        duration: 1.3,
        ease: 'power3.out',
      })

      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 82%' },
        })
      })

      gsap.utils.toArray('[data-count]').forEach((el, i) => {
        const end = Number(el.dataset.count)
        const obj = { v: 0 }
        gsap
          .timeline({
            delay: i * 0.12,
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
    },
    { scope }
  )

  return (
    <div ref={scope}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="about-hero"
        className="relative overflow-hidden bg-void px-6 pb-20 pt-36 text-bone md:px-[75px] md:pb-28 md:pt-48"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 55% at 0% 100%, rgba(252,164,46,0.16) 0%, rgba(252,164,46,0) 100%)',
          }}
        />

        <div className="relative grid items-end gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div data-hero>
            <span className="eyebrow mb-6 flex items-center gap-4 text-bone/70">
              <span className="h-px w-10 bg-accent-soft" />
              {p.heroEyebrow}
            </span>
            <h1 className="font-display text-display font-light leading-[0.98] tracking-[-0.02em]">
              {renderEmphasis(p.heroHeading)}
            </h1>
            <p className="mt-8 max-w-[46ch] font-body text-lg leading-relaxed text-bone/65">
              {p.heroParagraph}
            </p>
          </div>

          <div
            data-hero-img
            className="relative h-[340px] overflow-hidden rounded-3xl border border-[var(--color-line-inv)] md:h-[480px]"
          >
            {p.heroImage && (
              <img
                src={p.heroImage}
                alt="A Prime Developers property"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(26,26,26,0.5))' }}
            />
          </div>
        </div>
      </section>

      {/* ── The Firm — narrative + stats ─────────────────────── */}
      <section className="relative overflow-hidden bg-void px-6 py-24 text-bone md:px-[75px] md:py-32">
        <img
          src={watermark}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-10 right-0 z-0 hidden w-[38%] max-w-none opacity-[0.05] invert lg:block"
        />

        <SectionHeader index="01" title="The Firm" className="relative z-10 mb-14" />

        <div className="relative z-10 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <h3
            data-reveal
            className="max-w-[14ch] font-display text-h2 font-light leading-[1.04] tracking-[-0.02em] text-bone"
          >
            {renderEmphasis(p.firmHeading)}
          </h3>

          <div
            data-reveal
            className="flex max-w-[52ch] flex-col gap-6 font-body text-base leading-relaxed text-bone/60"
          >
            <p>{p.firmParagraph1}</p>
            <p>{p.firmParagraph2}</p>
            <div className="mt-2 w-fit">
              <PillButton
                href="/#properties"
                variant="bone"
                onClick={(e) => {
                  e.preventDefault()
                  go('#properties')
                }}
              >
                {p.ctaLabel}
              </PillButton>
            </div>
          </div>
        </div>

        {/* Stats band */}
        <div
          data-stats
          className="relative z-10 mt-20 grid grid-cols-2 gap-px border-y border-[var(--color-line-inv)] bg-[var(--color-line-inv)] md:grid-cols-4"
        >
          {p.stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-3 bg-void px-1 py-9 md:px-8">
              <span data-count={s.value} className="numeral text-ember text-stat">
                0+
              </span>
              <span className="eyebrow text-bone/45">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Principles — Mission / Leadership / Vision ───────── */}
      <section className="bg-ink px-6 py-24 text-bone md:px-[75px] md:py-32">
        <SectionHeader index="02" title="Principles" tone="inv" className="mb-16" />

        <div className="border-t border-[var(--color-line-inv)]">
          {p.principles.map((pr, i) => (
            <div
              key={pr.title}
              data-reveal
              className="grid gap-6 border-b border-[var(--color-line-inv)] py-12 md:grid-cols-[auto_1fr] md:gap-16 md:py-16"
            >
              <div className="flex items-baseline gap-5 md:w-[18rem]">
                <span className="numeral text-sm text-ember">0{i + 1}</span>
                <h3 className="font-display text-3xl font-medium tracking-[-0.01em] md:text-4xl">
                  {pr.title}
                </h3>
              </div>
              <p className="max-w-[64ch] font-body text-base leading-relaxed text-bone/60 md:text-lg">
                {pr.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Founders — light intermission ────────────────────── */}
      <section data-band="light" className="bg-bone px-6 py-24 text-ink md:px-[75px] md:py-32">
        <SectionHeader index="03" title="Founders" tone="ink" className="mb-16" />

        <div className="grid gap-px overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-2">
          {p.founders.map((f) => (
            <div
              key={f.name}
              data-reveal
              className="group flex flex-col bg-bone transition-colors duration-300 hover:bg-bone-deep"
            >
              <div className="relative h-[360px] overflow-hidden bg-bone-deep md:h-[480px]">
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center font-display text-[6rem] font-light leading-none text-ink/10 md:text-[8rem]"
                >
                  {f.name.charAt(0)}
                </span>
                {f.image && (
                  <img
                    src={sized(f.image, 'card')}
                    alt={f.name}
                    loading="lazy"
                    decoding="async"
                    className="relative h-full w-full object-cover object-top grayscale transition-all duration-700 ease-out group-hover:scale-[1.03] group-hover:grayscale-0"
                  />
                )}
              </div>

              <div className="p-8 md:p-10">
                <h3 className="font-display text-2xl font-medium tracking-[-0.01em] text-ink md:text-3xl">
                  {f.name}
                </h3>
                <p className="eyebrow mt-2.5 text-accent">{f.role}</p>
              </div>
            </div>
          ))}
        </div>

        <p data-reveal className="mt-14 max-w-[62ch] font-body text-base leading-relaxed text-muted">
          {p.foundersClosing}
        </p>
      </section>

      {/* ── Closing image band ───────────────────────────────── */}
      <section className="relative h-[64vh] min-h-[440px] overflow-hidden bg-void">
        {p.closingImage && (
          <Parallax speed={0.3} className="absolute inset-0 -top-[15%] h-[130%]">
            <img
              src={p.closingImage}
              alt="Prime Developers landmark"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </Parallax>
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(26,26,26,0.5), rgba(26,26,26,0.85))' }}
        />
        <div className="relative flex h-full items-center px-6 md:px-[75px]">
          <h2 className="font-display text-h2 font-light leading-[1.02] tracking-[-0.02em] text-bone">
            {renderEmphasis(p.closingHeading)}
          </h2>
        </div>
      </section>
    </div>
  )
}
