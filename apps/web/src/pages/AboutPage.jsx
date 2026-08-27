import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import SectionHeader from '../components/SectionHeader'
import PrimePill from '../components/PrimePill'
import Parallax from '../components/Parallax'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import { invertedCorner } from '../lib/notch'
import { renderEmphasis } from '../lib/emphasis'
import watermark from '../assets/watermark-p.svg'

// ScrollTrigger was imported here and never registered — the page worked only
// because Hero/About/Services register it at module scope and share a bundle.
// This page is code-split, so that was a load-order accident waiting to break.
gsap.registerPlugin(ScrollTrigger)

// data-band="light" on every light section — see the note in NewsPostPage. The
// closing photographic band deliberately omits it: it is the one dark surface
// left on the page, and the navbar should keep its light chrome over it.

// The hero bay hangs from the panel's *bottom* edge, so both fillets sweep away
// from the top of their square — the vertical mirror of the homepage hero, whose
// bay hangs from the top and sweeps away from the bottom.
const cornerUp = invertedCorner('100% 0%')

// drop-shadow follows rendered alpha rather than a box, so one filter on the
// group shades every edge of the bay including the two arcs, which no box-shadow
// can trace. Lifted wholesale from the homepage hero so the two read as the same
// object cut from the same material.
const bayShadow = {
  filter: 'drop-shadow(0 -2px 9px var(--edge-shade)) drop-shadow(0 0 1px var(--edge-shade))',
}

