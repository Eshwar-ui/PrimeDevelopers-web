// Section kicker — an optional monumental index numeral, an accent dash, and a
// letter-spaced label. Understated on purpose: the big Fraunces headline that
// follows in each section carries the weight.
export default function SectionHeader({ title, index, tone = 'inv', className = '' }) {
  const inv = tone === 'inv' // inv = light text on a dark section
  const text = inv ? 'text-bone' : 'text-content'
  const dash = inv ? 'bg-accent-soft' : 'bg-accent'
  const idx = inv ? 'text-bone/15' : 'text-content/10'

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {index && (
        <span className={`numeral text-[2.6rem] leading-none md:text-[3.4rem] ${idx}`}>
          {index}
        </span>
      )}
      <span aria-hidden className={`h-px w-10 shrink-0 ${dash}`} />
      <h2 className={`font-body text-[13px] font-bold uppercase tracking-[0.28em] ${text}`}>
        {title}
      </h2>
    </div>
  )
}
