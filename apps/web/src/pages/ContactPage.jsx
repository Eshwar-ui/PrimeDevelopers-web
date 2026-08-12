import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import ArrowRight from '../components/ArrowRight'
import MaskedHeading from '../components/MaskedHeading'
import { useSection } from '../context/ContentContext'
import { rise, stagger } from '../lib/motion'
import { api } from '../lib/api'

const fields = [
  { name: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Doe' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com' },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' },
]

// Shared by every field so the three inputs and the textarea cannot drift.
const FIELD =
  'border-b border-[var(--color-line)] bg-transparent pb-2.5 font-body text-[16px] text-content outline-none transition-colors placeholder:text-content/30 focus:border-accent'
const FIELD_LABEL = 'font-body text-[13px] uppercase tracking-[0.14em] text-content/70'

// data-band="light" on every section — see the note in NewsPostPage.

export default function ContactPage() {
  const c = useSection('contact_page')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [searchParams] = useSearchParams()

  // Arrives from a unit's detail panel on a property page. The lead is stored
  // with the unit it came from, so sales opens the call already knowing what
  // is being asked about.
  const unitLabel = searchParams.get('unit')
  const unitBuilding = searchParams.get('building')
  const unitStatus = searchParams.get('status')
  const propertyId = searchParams.get('property') || null
  // Only ever an internal path we wrote ourselves — never echoed back into a
  // link, only folded into the stored message text (see onSubmit).
  const sourcePath = searchParams.get('from')?.startsWith('/') ? searchParams.get('from') : null

  const details = [
    { label: 'Email', value: c.email, href: c.email ? `mailto:${c.email}` : null },
    { label: 'Phone', value: c.phone, href: c.phone ? `tel:${c.phone.replace(/[^\d+]/g, '')}` : null },
    { label: 'Location', value: c.location, href: null },
  ]

  const onSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    const fd = new FormData(e.currentTarget)

    // The leads table has no column for "status at time of enquiry" or a
    // source link, so both are folded into the stored message rather than
    // being dropped. The unit itself is attributed properly, as its own row.
    const context = unitLabel
      ? `\n\n[Unit ${unitLabel}${unitBuilding ? ` · ${unitBuilding}` : ''} — ${unitStatus || 'status unknown'} at time of enquiry${sourcePath ? ` · ${window.location.origin}${sourcePath}` : ''}]`
      : ''

    // One request: the API writes the lead and its unit attribution in a single
    // transaction. This used to be two independent inserts, so a failed
    // attribution left a lead with no record of what it was about — and the
    // failure was only visible in the browser console.
    const form = e.currentTarget
    try {
      await api.post('/leads', {
        name: fd.get('name'),
        email: fd.get('email'),
        phone: fd.get('phone') || undefined,
        message: `${fd.get('message')}${context}`,
        // Both or neither — the API rejects a half-specified attribution.
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
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="contact-hero"
        data-band="light"
        className="bg-surface px-6 pb-14 pt-32 text-center md:px-12 md:pb-16 md:pt-40"
      >
        <motion.div variants={stagger} initial="hidden" animate="show">
          {c.heroEyebrow && (
            <motion.span
              variants={rise}
              className="block font-body text-[14px] uppercase tracking-[0.14em] text-accent"
            >
              {c.heroEyebrow}
            </motion.span>
          )}

          <h1 className="mx-auto mt-5 max-w-[18ch] font-display font-bold uppercase leading-[1.03] tracking-tight text-content [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            <MaskedHeading text={c.heroHeading} accentClass="italic text-accent-soft" />
          </h1>

          {c.heroParagraph && (
            <motion.p
              variants={rise}
              className="mx-auto mt-7 max-w-[40rem] font-body text-[15px] leading-relaxed text-content/70"
            >
              {c.heroParagraph}
            </motion.p>
          )}
        </motion.div>
      </section>

      {/* ── Details + form ───────────────────────────────────── */}
      <section data-band="light" className="bg-surface-alt px-6 py-20 md:px-12 md:py-28">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
          {/* Left — details + socials */}
          <div>
            <div className="flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {details.map((d) => {
                const inner = (
                  <div className="flex flex-col gap-1.5 py-6">
                    <span className={FIELD_LABEL}>{d.label}</span>
                    <span className="font-display text-2xl font-bold tracking-[-0.01em] text-content transition-colors duration-300 group-hover:text-accent md:text-3xl">
                      {d.value}
                    </span>
                  </div>
                )
                return d.href ? (
                  <a key={d.label} href={d.href} className="group">
                    {inner}
                  </a>
                ) : (
                  <div key={d.label}>{inner}</div>
                )
              })}
            </div>

            <div className="mt-10">
              <span className={FIELD_LABEL}>Follow</span>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {c.socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--color-line)] px-5 py-2 font-body text-[13px] font-medium uppercase tracking-[0.1em] text-content/70 transition-colors duration-300 hover:border-content/35 hover:text-content"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right — form. On `surface` against the section's `surface-alt`, so
              the card reads as raised rather than as a differently-tinted patch
              of the same plane. */}
          <form
            onSubmit={onSubmit}
            className="rounded-3xl border border-[var(--color-line)] bg-surface p-8 md:p-10"
          >
            <div className="flex flex-col gap-6">
              {unitLabel && (
                <div className="rounded-xl border border-accent/35 bg-accent/8 px-4 py-3">
                  <span className="font-body text-[13px] uppercase tracking-[0.14em] text-accent">
                    Enquiring about
                  </span>
                  <p className="mt-1 font-display text-base font-bold text-content">
                    Unit {unitLabel}
                    {unitBuilding ? ` · ${unitBuilding}` : ''}
                  </p>
                </div>
              )}
              {fields.map((f) => (
                <label key={f.name} className="flex flex-col gap-2">
                  <span className={FIELD_LABEL}>{f.label}</span>
                  <input
                    name={f.name}
                    type={f.type}
                    required={f.name !== 'phone'}
                    placeholder={f.placeholder}
                    className={FIELD}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-2">
                <span className={FIELD_LABEL}>Message</span>
                <textarea
                  name="message"
                  rows={4}
                  required
                  defaultValue={unitLabel ? `I'd like more information about Unit ${unitLabel}.` : ''}
                  placeholder="Tell us about your property or enquiry…"
                  className={`resize-none ${FIELD}`}
                />
              </label>

              {/* PrimePill's solid variant, rebuilt as a <button>. The pill
                  itself is an <a> and cannot submit a form, but the site's
                  primary action has one shape — gradient lozenge, white arrow
                  disc on the trailing edge — and this is a primary action. */}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="group mt-2 inline-flex h-14 w-fit items-center gap-4 rounded-full bg-[linear-gradient(96deg,#0073a4_0%,#1aa1d2_100%)] py-1.5 pl-7 pr-1.5 text-white shadow-[0_12px_26px_-16px_rgba(0,115,164,0.95)] transition-shadow duration-300 hover:shadow-[0_16px_32px_-14px_rgba(0,115,164,0.8)] disabled:opacity-60 disabled:shadow-none"
              >
                <span className="font-body text-[15px] font-bold uppercase tracking-[0.04em]">
                  {status === 'sending' ? 'Sending…' : 'Send enquiry'}
                </span>
                {/* charcoal, not text-content: the disc is hardcoded white in
                    both themes, so its foreground has to be a pigment — under
                    dark mode the role token lifts to near-white and the arrow
                    vanishes into the disc. */}
                <span className="flex size-11 items-center justify-center rounded-full bg-white text-charcoal">
                  <ArrowRight className="size-4 -rotate-45 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </button>

              {status === 'sent' && (
                <p className="font-body text-[15px] text-accent">
                  Thanks — we&apos;ve received your enquiry and will be in touch.
                </p>
              )}
              {status === 'error' && (
                /* red-600, not red-400: the lighter tint was picked against a
                   dark card and drops to about 2.5:1 on this one. */
                <p className="font-body text-[15px] text-red-600">
                  Something went wrong sending that. Please try again.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