export default function AboutPage() {
  const p = useSection('about_page')
  const scope = useRef(null)
  const go = useSectionNav()

  // The bay has to be exactly as wide as the pill it seats, and the pill's label
  // is CMS copy — unknowable up front. A fixed value here would either clip a
  // long label or leave a slot of dead page ground beside a short one. Measured
  // off the live element for that reason; the homepage hero used to do the same
  // against the nav CTA, before it became a full-bleed frame with no bay in it.
  const pillRef = useRef(null)
  const [bayW, setBayW] = useState(0)

  useEffect(() => {
    const el = pillRef.current
    if (!el) return
    const measure = () => setBayW(el.getBoundingClientRect().width)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [p.ctaLabel])

  useGSAP(
    () => {
      gsap.from('[data-hero] > *', {
        y: 44,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.12,
      })
      // On the image rather than the panel: the panel carries the bay, and
      // scaling it would drag the three surface-filled pieces out of register
      // with the edges they are meant to close.
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

  const toProperties = (e) => {
    e.preventDefault()
    go('#properties')
  }

  return (
    <div ref={scope}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      {/* Gutters are the page tokens now, not `md:px-12`. The scale is two
          values by design — a thumb margin and the width the designs draw — and
          the comment on --spacing-gutter-lg calls anything between them "a
          section disagreeing with the page". This page was disagreeing. */}
      <section
        id="about-hero"
        data-band="light"
        className="bg-base px-gutter pb-20 pt-32 text-content [--edge-shade:rgba(18,30,38,0.26)] md:px-gutter-lg md:pb-28 md:pt-40"
      >
        <div className="mx-auto grid max-w-[1560px] items-end gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div data-hero>
            <span className="block font-body text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
              {p.heroEyebrow}
            </span>
            <h1
              className="mt-6 max-w-[15ch] font-display font-bold uppercase leading-[1.03] tracking-tight"
              style={{ fontSize: 'clamp(2.25rem, 4.8vw, 4rem)' }}
            >
              {renderEmphasis(p.heroHeading)}
            </h1>
            <p className="mt-7 max-w-[46ch] font-body text-[16px] leading-[1.7] text-content/70">
              {p.heroParagraph}
            </p>
          </div>

          {/* ── the shaped visual ────────────────────────────────
              A rounded frame with a bay of page ground bitten out of its
              bottom-left, closed at all three corners: the bay carries its own
              convex radius, which makes the reflex corner concave, and an
              inverted corner at each end rounds the panel's bottom and left
              edges where they resume.

              The bay is not ornament — it seats the page's call to action, the
              way the homepage's seats the nav rail and the property hero's
              seats the social buttons. Cutting one to hold nothing would be
              the shape quoting itself. */}
          <div
            className="relative [--notch-h:5.5rem] [--notch-r:28px]"
            style={{ '--notch-w': `calc(${bayW}px + 1.75rem)` }}
          >
            {/* lg:rounded-bl-none — once the bay is cut, the panel's own
                bottom-left corner falls inside it. Left rounded, its arc and
                the inner shadow tracing it show through as a phantom corner. */}
            <div className="relative h-[360px] overflow-hidden rounded-(--notch-r) bg-surface-alt md:h-[520px] lg:rounded-bl-none">
              {p.heroImage && (
                <img
                  data-hero-img
                  src={p.heroImage}
                  alt="A Prime Developers property"
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}

              {/* Its own layer: an inset box-shadow on the panel would paint
                  beneath the image rather than over it. */}
              <span
                aria-hidden
                style={{ boxShadow: 'inset 0 0 22px var(--edge-shade)' }}
                className="pointer-events-none absolute inset-0 rounded-(--notch-r) lg:rounded-bl-none"
              />

              {/* Below lg the column is full-width and the pill drops into
                  normal flow beneath it, so there is nothing for a bay to hold
                  and it is not drawn at all. */}
              <div
                aria-hidden
                style={bayShadow}
                className="pointer-events-none absolute inset-0 hidden lg:block"
              >
                <span className="absolute bottom-0 left-0 h-(--notch-h) w-[min(var(--notch-w),100%)] rounded-tr-(--notch-r) bg-base" />
                {/* Half a pixel of overlap onto the bay — a butt joint against
                    a fractional calc leaves a hairline of image showing. */}
                <span
                  style={cornerUp}
                  className="absolute bottom-0 left-[calc(var(--notch-w)-0.5px)] size-(--notch-r)"
                />
                <span
                  style={cornerUp}
                  className="absolute bottom-[calc(var(--notch-h)-0.5px)] left-0 size-(--notch-r)"
                />
              </div>
            </div>

            {/* One node, two placements — in flow under the panel on small
                screens, seated in the bay from lg. Rendering it twice behind
                responsive visibility would read the label out twice to a screen
                reader and put two identical links in the tab order. */}
            <div
              ref={pillRef}
              className="mt-6 w-fit lg:absolute lg:bottom-0 lg:left-0 lg:mt-0 lg:flex lg:h-(--notch-h) lg:items-center"
            >
              <PrimePill href="/#properties" onClick={toProperties}>
                {p.ctaLabel}
              </PrimePill>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Firm — narrative + stats ─────────────────────── */}
      <section
        data-band="light"
        className="relative overflow-hidden bg-base px-gutter py-24 md:px-gutter-lg md:py-32"
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

        <div className="relative z-10 mx-auto max-w-[1560px]">
          <SectionHeader index="01" title="The Firm" tone="ink" className="mb-14" />

          <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
            <h3
              data-reveal
              className="max-w-[14ch] font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]"
            >
              {renderEmphasis(p.firmHeading)}
            </h3>

            {/* The pill that used to close this column now opens the page, in
                the hero bay. It was the page's only call to action and it sat
                two thirds of the way down, under the second of two paragraphs;
                `ctaLabel` is still read exactly once. */}
            <div
              data-reveal
              className="flex max-w-[52ch] flex-col gap-6 font-body text-[16px] leading-[1.7] text-content/70"
            >
              <p>{p.firmParagraph1}</p>
              <p>{p.firmParagraph2}</p>
            </div>
          </div>

          {/* Stats band. Hairlines are a one-pixel gap over a ruled ground
              rather than per-cell borders, matching the homepage band — the
              same markup then divides cleanly at two columns and at four. */}
          <div
            data-stats
            className="mt-20 grid grid-cols-2 gap-px border-y border-[var(--color-line)] bg-line md:grid-cols-4"
          >
            {p.stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-3 bg-base px-1 py-9 md:px-8">
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
        </div>
      </section>

      {/* ── Principles — Mission / Leadership / Vision ───────── */}
      {/* surface-alt rather than the dark slab it was: this is the recessed
          band between two white sections, which is the job that slab was
          really doing. */}
      <section
        data-band="light"
        className="bg-surface-alt px-gutter py-24 md:px-gutter-lg md:py-32"
      >
        <div className="mx-auto max-w-[1560px]">
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
        </div>
      </section>

      {/* ── Founders ─────────────────────────────────────────── */}
      <section data-band="light" className="bg-base px-gutter py-24 md:px-gutter-lg md:py-32">
        <div className="mx-auto max-w-[1560px]">
          <SectionHeader index="03" title="Founders" tone="ink" className="mb-16" />

          {/* Portraits carry the frame radius and their captions sit on page
              ground beneath them, rather than the pair being welded into one
              hairline-gapped slab. The bay is kept for the hero on purpose —
              the homepage and the property page each cut exactly one, and a
              shape used everywhere stops being a signature. */}
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            {p.founders.map((f) => (
              <div key={f.name} data-reveal className="group flex flex-col">
                <div className="relative h-[380px] overflow-hidden rounded-frame bg-surface-alt md:h-[520px]">
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
                      className="relative h-full w-full object-cover object-top transition-transform duration-700 ease-brand group-hover:scale-[1.03]"
                    />
                  )}
                  <span
                    aria-hidden
                    style={{ boxShadow: 'inset 0 0 22px rgba(18,30,38,0.16)' }}
                    className="pointer-events-none absolute inset-0 rounded-frame"
                  />
                </div>

                <div className="mt-6 flex items-baseline justify-between gap-6 border-t border-[var(--color-line)] pt-5">
                  <h3 className="font-display text-2xl font-bold tracking-[-0.01em] text-content md:text-[1.75rem]">
                    {f.name}
                  </h3>
                  <p className="min-w-0 font-body text-[12px] uppercase tracking-[0.14em] text-accent md:text-right">
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
        </div>
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
        <div className="relative mx-auto flex h-full max-w-[1560px] items-center px-gutter md:px-gutter-lg">
          <h2 className="max-w-[20ch] font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-white md:text-[3rem]">
            {renderEmphasis(p.closingHeading)}
          </h2>
        </div>
      </section>
    </div>
  )
}
