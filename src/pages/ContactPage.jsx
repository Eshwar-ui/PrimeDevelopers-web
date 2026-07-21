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
            Contact — Prime Developers
          </span>
          <h1 className="font-display text-display font-light leading-[0.98] tracking-[-0.02em]">
            Explore options
            <br />
            with us <span className="italic text-accent-soft">today.</span>
          </h1>
          <p className="mt-8 max-w-[48ch] font-body text-lg leading-relaxed text-bone/65">
            Experienced Texas property leaders. Tell us about your goals and our team will be in
            touch.
          </p>
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
                {socials.map((s) => (
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
                  placeholder="Tell us about your project or enquiry…"
                  className="resize-none border-b border-[var(--color-line-inv)] bg-transparent pb-2.5 font-body text-base text-bone outline-none transition-colors placeholder:text-bone/25 focus:border-accent"
                />
              </label>

              <button
                type="submit"
                className="group relative mt-2 inline-flex items-center justify-center overflow-hidden rounded-full bg-accent px-6 py-3.5 font-body text-[14px] font-bold uppercase tracking-[0.1em] text-void"
              >
                <span className="absolute inset-0 translate-y-full bg-void/25 transition-transform duration-300 ease-out group-hover:translate-y-0" />
                <span className="relative flex items-center gap-1.5">
                  Send enquiry
                  <ArrowRight className="size-5 transition-transform duration-300 ease-out group-hover:translate-x-1.5" />
                </span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
