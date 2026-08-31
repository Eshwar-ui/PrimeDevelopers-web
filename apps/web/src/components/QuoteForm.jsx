import { useState } from 'react'
import ArrowRight from './ArrowRight'
import { api } from '../lib/api'

// The base four fields every source shares. `company` is folded into the
// structured `context` sent to the API rather than into the message body —
// see the submit handler below.
const BASE_FIELDS = [
  { name: 'name', label: 'Full Name', type: 'text', placeholder: 'Enter your name', required: true },
  { name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@gmail.com', required: true },
  { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+1' },
  { name: 'company', label: 'Company', type: 'text', placeholder: 'Enter your company name' },
]

const FIELD =
  'contact-field h-12 rounded-xl border border-[var(--color-line)] bg-carbon px-4 font-body text-[15px] text-bone outline-none transition-[border-color,box-shadow] placeholder:text-bone-3 focus:border-accent/75 focus:ring-[3px] focus:ring-accent/10'
const FIELD_LABEL = 'font-display text-[15px] font-semibold text-content'

function ExtraField({ field }) {
  if (field.type === 'select') {
    return (
      <select name={field.name} required={field.required} defaultValue="" className={FIELD}>
        <option value="" disabled>
          {field.placeholder || 'Select one'}
        </option>
        {field.options.map((option) => (
          <option key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </option>
        ))}
      </select>
    )
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        name={field.name}
        rows={3}
        required={field.required}
        placeholder={field.placeholder}
        className="contact-field min-h-24 resize-none rounded-xl border border-[var(--color-line)] bg-carbon px-4 py-3 font-body text-[15px] text-bone outline-none transition-[border-color,box-shadow] placeholder:text-bone-3 focus:border-accent/75 focus:ring-[3px] focus:ring-accent/10"
      />
    )
  }
  return (
    <input
      name={field.name}
      type={field.type || 'text'}
      required={field.required}
      placeholder={field.placeholder}
      className={FIELD}
    />
  )
}

/**
 * The one form every "talk to us" moment on the site submits through —
 * the general contact page, and the Interiors/Franchise/Collab/Invest
 * inquiries. `source` labels the submission for lead routing; `context`
 * carries whatever structured detail that source already knows (an interior
 * option slug, a franchise's desired property) so it lands as real fields on
 * the lead rather than being stuffed into the free-text message.
 *
 * `unitContext` is the one case that also attributes the lead to a specific
 * unit — the same attribution the API already has a dedicated table for.
 */
export default function QuoteForm({
  source = 'contact',
  eyebrow = 'Send us a message',
  heading = "Tell Us What You're Looking For",
  description = 'Have a question or opportunity to discuss? Send us a message and our team will get back to you.',
  context = {},
  extraFields = [],
  unitContext = null,
  prefillEmail = '',
  prefillMessage = '',
  messageLabel = 'Anything else we should know?',
  messagePlaceholder = 'Type your message',
}) {
  const [status, setStatus] = useState('idle')

  const onSubmit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    const form = event.currentTarget
    const data = new FormData(form)

    const company = data.get('company')?.trim()
    const extraContext = Object.fromEntries(
      extraFields
        .map((field) => [field.name, data.get(field.name)?.toString().trim()])
        .filter(([, value]) => Boolean(value))
    )
    const fullContext = {
      ...context,
      ...(company && { company }),
      ...extraContext,
      ...(unitContext?.unitStatus && { unitStatusAtEnquiry: unitContext.unitStatus }),
      ...(unitContext?.sourcePath && { sourcePath: unitContext.sourcePath }),
    }

    try {
      await api.post('/leads', {
        name: data.get('name'),
        email: data.get('email'),
        phone: data.get('phone') || undefined,
        message: data.get('message'),
        source,
        ...(Object.keys(fullContext).length > 0 && { context: fullContext }),
        ...(unitContext?.unitLabel &&
          unitContext?.propertyId && {
            propertyId: unitContext.propertyId,
            unitLabel: unitContext.unitLabel,
            buildingLabel: unitContext.unitBuilding || undefined,
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
    <div className="relative min-w-0 rounded-[22px] border border-[var(--color-line)] bg-surface p-5 shadow-[0_24px_70px_-38px_rgba(20,28,33,.35)] sm:p-7 md:rounded-[28px] md:p-10 lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-14 lg:p-12">
      <div>
        <span className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</span>
        <h2 className="mt-4 max-w-[16ch] text-balance font-display text-[clamp(1.75rem,8vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.03em]">
          {heading}
        </h2>
        <p className="mt-5 max-w-[34ch] font-body text-[15px] leading-[1.6] text-content/65">{description}</p>
        <span aria-hidden className="mt-5 block h-0.5 w-24 bg-accent" />
      </div>

      <div className="mt-8 min-w-0 sm:mt-10 lg:mt-0">
        {status === 'sent' ? (
          <div className="flex min-h-[16rem] flex-col items-start justify-center py-8">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-2xl text-accent">✓</span>
            <h3 className="mt-6 font-display text-2xl font-bold text-content">Thanks — we've got it</h3>
            <p className="mt-3 max-w-sm font-body text-[15px] leading-relaxed text-content/70">
              We've received your enquiry and someone from our team will be in touch shortly.
            </p>
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="mt-7 rounded-full bg-invert px-7 py-3 font-body font-medium text-invert-fg"
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            {unitContext?.unitLabel && (
              <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
                <span className="font-body text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Enquiring about</span>
                <p className="mt-1 font-display text-[15px] font-semibold">
                  Unit {unitContext.unitLabel}
                  {unitContext.unitBuilding ? ` · ${unitContext.unitBuilding}` : ''}
                </p>
              </div>
            )}

            <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
              {BASE_FIELDS.map((field) => (
                <label key={field.name} className="flex flex-col gap-2">
                  <span className={FIELD_LABEL}>{field.label}</span>
                  <input
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    defaultValue={field.name === 'email' ? prefillEmail : undefined}
                    className={FIELD}
                  />
                </label>
              ))}

              {extraFields.map((field) => (
                <label key={field.name} className={`flex flex-col gap-2 ${field.fullWidth ? 'sm:col-span-2' : ''}`}>
                  <span className={FIELD_LABEL}>{field.label}</span>
                  <ExtraField field={field} />
                </label>
              ))}

              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className={FIELD_LABEL}>{messageLabel}</span>
                <textarea
                  name="message"
                  rows={4}
                  required
                  defaultValue={prefillMessage}
                  placeholder={messagePlaceholder}
                  className="contact-field min-h-28 resize-none rounded-xl border border-[var(--color-line)] bg-carbon px-4 py-3 font-body text-[15px] text-bone outline-none transition-[border-color,box-shadow] placeholder:text-bone-3 focus:border-accent/75 focus:ring-[3px] focus:ring-accent/10"
                />
              </label>
            </div>

            <div className="mt-7 flex flex-col items-stretch gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {status === 'error' && (
                <p role="alert" className="font-body text-[14px] text-red-600">
                  Something went wrong. Please try again.
                </p>
              )}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="primary-button-flood group inline-flex h-12 w-full items-center justify-center gap-4 rounded-full bg-accent pl-6 pr-4 font-body text-[14px] font-semibold text-white dark:text-void transition-colors hover:bg-prime-deep active:scale-[0.98] disabled:opacity-60 sm:w-auto"
              >
                {status === 'sending' ? 'Sending...' : 'Send Enquiry'}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
