import ArrowRight from '../components/ArrowRight'

const details = [
  { label: 'Email', value: 'sales@theprimedeveloper.com', href: 'mailto:sales@theprimedeveloper.com' },
  { label: 'Phone', value: '+1 512-761-8025', href: 'tel:+15127618025' },
  { label: 'Location', value: 'Texas, United States', href: null },
]

const socials = [
  { label: 'WhatsApp', href: 'https://wa.me/15127618025' },
  { label: 'LinkedIn', href: '#' },
  { label: 'Instagram', href: '#' },
  { label: 'Facebook', href: '#' },
]

const fields = [
  { name: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Doe' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com' },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' },
]

export default function ContactPage() {
  // No backend — compose a prefilled email to the sales inbox.
  const onSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const subject = `Enquiry from ${fd.get('name') || 'website visitor'}`
    const body = [
      `Name: ${fd.get('name')}`,
      `Email: ${fd.get('email')}`,
      `Phone: ${fd.get('phone')}`,
      '',
      fd.get('message'),
    ].join('\n')
    window.location.href = `mailto:sales@theprimedeveloper.com?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="contact-hero"
        className="relative overflow-hidden bg-ink px-6 pb-16 pt-32 text-bone md:px-[75px] md:pb-20 md:pt-44"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 55% at 0% 100%, rgba(0,155,222,0.42) 0%, rgba(0,155,222,0) 100%)',
          }}
        />
        <div className="relative">
          <span className="eyebrow mb-6 block text-bone/70">
            Contact <span className="text-accent-soft">—</span> Prime Developers
          </span>
          <h1
            className="font-display font-light uppercase leading-[1.05] tracking-[0.02em]"
            style={{ fontSize: 'clamp(2rem, 4.4vw, 3.5rem)' }}
          >
            Explore options
            <br />
            with us today.
          </h1>
          <p className="mt-8 max-w-[48ch] font-body text-lg leading-relaxed text-bone/75">
            Experienced Texas property leaders. Tell us about your goals and our team will be in
            touch.
          </p>
        </div>
      </section>

      {/* ── Details + form ───────────────────────────────────── */}
      <section className="bg-bone px-6 py-20 md:px-[75px] md:py-28">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
          {/* Left — details + socials */}
          <div>
            <div className="flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {details.map((d) => {
                const inner = (
                  <div className="flex flex-col gap-1.5 py-6">
                    <span className="eyebrow text-muted">{d.label}</span>
                    <span className="font-display text-xl font-medium tracking-[-0.01em] text-ink transition-colors duration-300 group-hover:text-accent md:text-2xl">
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
              <span className="eyebrow text-muted">Follow</span>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--color-line)] px-5 py-2 font-body text-sm font-bold uppercase tracking-[0.14em] text-ink/60 transition-colors duration-300 hover:border-ink/40 hover:text-ink"
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
            className="rounded-3xl border border-[var(--color-line)] bg-bone-deep/40 p-8 md:p-10"
          >
            <div className="flex flex-col gap-6">
              {fields.map((f) => (
                <label key={f.name} className="flex flex-col gap-2">
                  <span className="eyebrow text-muted">{f.label}</span>
                  <input
                    name={f.name}
                    type={f.type}
                    required={f.name !== 'phone'}
                    placeholder={f.placeholder}
                    className="border-b border-[var(--color-line)] bg-transparent pb-2.5 font-body text-base text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-accent"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-2">
                <span className="eyebrow text-muted">Message</span>
                <textarea
                  name="message"
                  rows={4}
                  required
                  placeholder="Tell us about your project or enquiry…"
                  className="resize-none border-b border-[var(--color-line)] bg-transparent pb-2.5 font-body text-base text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-accent"
                />
              </label>

              <button
                type="submit"
                className="group relative mt-2 inline-flex items-center justify-center overflow-hidden rounded-full bg-accent px-6 py-3.5 font-body text-[15px] font-bold tracking-wide text-bone"
              >
                <span className="absolute inset-0 translate-y-full bg-bone/20 transition-transform duration-300 ease-out group-hover:translate-y-0" />
                <span className="relative flex items-center gap-1.5">
                  Send enquiry
                  <ArrowRight className="size-6 transition-transform duration-300 ease-out group-hover:translate-x-1.5" />
                </span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
