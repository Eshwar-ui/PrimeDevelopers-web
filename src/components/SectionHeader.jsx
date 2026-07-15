// Minimal section label — a short accent dash and small letter-spaced text.
// Deliberately understated: whitespace and the content carry the page.
export default function SectionHeader({ title, tone = 'ink', className = '' }) {
  const inv = tone === 'inv'
  const text = inv ? 'text-bone' : 'text-ink'
  const dash = inv ? 'bg-accent-soft' : 'bg-accent'

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span aria-hidden className={`h-px w-10 shrink-0 ${dash}`} />
      <h2 className={`font-body text-[13px] font-bold uppercase tracking-[0.24em] ${text}`}>
        {title}
      </h2>
    </div>
  )
}
