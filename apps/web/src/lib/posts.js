/**
 * Journal post helpers.
 *
 * A post's category and byline travel inside its body as a short front-matter
 * block rather than as columns of their own:
 *
 *   ---
 *   category: Investing
 *   author: Prime Developer Team
 *   authorRole: Investor Relations
 *   ---
 *   The article itself, in Markdown…
 *
 * The `news` table is shared with the construction-management app and its
 * schema is applied by hand (see render.yaml), so three display fields did not
 * justify a migration. The admin editor reads and writes this block through
 * plain fields, so nobody has to type it.
 */

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export const DEFAULT_CATEGORY = 'Journal'

/** Split a stored body into its metadata and its Markdown content. */
export function parsePost(body = '') {
  const text = body ?? ''
  const match = text.match(FRONT_MATTER)
  if (!match) return { meta: {}, content: text }

  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/)
    if (pair) meta[pair[1]] = pair[2]
  }
  return { meta, content: text.slice(match[0].length) }
}

/** The inverse of parsePost — empty values are left out of the block. */
export function serializePost(meta, content = '') {
  const lines = Object.entries(meta)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    // A newline inside a value would end the block early and spill the rest
    // into the article.
    .map(([key, value]) => `${key}: ${value.replace(/\s*\n\s*/g, ' ').trim()}`)
  return lines.length ? `---\n${lines.join('\n')}\n---\n${content}` : content
}

/** Everything a card or the article header needs, derived once. */
export function postView(post) {
  const { meta, content } = parsePost(post.body)
  return {
    ...post,
    content,
    category: meta.category || DEFAULT_CATEGORY,
    author: meta.author || '',
    authorRole: meta.authorRole || '',
    readingTime: readingTime(`${post.excerpt ?? ''} ${content}`),
  }
}

export function readingTime(text = '') {
  const words = text
    // Image and link targets are not read.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\]\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 220))} min read`
}

export const formatDate = (value, month = 'short') =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month, day: 'numeric' }) : null
