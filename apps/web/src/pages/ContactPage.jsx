import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import SocialIcon from '../components/SocialIcon'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { rise, stagger } from '../lib/motion'
import QuoteForm from '../components/QuoteForm'
import { parseSlugList } from '../lib/interiors'

function ContactIcon({ type }) {
  if (type === 'location') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-7" aria-hidden>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    )
  }
  if (type === 'phone') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-7" aria-hidden>
        <path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21a1.5 1.5 0 0 0 1.5-1.5V17l-4-1-1.4 2.1a14 14 0 0 1-9.7-9.7L8 7 7 3Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-7" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

export default function ContactPage() {
  const c = useSection('contact_page')
  const homeHero = useSection('hero')
  const [searchParams] = useSearchParams()

  const unitLabel = searchParams.get('unit')
  const unitBuilding = searchParams.get('building')
  const unitStatus = searchParams.get('status')
  const propertyId = searchParams.get('property') || null
  // Carried from the footer's single-field enquiry box. Validated here rather
  // than trusted: the value arrives from the URL, so anything that is not
  // plausibly an address is dropped instead of being written into a required
  // field the visitor then has to notice and clear.
  const presetEmail = searchParams.get('email')
  const prefillEmail = presetEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(presetEmail) ? presetEmail : ''
  const sourcePath = searchParams.get('from')?.startsWith('/') ? searchParams.get('from') : null
  const heroImage = homeHero.slides?.[4]?.image ?? homeHero.slides?.[0]?.image

  // Set only by the Interiors typology page's "Add this to my unit quote"
  // button — everything else that lands here is a plain enquiry.
  const source = searchParams.get('source') || 'contact'
  const optionSlugs = parseSlugList(searchParams.get('options') || '')

  const contactCards = [
    { type: 'location', title: 'Location', value: c.location, href: null },
    { type: 'phone', title: 'Call Us', value: c.phone, href: c.phone ? `tel:${c.phone.replace(/[^\d+]/g, '')}` : null },
    { type: 'email', title: 'Email Us', value: c.email, href: c.email ? `mailto:${c.email}` : null },
  ]

  return (
    <div
      data-band="light"
      // This page forces the dark role tokens on regardless of theme, and it did
      // it with the literal hexes those tokens happened to hold — so it silently
      // kept the old palette the moment the tokens moved. Pointed at the tokens
      // themselves now, which is what the role layer is for.
      className="bg-ink text-bone [--color-content:var(--color-bone)] [--color-line:var(--color-line-inv)] [--color-surface-alt:#10191f] [--color-surface:#17242c]"
    >
      <section
        id="contact-hero"
        className="relative min-h-[520px] overflow-hidden bg-carbon px-6 pb-28 pt-32 text-center text-white md:min-h-[590px] md:pb-32 md:pt-36"
      >
        {heroImage && (
          <img
            src={heroImage}
            alt="Prime Developers property in Texas"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,33,.64)_0%,rgba(20,28,33,.58)_55%,rgba(20,28,33,.72)_100%)]" />

        <motion.div variants={stagger} initial="hidden" animate="show" className="relative mx-auto max-w-[1200px]">
          <motion.h1
            variants={rise}
            className="font-display font-bold leading-[1.06] tracking-[-0.035em] [font-size:clamp(2.35rem,3.8vw,3.75rem)]"
          >
            {renderEmphasis(c.heroHeading)}
          </motion.h1>
          <motion.p variants={rise} className="mx-auto mt-5 max-w-[660px] font-body text-[17px] leading-[1.55] text-white/80 md:text-[19px]">
            {c.heroParagraph}
          </motion.p>
          <motion.div variants={rise} className="mt-10">
            <span className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-accent-soft">
              {c.heroEyebrow}
            </span>
            <h2 className="mt-3 font-display text-[clamp(2rem,3vw,3rem)] font-medium tracking-[-0.025em]">
              {c.heroSubheading}
            </h2>
          </motion.div>
        </motion.div>
      </section>

      <section className="relative px-6 pb-20 md:px-12 md:pb-28">
        <div className="mx-auto -mt-28 max-w-[1100px]">
          <QuoteForm
            source={source}
            eyebrow={c.formEyebrow}
            heading={c.formHeading}
            description={c.formParagraph}
            unitContext={unitLabel ? { unitLabel, unitBuilding, unitStatus, propertyId, sourcePath } : null}
            prefillEmail={prefillEmail}
            prefillMessage={unitLabel ? `I'd like more information about Unit ${unitLabel}.` : ''}
            context={optionSlugs.length > 0 ? { optionSlugs } : {}}
          />

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {contactCards.map((card) => {
              const content = (
                <>
                  <span className="text-accent"><ContactIcon type={card.type} /></span>
                  <span className="min-w-0">
                    <strong className="block font-display text-[1.35rem] font-bold tracking-[-0.02em]">{card.title}</strong>
                    <span className="mt-1 block break-words font-body text-[15px] text-content/65">{card.value}</span>
                  </span>
                </>
              )
              return card.href ? (
                <a key={card.type} href={card.href} className="flex min-h-24 items-center gap-5 rounded-2xl border border-accent/55 px-7 py-5 transition-colors hover:bg-accent/5">
                  {content}
                </a>
              ) : (
                <div key={card.type} className="flex min-h-24 items-center gap-5 rounded-2xl border border-accent/55 px-7 py-5">
                  {content}
                </div>
              )
            })}
          </div>

          {c.socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap items-center gap-2.5">
              {c.socials.map((s) => (
                <li key={`${s.href}|${s.label}`}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-[var(--color-line)] px-4 font-body text-[13px] font-medium text-content/75 outline-none transition-[color,border-color,background-color] duration-300 ease-brand hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <SocialIcon platform={s.label} className="size-4 shrink-0" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="px-6 pb-28 pt-8 md:px-12 md:pb-36 md:pt-12">
        <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[280px_1fr] lg:items-center lg:gap-16">
          <div>
            <span className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-accent">{c.mapEyebrow}</span>
            <h2 className="mt-4 max-w-[13ch] font-display text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.13] tracking-[-0.03em]">
              {c.mapHeading}
            </h2>
            <p className="mt-5 max-w-[30ch] font-body text-[15px] leading-[1.6] text-content/65">
              {c.mapParagraph}
            </p>
            <span aria-hidden className="mt-5 block h-0.5 w-24 bg-accent" />
          </div>

          <div className="overflow-hidden rounded-[22px] border border-[var(--color-line)] bg-surface-alt shadow-[0_20px_55px_-40px_rgba(20,28,33,.35)]">
            <iframe
              title="Prime Developers service area in Texas"
              src={`https://www.google.com/maps?q=${encodeURIComponent(c.mapQuery)}&z=6&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[330px] w-full border-0 md:h-[390px]"
            />
          </div>
        </div>
      </section>
    </div>
  )
}