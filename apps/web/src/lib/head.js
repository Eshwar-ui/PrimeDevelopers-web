/**
 * One description of a page's <head>, and the two ways to realise it.
 *
 * `headTags` turns a plain spec into the ordered list of tags a page needs.
 * `applyHead` writes that list into a live document and hands back an undo;
 * `renderHead` serialises the same list into HTML for the prerenderer
 * (scripts/prerender.mjs). Both callers read one function, so the tags a
 * crawler is served and the tags a visitor's browser ends up with cannot
 * drift — which is the whole point of this module existing, since the two are
 * produced on different machines at different times.
 *
 * Deliberately free of `./site`: that module reads `import.meta.env`, which
 * only exists under Vite, and this one has to run under plain node during the
 * build. So every URL here arrives absolute, already resolved by the caller.
 */

/** JSON in a <script> body ends at the first "</script>" it contains. */
const serialise = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

const escapeAttr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The tags for one page, in the order they should appear.
 *
 * Every field is optional but `title`. An absent value emits nothing at all
 * rather than an empty tag — an empty `<meta name="description">` is read as
 * a description the page chose not to write, which is worse than none.
 *
 * Open Graph and X fall back to the page's own title and description, so a
 * caller states them only where the social card should differ from the page.
 */
export function headTags(spec = {}) {
  const {
    title,
    description,
    canonical,
    robots,
    type = 'website',
    siteName,
    locale = 'en_US',
    image,
    imageAlt,
    // Only a purpose-made card has known dimensions; a hero photograph
    // reused as a card does not, and stating 1200×630 for one that isn't
    // makes the scraper crop to a size the image never had.
    imageSized = false,
    ogTitle,
    ogDescription,
    twitterDescription,
    // Anything this module has no opinion about, as plain name/content
    // pairs — the `geo.*` tags a property page carries, for instance. An
    // entry whose value is nullish emits nothing, so a caller can hand over
    // a half-filled record without filtering it first.
    extraMeta,
    jsonLd = [],
  } = spec

  const tags = []
  if (title) tags.push({ kind: 'title', text: title })

  const meta = (key, value) => {
    if (value == null || value === '') return
    tags.push({ kind: 'meta', attr: key.startsWith('og:') ? 'property' : 'name', key, content: value })
  }

  meta('description', description)
  meta('robots', robots)
  if (canonical) tags.push({ kind: 'link', rel: 'canonical', href: canonical })

  const cardTitle = ogTitle || title
  const cardDescription = ogDescription || description

  meta('og:type', type)
  meta('og:site_name', siteName)
  meta('og:locale', locale)
  meta('og:title', cardTitle)
  meta('og:description', cardDescription)
  meta('og:url', canonical)
  meta('og:image', image)
  if (image && imageSized) {
    meta('og:image:width', '1200')
    meta('og:image:height', '630')
  }
  meta('og:image:alt', imageAlt)

  // `summary_large_image` only renders large when there is an image to render;
  // with none, X falls back to the small card by itself, so this is safe to
  // state unconditionally.
  meta('twitter:card', 'summary_large_image')
  meta('twitter:title', cardTitle)
  meta('twitter:description', twitterDescription || cardDescription)
  meta('twitter:image', image)

  for (const [key, value] of Object.entries(extraMeta ?? {})) meta(key, value)

  for (const graph of jsonLd) if (graph) tags.push({ kind: 'jsonld', json: graph })

  return tags
}

/**
 * Writes the tags into `document` and returns a function that puts the head
 * back exactly as it was.
 *
 * The site has no per-route head management, so a tag left behind would
 * describe this page on whichever page the visitor opens next — a canonical
 * most of all. Restoring is therefore not tidiness, it is correctness, and it
 * runs in reverse so a tag this call overwrote twice unwinds in order.
 *
 * An existing tag is updated in place rather than replaced: `index.html` ships
 * a description and a title that every route would otherwise duplicate, and
 * updating keeps the document to one of each.
 */
export function applyHead(spec, doc = document) {
  const undo = []

  for (const tag of headTags(spec)) {
    if (tag.kind === 'title') {
      const previous = doc.title
      doc.title = tag.text
      undo.push(() => {
        doc.title = previous
      })
      continue
    }

    if (tag.kind === 'jsonld') {
      const script = doc.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = serialise(tag.json)
      doc.head.appendChild(script)
      undo.push(() => script.remove())
      continue
    }

    const [name, keyAttr, key, valueAttr, value] =
      tag.kind === 'meta'
        ? ['meta', tag.attr, tag.key, 'content', tag.content]
        : ['link', 'rel', tag.rel, 'href', tag.href]

    const existing = doc.head.querySelector(`${name}[${keyAttr}="${key}"]`)
    if (existing) {
      const previous = existing.getAttribute(valueAttr)
      existing.setAttribute(valueAttr, value)
      undo.push(() => (previous == null ? existing.removeAttribute(valueAttr) : existing.setAttribute(valueAttr, previous)))
    } else {
      const el = doc.createElement(name)
      el.setAttribute(keyAttr, key)
      el.setAttribute(valueAttr, value)
      doc.head.appendChild(el)
      undo.push(() => el.remove())
    }
  }

  return () => undo.reverse().forEach((fn) => fn())
}

/**
 * The same tags as HTML, for the prerenderer to splice into index.html.
 *
 * Indented to sit inside <head>, and newline-separated so a built file stays
 * readable to whoever opens it in the bucket wondering what a crawler sees.
 */
export function renderHead(spec, indent = '    ') {
  return headTags(spec)
    .map((tag) => {
      if (tag.kind === 'title') return `<title>${escapeAttr(tag.text)}</title>`
      if (tag.kind === 'jsonld') {
        return `<script type="application/ld+json">${serialise(tag.json)}</script>`
      }
      if (tag.kind === 'meta') return `<meta ${tag.attr}="${tag.key}" content="${escapeAttr(tag.content)}" />`
      return `<link rel="${tag.rel}" href="${escapeAttr(tag.href)}" />`
    })
    .map((line) => indent + line)
    .join('\n')
}
