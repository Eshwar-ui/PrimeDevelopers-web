import { motion } from 'motion/react'
import ArrowRight from '../components/ArrowRight'
import PrimePill from '../components/PrimePill'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const inView = { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.25 } }

export default function EnterprisePage() {
  const page = useSection('enterprise_page')

  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────── */}
      <section data-band="light" className="bg-white text-charcoal">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-[1560px] px-6 pb-16 pt-36 md:px-12 md:pb-20 md:pt-44"
        >
          {page.heroEyebrow && (
            <motion.span
              variants={rise}
              className="block font-body text-[11px] font-bold uppercase tracking-[0.18em] text-accent"
            >
              {page.heroEyebrow}
            </motion.span>
          )}

          <motion.h1
            variants={rise}
            className="mt-6 max-w-[18ch] font-display font-bold uppercase leading-[1.04] tracking-tight text-[#232323]"
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 4rem)' }}
          >
            {renderEmphasis(page.heroHeading?.trimEnd(), '')}
          </motion.h1>

          <motion.div
            variants={rise}
            className="mt-9 flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-16"
          >
            <p className="max-w-120 font-body text-[15px] leading-relaxed text-charcoal/60">
              {page.heroParagraph}
            </p>
            {page.ctaLabel && (
              <PrimePill href={page.ctaHref} className="shrink-0">
                {page.ctaLabel}
              </PrimePill>
            )}
          </motion.div>

          {page.heroImage && (
            <motion.div
              variants={rise}
              className="mt-14 h-[clamp(16rem,44vh,30rem)] overflow-hidden rounded-[26px] bg-brightgray"
            >
              <img src={page.heroImage} alt="" className="h-full w-full object-cover" />
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ── capabilities — an indexed register, not a card grid ───── */}
      {page.capabilities.length > 0 && (
        <section data-band="light" className="bg-white text-charcoal">
          <div className="mx-auto max-w-[1560px] px-6 pb-20 md:px-12 md:pb-28">
            {page.capabilitiesHeading && (
              <motion.h2
                variants={rise}
                {...inView}
                className="max-w-[20ch] font-display font-bold uppercase leading-[1.06] tracking-tight text-[#232323]"
                style={{ fontSize: 'clamp(1.75rem, 3vw, 2.75rem)' }}
              >
                {renderEmphasis(page.capabilitiesHeading, '')}
              </motion.h2>
            )}

            <motion.ul
              variants={stagger}
              {...inView}
              className="mt-12 border-t border-line"
            >
              {page.capabilities.map((item, i) => (
                <motion.li
                  key={i}
                  variants={rise}
                  className="grid gap-3 border-b border-line py-8 md:grid-cols-[4rem_minmax(0,20rem)_1fr] md:gap-10 md:py-10"
                >
                  <span className="font-body text-[13px] font-bold tabular-nums text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-xl font-bold leading-tight md:text-2xl">
                    {item.title}
                  </h3>
                  <p className="max-w-[68ch] font-body text-[15px] leading-relaxed text-charcoal/60">
                    {item.body}
                  </p>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </section>
      )}

      {/* ── record ───────────────────────────────────────────────── */}
      {page.stats.length > 0 && (
        <section data-band="light" className="bg-brightgray text-charcoal">
          <motion.div
            variants={stagger}
            {...inView}
            className="mx-auto grid max-w-[1560px] grid-cols-2 gap-y-12 px-6 py-16 md:grid-cols-4 md:px-12 md:py-20"
          >
            {page.stats.map((stat, i) => (
              <motion.div
                key={i}
                variants={rise}
                className={`flex flex-col gap-2 px-1 md:px-10 ${
                  i > 0 ? 'md:border-l md:border-charcoal/12' : ''
                }`}
              >
                <span className="font-display text-4xl font-bold tabular-nums leading-none md:text-5xl">
                  {stat.value}
                </span>
                <span className="font-body text-[13px] font-bold uppercase leading-snug tracking-[0.12em] text-accent">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ── closing ──────────────────────────────────────────────── */}
      {page.closingHeading && (
        <section data-band="light" className="bg-white">
          <div className="mx-auto max-w-[1560px] px-6 py-20 md:px-12 md:py-28">
            <motion.div
              variants={rise}
              {...inView}
              className="flex flex-col gap-10 rounded-[28px] bg-accent px-8 py-16 text-white dark:text-void md:flex-row md:items-end md:justify-between md:px-16 md:py-20"
            >
              <h2
                className="max-w-[16ch] font-display font-bold uppercase leading-[1.06] tracking-tight"
                style={{ fontSize: 'clamp(1.75rem, 3.2vw, 3rem)' }}
              >
                {renderEmphasis(page.closingHeading, '')}
              </h2>
              {page.closingLabel && (
                <a
                  href={page.closingHref}
                  className="group inline-flex shrink-0 items-center gap-4 self-start rounded-full bg-white py-1.5 pl-7 pr-1.5 text-charcoal md:self-auto"
                >
                  <span className="font-body text-[15px] font-bold uppercase tracking-[0.04em]">
                    {page.closingLabel}
                  </span>
                  <span className="flex size-11 items-center justify-center rounded-full bg-accent text-white transition-transform dark:text-void duration-300 ease-out group-hover:translate-x-0.5">
                    <ArrowRight className="size-4" />
                  </span>
                </a>
              )}
            </motion.div>
          </div>
        </section>
      )}
    </>
  )
}
