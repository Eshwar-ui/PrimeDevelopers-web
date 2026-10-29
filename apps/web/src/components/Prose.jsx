import { Link } from 'react-router-dom'

// CMS copy with exactly two affordances: a blank line starts a new paragraph,
// and `[text](/path)` is a link. Site paths route in-app; anything else opens
// as an ordinary external link. Not Markdown — a body that happens to contain
// an asterisk or a hash should still read as typed.
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

const LINK_CLASS =
  'text-accent underline decoration-accent/40 underline-offset-4 transition-colors duration-300 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function inline(text) {
  const out = []
  let last = 0
  for (const match of text.matchAll(LINK)) {
    const [whole, label, href] = match
    if (match.index > last) out.push(text.slice(last, match.index))
    out.push(
      href.startsWith('/') ? (
        <Link key={match.index} to={href} className={LINK_CLASS}>
          {label}
        </Link>
      ) : (
        <a key={match.index} href={href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
          {label}
        </a>
      ),
    )
    last = match.index + whole.length
  }
  out.push(text.slice(last))
  return out
}

export default function Prose({ text, className = '' }) {
  const paragraphs = String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return paragraphs.map((paragraph, i) => (
    <p key={i} className={`${i > 0 ? 'mt-4' : ''} ${className}`}>
      {inline(paragraph)}
    </p>
  ))
}
