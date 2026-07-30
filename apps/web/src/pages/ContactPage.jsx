import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ArrowRight from '../components/ArrowRight'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { api } from '../lib/api'

const fields = [
  { name: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Doe' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com' },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' },
]

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
        className="relative overflow-hidden bg-void px-6 pb-16 pt-36 text-bone md:px-[75px] md:pb-20 md:pt-48"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 55% at 0% 100%, rgba(252,164,46,0.16) 0%, rgba(252,164,46,0) 100%)',
          }}
        />
        <div className="relative">
          <span className="eyebrow mb-6 flex items-center gap-4 text-bone/70">
            <span className="h-px w-10 bg-accent-soft" />
            {c.heroEyebrow}
          </span>
          <h1 className="font-display text-display font-light leading-[0.98] tracking-[-0.02em]">
            {renderEmphasis(c.heroHeading)}
          </h1>
          <p className="mt-8 max-w-[48ch] font-body text-lg leading-relaxed text-bone/65">{c.heroParagraph}</p>
        </div>
      </section>

      {/* ── Details + form ───────────────────────────────────── */}
      <section className="bg-void px-6 py-20 text-bone md:px-[75px] md:py-28">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
          {/* Left — details + socials */}
          <div>
            <div className="flex flex-col divide-y divide-[var(--color-line-inv)] border-y border-[var(--color-line-inv)]">
              {details.map((d) => {
                const inner = (
                  <div className="flex flex-col gap-1.5 py-6">
                    <span className="eyebrow text-bone/40">{d.label}</span>
                    <span className="font-display text-2xl font-medium tracking-[-0.01em] text-bone transition-colors duration-300 group-hover:text-accent-soft md:text-3xl">
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
              <span className="eyebrow text-bone/40">Follow</span>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {c.socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--color-line-inv)] px-5 py-2 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-bone/55 transition-colors duration-300 hover:border-bone/40 hover:text-bone"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right — form */}
          <form
            onSubmit={onSubmit}
            className="rounded-3xl border border-[var(--color-line-inv)] bg-carbon p-8 md:p-10"
          >
            <div className="flex flex-col gap-6">
              {unitLabel && (
                <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
                  <span className="eyebrow text-accent-soft">Enquiring about</span>
                  <p className="mt-1 font-display text-base font-medium text-bone">
                    Unit {unitLabel}
                    {unitBuilding ? ` · ${unitBuilding}` : ''}
                  </p>
                </div>
              )}
              {fields.map((f) => (
                <label key={f.name} className="flex flex-col gap-2">
                  <span className="eyebrow text-bone/40">{f.label}</span>
                  <input
                    name={f.name}
                    type={f.type}
                    required={f.name !== 'phone'}
                    placeholder={f.placeholder}
                    className="border-b border-[var(--color-line-inv)] bg-transparent pb-2.5 font-body text-base text-bone outline-none transition-colors placeholder:text-bone/25 focus:border-accent"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-2">
                <span className="eyebrow text-bone/40">Message</span>
                <textarea
                  name="message"
                  rows={4}
                  required
                  defaultValue={unitLabel ? `I'd like more information about Unit ${unitLabel}.` : ''}
                  placeholder="Tell us about your property or enquiry…"
                  className="resize-none border-b border-[var(--color-line-inv)] bg-transparent pb-2.5 font-body text-base text-bone outline-none transition-colors placeholder:text-bone/25 focus:border-accent"
                />
              </label>

              <button
                type="submit"
                disabled={status === 'sending'}
                className="group relative mt-2 inline-flex items-center justify-center overflow-hidden rounded-full bg-accent px-6 py-3.5 font-body text-[14px] font-bold uppercase tracking-[0.1em] text-void disabled:opacity-60"
              >
                <span className="absolute inset-0 translate-y-full bg-void/25 transition-transform duration-300 ease-out group-hover:translate-y-0" />
                <span className="relative flex items-center gap-1.5">
                  {status === 'sending' ? 'Sending…' : 'Send enquiry'}
                  <ArrowRight className="size-5 transition-transform duration-300 ease-out group-hover:translate-x-1.5" />
                </span>
              </button>

              {status === 'sent' && (
                <p className="text-sm text-accent-soft">Thanks — we&apos;ve received your enquiry and will be in touch.</p>
              )}
              {status === 'error' && (
                <p className="text-sm text-red-400">Something went wrong sending that. Please try again.</p>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
