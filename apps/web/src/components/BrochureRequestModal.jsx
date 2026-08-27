import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useSection } from '../context/ContentContext'
import ArrowRight from './ArrowRight'

const FIELD = 'w-full border-b border-[var(--color-line)] bg-transparent pb-2.5 font-body text-[16px] text-content outline-none transition-colors placeholder:text-content/30 focus:border-accent'

export default function BrochureRequestModal({ property, onClose }) {
  const t = useSection('brochure_modal')
  const dialog = useRef(null)
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const submit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await api.post('/leads/brochure', {
        name: data.get('name'), email: data.get('email'), phone: data.get('phone'), propertyId: property.id,
      })
      // The request succeeding and the brochure arriving are two different
      // things: the lead is always recorded, but the email can be off, the
      // property can have no brochure on file, or the send can fail. Saying
      // "check your inbox" in those cases sends someone to wait for a mail
      // that is not coming, so the API reports which happened and the two
      // outcomes read differently.
      setStatus(result?.emailed ? 'sent' : 'received')
      form.reset()
    } catch { setStatus('error') }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-charcoal/70 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="brochure-title" tabIndex={-1} className="relative w-full max-w-xl rounded-3xl bg-surface p-6 sm:p-7 shadow-2xl outline-none md:p-10">
        <button type="button" onClick={onClose} aria-label="Close brochure request" className="absolute right-4 top-4 flex size-11 sm:right-5 sm:top-5 items-center justify-center rounded-full border border-[var(--color-line)] text-xl text-content/70 hover:text-content">×</button>
        {status === 'sent' || status === 'received' ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/10 text-2xl text-accent">✓</span>
            <h2 id="brochure-title" className="mt-6 font-display text-3xl font-bold text-content">
              {status === 'sent' ? t.successHeading : t.receivedHeading}
            </h2>
            <p className="mx-auto mt-3 max-w-sm font-body leading-relaxed text-content/70">
              {(status === 'sent' ? t.successBody : t.receivedBody).replace('{name}', property.name)}
            </p>
            <button type="button" onClick={onClose} className="mt-7 rounded-full bg-invert px-7 py-3 font-body font-medium text-invert-fg">{t.doneLabel}</button>
          </div>
        ) : (
          <>
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-accent">{t.eyebrow}</p>
            <h2 id="brochure-title" className="mt-3 pr-10 font-display text-[1.75rem] sm:text-3xl font-bold leading-tight text-content">{t.heading.replace('{name}', property.name)}</h2>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-content/70">{t.paragraph}</p>
            <form onSubmit={submit} className="mt-8 flex flex-col gap-6">
              <input className={FIELD} name="name" required maxLength={200} placeholder={t.namePlaceholder} autoComplete="name" />
              <input className={FIELD} name="email" type="email" required maxLength={320} placeholder={t.emailPlaceholder} autoComplete="email" />
              <input className={FIELD} name="phone" type="tel" required maxLength={50} placeholder={t.phonePlaceholder} autoComplete="tel" />
              <button type="submit" disabled={status === 'sending'} className="primary-button-flood group mt-1 inline-flex h-14 w-full items-center justify-between sm:w-fit gap-4 rounded-full bg-[linear-gradient(96deg,#0073a4_0%,#1aa1d2_100%)] py-1.5 pl-7 pr-1.5 text-white disabled:opacity-60">
                <span className="font-body text-[14px] font-bold uppercase tracking-[0.04em]">{status === 'sending' ? t.sendingLabel : t.submitLabel}</span>
                <span className="flex size-11 items-center justify-center rounded-full bg-white text-charcoal"><ArrowRight className="size-4 -rotate-45" /></span>
              </button>
              {status === 'error' && <p role="alert" className="font-body text-sm text-red-600">{t.errorMessage}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
