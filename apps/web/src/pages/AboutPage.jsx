import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import SectionHeader from '../components/SectionHeader'
import PrimePill from '../components/PrimePill'
import Parallax from '../components/Parallax'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import { renderEmphasis } from '../lib/emphasis'
import watermark from '../assets/watermark-p.svg'

// data-band="light" on every light section — see the note in NewsPostPage. The
// closing photographic band deliberately omits it: it is the one dark surface
// left on the page, and the navbar should keep its light chrome over it.

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
      {/* The saffron radial that used to sit behind this is gone. It was there
          to keep a near-black ground from reading as flat; over white the same
          wash goes muddy, and the redesign's heroes carry no tint at all. */}
      <section
        id="about-hero"
        data-band="light"
        className="bg-surface px-6 pb-20 pt-32 md:px-12 md:pb-28 md:pt-40"
      >
        <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div data-hero>
            <span className="block font-body text-[14px] uppercase tracking-[0.14em] text-accent">
              {p.heroEyebrow}
            </span>
            <h1 className="mt-5 max-w-[16ch] font-display text-[2.25rem] font-bold uppercase leading-[1.03] tracking-tight text-content md:text-[3.4rem]">
              {renderEmphasis(p.heroHeading)}
            </h1>
            <p className="mt-7 max-w-[46ch] font-body text-[16px] leading-[1.7] text-content/70">
              {p.heroParagraph}
            </p>
          </div>

          <div
            data-hero-img
            className="relative h-[340px] overflow-hidden rounded-2xl border border-[var(--color-line)] md:h-[480px]"
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
          </div>
        </div>
      </section>

      {/* ── The Firm — narrative + stats ─────────────────────── */}
      <section
        data-band="light"
        className="relative overflow-hidden bg-surface px-6 py-24 md:px-12 md:py-32"
      >
        {/* Flipped per theme rather than fixed. brightness-0 forces the mark to
            black whatever the source SVG's own fill is — right on white, and
            invisible on the dark ground, where it has to be inverted back to
            white instead. A single treatment cannot serve both. */}
        <img
          src={watermark}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-10 right-0 z-0 hidden w-[38%] max-w-none opacity-[0.04] brightness-0 lg:block dark:opacity-[0.05] dark:invert"
        />

        <SectionHeader index="01" title="The Firm" tone="ink" className="relative z-10 mb-14" />

        <div className="relative z-10 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <h3
            data-reveal
            className="max-w-[14ch] font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]"
          >
            {renderEmphasis(p.firmHeading)}
          </h3>

          <div
            data-reveal
            className="flex max-w-[52ch] flex-col gap-6 font-body text-[16px] leading-[1.7] text-content/70"
          >
            <p>{p.firmParagraph1}</p>
            <p>{p.firmParagraph2}</p>
            <div className="mt-2 w-fit">
              <PrimePill
                href="/#properties"
                onClick={(e) => {
                  e.preventDefault()
                  go('#properties')
                }}
              >
                {p.ctaLabel}
              </PrimePill>
            </div>
          </div>
        </div>

        {/* Stats band. Hairlines are a one-pixel gap over a ruled ground rather
            than per-cell borders, matching the homepage band — the same markup
            then divides cleanly at two columns and at four. */}
        <div
          data-stats
          className="relative z-10 mt-20 grid grid-cols-2 gap-px border-y border-[var(--color-line)] bg-line md:grid-cols-4"
        >
          {p.stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-3 bg-surface px-1 py-9 md:px-8">
              {/* text-content, not the saffron this used to be: the redesign
                  sets numerals in ink and gives the accent to the label, and
                  saffron on white measures about 1.9:1 besides. */}
              <span data-count={s.value} className="numeral text-stat text-content">
                0+
              </span>
              <span className="font-body text-[13px] uppercase tracking-[0.14em] text-accent">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Principles — Mission / Leadership / Vision ───────── */}
      {/* surface-alt rather than the dark slab it was: this is the recessed
          band between two white sections, which is the job that slab was
          really doing. */}
      <section data-band="light" className="bg-surface-alt px-6 py-24 md:px-12 md:py-32">
        <SectionHeader index="02" title="Principles" tone="ink" className="mb-16" />

        <div className="border-t border-[var(--color-line)]">
          {p.principles.map((pr, i) => (
            <div
              key={pr.title}
              data-reveal
              className="grid gap-6 border-b border-[var(--color-line)] py-12 md:grid-cols-[auto_1fr] md:gap-16 md:py-16"
            >
              <div className="flex items-baseline gap-5 md:w-[18rem]">
                <span className="numeral text-sm text-accent">0{i + 1}</span>
                <h3 className="font-display text-3xl font-bold tracking-[-0.01em] text-content md:text-4xl">
                  {pr.title}
                </h3>
              </div>
              <p className="max-w-[64ch] font-body text-[16px] leading-[1.7] text-content/70 md:text-[17px]">
                {pr.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Founders ─────────────────────────────────────────── */}
      <section data-band="light" className="bg-surface px-6 py-24 md:px-12 md:py-32">
        <SectionHeader index="03" title="Founders" tone="ink" className="mb-16" />

        <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-line md:grid-cols-2">
          {p.founders.map((f) => (
            <div
              key={f.name}
              data-reveal
              className="group flex flex-col bg-surface transition-colors duration-300 hover:bg-surface-alt"
            >
              <div className="relative h-[360px] overflow-hidden bg-surface-alt md:h-[480px]">
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center font-display text-[6rem] font-bold leading-none text-content/10 md:text-[8rem]"
                >
                  {f.name.charAt(0)}
                </span>
                {f.image && (
                  <img
                    src={sized(f.image, 'card')}
                    alt={f.name}
                    loading="lazy"
                    decoding="async"
                    // Full colour, scale-only hover — the grayscale-to-colour
                    // reveal is gone site-wide in the redesign.
                    className="relative h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                )}
              </div>

              <div className="p-8 md:p-10">
                <h3 className="font-display text-2xl font-bold tracking-[-0.01em] text-content md:text-3xl">
                  {f.name}
                </h3>
                <p className="mt-2.5 font-body text-[13px] uppercase tracking-[0.14em] text-accent">
                  {f.role}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p
          data-reveal
          className="mt-14 max-w-[62ch] font-body text-[16px] leading-[1.7] text-content/70"
        >
          {p.foundersClosing}
        </p>
      </section>

      {/* ── Closing image band ───────────────────────────────── */}
      {/* Stays dark, and deliberately carries no data-band: it is a photograph
          under a heavy scrim, not a surface, and the type over it is white in
          either theme. */}
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
        <div className="relative flex h-full items-center px-6 md:px-12">
          <h2 className="max-w-[20ch] font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-white md:text-[3rem]">
            {renderEmphasis(p.closingHeading)}
          </h2>
        </div>
      </section>
    </div>
  )
}
