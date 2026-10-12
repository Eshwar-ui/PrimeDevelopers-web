import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { sized, srcSetFor } from '../lib/images'

/**
 * The subset of Markdown a journal post is written in — headings, paragraphs,
 * lists, quotes, images, rules, and bold / italic / links inline.
 *
 * Hand-rolled rather than a library: this is the whole of what the admin is
 * told it can use, and rendering straight to React elements means there is no
 * HTML string anywhere for a stray `<script>` in a post to ride in on. A body
 * written before Markdown — paragraphs separated by blank lines — renders
 * exactly as it did.
 */

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const IMAGE = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)\s*$/
const QUOTE = /^>\s?/
const BULLET = /^\s*[-*+]\s+/
const NUMBER = /^\s*\d+[.)]\s+/

const startsBlock = (line) =>
  HEADING.test(line) || RULE.test(line) || IMAGE.test(line) || QUOTE.test(line) || BULLET.test(line) || NUMBER.test(line)

/** Plain text of an inline string — for heading ids and the contents list. */
export const plainText = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')

const idFor = (text) =>
  plainText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export function parseMarkdown(source = '') {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  const usedIds = new Map()
  let i = 0

  const collectList = (marker) => {
    const items = []
    while (i < lines.length && (marker.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
      if (marker.test(lines[i])) items.push(lines[i].replace(marker, '').trim())
      else items[items.length - 1] += ` ${lines[i].trim()}`
      i++
    }
    return items
  }

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    let m
    if ((m = line.match(HEADING))) {
      const text = m[2]
      const base = idFor(text) || 'section'
      const seen = usedIds.get(base) ?? 0
      usedIds.set(base, seen + 1)
      // `#` and `##` both become h2 — the page title is the only h1.
      blocks.push({ type: 'heading', level: m[1].length <= 2 ? 2 : 3, text, id: seen ? `${base}-${seen + 1}` : base })
      i++
    } else if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      i++
    } else if ((m = line.match(IMAGE))) {
      blocks.push({ type: 'image', alt: m[1], src: m[2], caption: m[3] ?? '' })
      i++
    } else if (QUOTE.test(line)) {
      const quoted = []
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ''))
      const paragraphs = quoted.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean)
      blocks.push({ type: 'quote', paragraphs })
    } else if (BULLET.test(line)) {
      blocks.push({ type: 'list', ordered: false, items: collectList(BULLET) })
    } else if (NUMBER.test(line)) {
      blocks.push({ type: 'list', ordered: true, items: collectList(NUMBER) })
    } else {
      const text = []
      while (i < lines.length && lines[i].trim() && !(text.length && startsBlock(lines[i]))) text.push(lines[i++].trim())
      blocks.push({ type: 'paragraph', text: text.join(' ') })
    }
  }
  return blocks
}

/** The h2s, in order, for the article's contents list. */
export const headingsOf = (blocks) =>
  blocks.filter((b) => b.type === 'heading' && b.level === 2).map((b) => ({ id: b.id, text: plainText(b.text) }))

const SAFE_HREF = /^(\/|#|https?:\/\/|mailto:|tel:)/i
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*/g

function Inline({ text }) {
  const out = []
  let last = 0
  let m
  // A fresh instance per call: this recurses, and a shared /g regex would have
  // its position reset by the inner call mid-loop.
  const pattern = new RegExp(INLINE.source, 'g')
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = m.index
    if (m[1] !== undefined) {
      const [, label, href] = m
      const className =
        'font-semibold text-accent underline decoration-accent/35 underline-offset-[5px] transition-colors hover:decoration-accent'
      if (!SAFE_HREF.test(href)) out.push(<Fragment key={key}>{label}</Fragment>)
      else if (href.startsWith('/'))
        out.push(
          <Link key={key} to={href} className={className}>
            <Inline text={label} />
          </Link>
        )
      else
        out.push(
          <a key={key} href={href} className={className} {...(/^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            <Inline text={label} />
          </a>
        )
    } else if (m[3] !== undefined) {
      out.push(
        <strong key={key} className="font-bold text-content">
          <Inline text={m[3]} />
        </strong>
      )
    } else {
      out.push(
        <em key={key}>
          <Inline text={m[4]} />
        </em>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/**
 * The article body. `blocks` comes from parseMarkdown so the page can build
 * its contents list from the same parse it renders.
 *
 * The first paragraph is set as a lead — larger and darker — which is the one
 * typographic cue a long read needs to tell the reader where it starts.
 */
export default function Markdown({ blocks }) {
  const lead = blocks.findIndex((b) => b.type === 'paragraph')

  return (
    <div className="font-body text-content [&>:first-child]:mt-0">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return block.level === 2 ? (
              <h2
                key={index}
                id={block.id}
                className="mt-16 scroll-mt-32 text-balance font-display text-[clamp(1.5rem,2.4vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-content"
              >
                <Inline text={block.text} />
              </h2>
            ) : (
              <h3 key={index} id={block.id} className="mt-10 scroll-mt-32 font-display text-[1.25rem] font-bold leading-snug text-content">
                <Inline text={block.text} />
              </h3>
            )
          case 'paragraph':
            return (
              <p
                key={index}
                className={
                  index === lead
                    ? 'mt-6 text-[19px] leading-[1.75] text-content/85 md:text-[20px]'
                    : 'mt-6 text-[17px] leading-[1.85] text-content/72'
                }
              >
                <Inline text={block.text} />
              </p>
            )
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul'
            return (
              <Tag
                key={index}
                className={`mt-6 flex flex-col gap-3 text-[17px] leading-[1.75] text-content/72 ${
                  block.ordered ? 'list-decimal pl-6 marker:font-bold marker:text-accent' : ''
                }`}
              >
                {block.items.map((item, i) => (
                  <li
                    key={i}
                    className={
                      block.ordered
                        ? 'pl-2'
                        : 'relative pl-6 before:absolute before:left-0 before:top-[0.72em] before:size-1.5 before:rounded-full before:bg-ember'
                    }
                  >
                    <Inline text={item} />
                  </li>
                ))}
              </Tag>
            )
          }
          case 'quote':
            return (
              <blockquote key={index} className="my-12 border-l-[3px] border-ember pl-6 md:pl-8">
                {block.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="mt-4 text-balance font-display text-[clamp(1.2rem,1.9vw,1.45rem)] font-medium leading-[1.45] text-content first:mt-0"
                  >
                    <Inline text={p} />
                  </p>
                ))}
              </blockquote>
            )
          case 'image':
            return (
              <figure key={index} className="my-12">
                <img
                  src={sized(block.src, 'card')}
                  srcSet={srcSetFor(block.src, 'card')}
                  sizes="(min-width: 1024px) 720px, 100vw"
                  alt={block.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full rounded-panel border border-line object-cover"
                />
                {block.caption && <figcaption className="mt-3 text-[13px] leading-relaxed text-content/50">{block.caption}</figcaption>}
              </figure>
            )
          case 'rule':
            return <hr key={index} className="my-14 border-line" />
          default:
            return null
        }
      })}
    </div>
  )
}
