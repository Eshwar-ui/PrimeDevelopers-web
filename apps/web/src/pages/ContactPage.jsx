import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import ArrowRight from '../components/ArrowRight'
import { useSection } from '../context/ContentContext'
import { rise, stagger } from '../lib/motion'
import { api } from '../lib/api'

const fields = [
  { name: 'name', label: 'Full Name', type: 'text', placeholder: 'Enter your name' },
  { name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@gmail.com' },
  { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+1' },
  { name: 'company', label: 'Company', type: 'text', placeholder: 'Enter your company name' },
]

const FIELD =
  'contact-field h-12 rounded-xl border border-[var(--color-line)] bg-carbon px-4 font-body text-[15px] text-bone outline-none transition-[border-color,box-shadow] placeholder:text-bone-3 focus:border-accent/75 focus:ring-[3px] focus:ring-accent/10'
const FIELD_LABEL = 'font-display text-[15px] font-semibold text-content'

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
  const [status, setStatus] = useState('idle')
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

  const contactCards = [
    { type: 'location', title: 'Location', value: c.location, href: null },
    { type: 'phone', title: 'Call Us', value: c.phone, href: c.phone ? `tel:${c.phone.replace(/[^\d+]/g, '')}` : null },
    { type: 'email', title: 'Email Us', value: c.email, href: c.email ? `mailto:${c.email}` : null },
  ]

  const onSubmit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    const form = event.currentTarget
    const data = new FormData(form)
    const company = data.get('company')?.trim()
    const context = unitLabel
      ? `\n\n[Unit ${unitLabel}${unitBuilding ? ` · ${unitBuilding}` : ''} - ${unitStatus || 'status unknown'} at time of enquiry${sourcePath ? ` · ${window.location.origin}${sourcePath}` : ''}]`
      : ''
    const companyContext = company ? `\n\n[Company: ${company}]` : ''

    try {
      await api.post('/leads', {
        name: data.get('name'),
        email: data.get('email'),
        phone: data.get('phone') || undefined,
        message: `${data.get('message')}${companyContext}${context}`,
        ...(unitLabel && propertyId && {
          propertyId,
          unitLabel,
          buildingLabel: unitBuilding || undefined,
        }),
      })
    } catch {
      setStatus('error')
      return
    }

    setStatus('sent')
    form.reset()
  }

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
            Let&apos;s Build Something Great Together
          </motion.h1>
          <motion.p variants={rise} className="mx-auto mt-5 max-w-[660px] font-body text-[17px] leading-[1.55] text-white/80 md:text-[19px]">
            Have a property question, investment opportunity, or project in mind? Our team is ready to help you find the right path forward.
          </motion.p>
          <motion.div variants={rise} className="mt-10">
            <span className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-accent-soft">
              We&apos;re here to help
            </span>
            <h2 className="mt-3 font-display text-[clamp(2rem,3vw,3rem)] font-medium tracking-[-0.025em]">
              Start a Conversation
            </h2>
          </motion.div>
        </motion.div>
      </section>

      <section className="relative px-6 pb-20 md:px-12 md:pb-28">
        <div className="mx-auto -mt-28 max-w-[1100px]">
          <form
            onSubmit={onSubmit}
            className="relative min-w-0 rounded-[28px] border border-[var(--color-line)] bg-surface p-7 shadow-[0_24px_70px_-38px_rgba(20,28,33,.35)] md:p-12 lg:grid lg:grid-cols-[280px_1fr] lg:gap-14"
          >
            <div>
              <span className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-accent">
                Send us a message
              </span>
              <h2 className="mt-4 max-w-[12ch] font-display text-[clamp(2rem,3vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.03em]">
                Tell Us What You&apos;re Looking For
              </h2>
              <p className="mt-5 max-w-[30ch] font-body text-[15px] leading-[1.6] text-content/65">
                Have a question or opportunity to discuss? Send us a message and our team will get back to you.
              </p>
              <span aria-hidden className="mt-5 block h-0.5 w-24 bg-accent" />
            </div>

            <div className="min-w-0 mt-10 lg:mt-0">
              {unitLabel && (
                <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
                  <span className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Enquiring about</span>
                  <p className="mt-1 font-display text-[15px] font-semibold">Unit {unitLabel}{unitBuilding ? ` · ${unitBuilding}` : ''}</p>
                </div>
              )}

              <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                {fields.map((field) => (
                  <label key={field.name} className="flex flex-col gap-2">
                    <span className={FIELD_LABEL}>{field.label}</span>
                    <input
                      name={field.name}
                      type={field.type}
                      required={field.name === 'name' || field.name === 'email'}
                      placeholder={field.placeholder}
                      defaultValue={field.name === 'email' ? prefillEmail : undefined}
                      className={FIELD}
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-2 sm:col-span-2">
                  <span className={FIELD_LABEL}>Anything else we should know?</span>
                  <textarea
                    name="message"
                    rows={4}
                    required
                    defaultValue={unitLabel ? `I'd like more information about Unit ${unitLabel}.` : ''}
                    placeholder="Type your message"
                    className="contact-field min-h-28 resize-none rounded-xl border border-[var(--color-line)] bg-carbon px-4 py-3 font-body text-[15px] text-bone outline-none transition-[border-color,box-shadow] placeholder:text-bone-3 focus:border-accent/75 focus:ring-[3px] focus:ring-accent/10"
                  />
                </label>
              </div>

              <div className="mt-7 flex flex-col items-stretch gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {status === 'sent' && <p className="font-body text-[14px] text-accent">Thanks, we&apos;ve received your enquiry.</p>}
                {status === 'error' && <p role="alert" className="font-body text-[14px] text-red-600">Something went wrong. Please try again.</p>}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="group inline-flex h-12 w-full items-center justify-center gap-4 rounded-full sm:w-auto bg-accent pl-6 pr-4 font-body text-[14px] font-semibold text-white dark:text-void transition-colors hover:bg-prime-deep active:scale-[0.98] disabled:opacity-60"
                >
                  {status === 'sending' ? 'Sending...' : 'Send Enquiry'}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </form>

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
        </div>
      </section>

      <section className="px-6 pb-28 pt-8 md:px-12 md:pb-36 md:pt-12">
        <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[280px_1fr] lg:items-center lg:gap-16">
          <div>
            <span className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-accent">Find us in Texas</span>
            <h2 className="mt-4 max-w-[13ch] font-display text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.13] tracking-[-0.03em]">
              We&apos;re here to serve across Texas
            </h2>
            <p className="mt-5 max-w-[30ch] font-body text-[15px] leading-[1.6] text-content/65">
              Serving investors, businesses and property owners across the Texas market.
            </p>
            <span aria-hidden className="mt-5 block h-0.5 w-24 bg-accent" />
          </div>

          <div className="overflow-hidden rounded-[22px] border border-[var(--color-line)] bg-surface-alt shadow-[0_20px_55px_-40px_rgba(20,28,33,.35)]">
            <iframe
              title="Prime Developers service area in Texas"
              src="https://www.google.com/maps?q=Texas%2C%20USA&z=6&output=embed"
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