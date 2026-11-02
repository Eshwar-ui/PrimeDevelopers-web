import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PrimePill from '../components/PrimePill'
import { useSection } from '../context/ContentContext'
import { useHead } from '../hooks/useHead'
import { renderEmphasis } from '../lib/emphasis'
import { scrollToElement } from '../lib/scrollToElement'
import { slugify } from '../lib/slugify'
import { SITE_ORIGIN } from '../lib/site'
import { brandedTitle, plainText } from '../lib/seo'
import { breadcrumbSchema, faqSchema } from '../lib/structuredData'

// `[label](/path)` inside an answer becomes a link. An FAQ earns most of its
// SEO keep as an internal-link hub — it is the one page that names every
// subject the site covers — and the CMS stores plain text, so the convention
// lives here rather than making an editor write markup.
//
// Built fresh per call rather than held at module scope: a global regex carries
// `lastIndex` between calls, and a shared one would skip links in every second
// answer it was asked about.
const linkPattern = () => /\[([^\]]+)\]\(([^)\s]+)\)/g

function renderAnswer(text) {
  if (!text) return null
  const re = linkPattern()
  const out = []
  let last = 0
  let match
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const [, label, href] = match
    const className = 'font-semibold text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent'
    out.push(
      href.startsWith('/') ? (
        <Link key={match.index} to={href} className={className}>
          {label}
        </Link>
      ) : (
        <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {label}
        </a>
      )
    )
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// The same answer as plain prose, for the structured data. The link convention
// is a rendering detail; an acceptedAnswer carrying raw `[label](/path)` would
// publish the syntax as if it were the answer.
const plainAnswer = (text) => (text ?? '').replace(linkPattern(), '$1')

export default function FaqPage() {
  const p = useSection('faq_page')
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(null)

  // Only questions that actually have an answer. A half-filled row in the CMS
  // would otherwise reach both the page and the FAQPage graph, and an empty
  // acceptedAnswer is invalid structured data rather than a cosmetic blank.
  //
  // Each one also gets an anchor, so a single question can be linked to, cited
  // and shared on its own — /faq#can-i-book-a-tour. That is what lets a search
  // result jump straight to the answer instead of the top of the page, and it
  // gives the sales team a link to paste into a reply.
  const items = useMemo(() => {
    const taken = new Set()
    return (p.items ?? [])
      .filter((item) => item?.question && item?.answer)
      .map((item) => {
        const base = slugify(item.question) || 'question'
        // Two questions that slug alike would leave one of them unreachable.
        let id = base
        for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
        taken.add(id)
        return { ...item, id }
      })
  }, [p.items])

  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))], [items])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      const inCategory = !category || item.category === category
      const inSearch =
        !needle || `${item.question} ${item.answer} ${item.category ?? ''}`.toLowerCase().includes(needle)
      return inCategory && inSearch
    })
  }, [items, query, category])

  // Grouped for display in the order the CMS lists the topics, not
  // alphabetically: an FAQ is a running order, and the client reorders it by
  // moving rows. Anything with no topic falls into one trailing group.
  const groups = useMemo(() => {
    const order = [...categories, null]
    return order
      .map((name) => ({ name, items: visible.filter((item) => (item.category || null) === name) }))
      .filter((group) => group.items.length)
  }, [categories, visible])

  const heading = p.heroHeading || 'Frequently asked questions'
  const graphs = useMemo(
    () => [
      faqSchema(items.map((item) => ({ question: item.question, answer: plainAnswer(item.answer) }))),
      breadcrumbSchema(
        [
          { name: 'Home', path: '/' },
          { name: p.breadcrumbLabel || 'FAQ', path: '/faq' },
        ],
        SITE_ORIGIN
      ),
    ],
    [items, p.breadcrumbLabel]
  )

  // The route table in lib/seo already gave this page its title and
  // description; what is set here overrides them from the CMS, so an editor
  // who fills in `seoTitle` still wins. Leaving a field empty is not an
  // override — an absent value writes no tag, so the table's copy stands
  // rather than being replaced by a blank one.
  //
  // The FAQPage graph is built from the same list the page renders, so the
  // two cannot drift: every answer a crawler is shown is an answer a visitor
  // can find. This no longer buys an expandable FAQ block in Google — that
  // rich result was restricted to government and health sites in 2023 — but
  // it is still how an answer engine reads a page as a set of questions.
  useHead({
    path: '/faq',
    title: p.seoTitle || brandedTitle(plainText(heading)),
    description: p.seoDescription || p.heroParagraph || undefined,
    jsonLd: graphs,
  })

  // Arriving on /faq#some-question opens that answer and scrolls to it.
  // `scrollToElement` rather than scrollIntoView because Lenis owns the scroll
  // position and swallows a native smooth one, and because it waits out the
  // route's own scroll-to-top before aiming.
  useEffect(() => {
    const id = decodeURIComponent((location.hash || '').slice(1))
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    return scrollToElement(el, { offset: -120 })
  }, [location.hash, items])

  const reset = () => {
    setQuery('')
    setCategory(null)
  }

  // PrimePill is a plain anchor, which is right for a hash link but would
  // hard-navigate a route. The same handler the properties hero uses.
  const onRoute = (href) => (event) => {
    if (!href?.startsWith('/')) return
    event.preventDefault()
    navigate(href)
  }

  const chip = (active) =>
    `min-h-11 rounded-full border px-5 font-body text-[13px] font-semibold transition-colors ${
      active ? 'border-accent bg-accent text-white dark:text-void' : 'border-content/20 hover:border-content/50'
    }`

  return (
    <div className="bg-base text-content">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section data-band="light" className="px-gutter pb-16 pt-36 md:pb-24 md:pt-44">
        <div className="mx-auto grid max-w-[1360px] gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            {p.heroEyebrow && (
              <span className="block font-body text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
                {p.heroEyebrow}
              </span>
            )}
            <h1 className="mt-6 max-w-[18ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
              {renderEmphasis(heading)}
            </h1>
          </div>
          <p className="max-w-[48ch] font-body text-[17px] leading-[1.7] text-content/65">{p.heroParagraph}</p>
        </div>
      </section>

      {/* ── The questions ────────────────────────────────────── */}
      <section data-band="light" className="bg-surface-alt px-gutter py-16 md:py-20">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid gap-5 border-b border-line pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="block">
              <span className="sr-only">Search the questions</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={p.searchPlaceholder}
                className="h-14 w-full border-b border-content/25 bg-transparent font-body text-[18px] text-content outline-none transition-colors placeholder:text-content/40 focus:border-accent lg:max-w-xl"
              />
            </label>
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2" aria-label="Filter questions by topic">
                <button type="button" onClick={() => setCategory(null)} aria-pressed={!category} className={chip(!category)}>
                  {p.allLabel || 'All'}
                </button>
                {categories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCategory(name)}
                    aria-pressed={category === name}
                    className={chip(category === name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {groups.length ? (
            groups.map((group) => (
              <div
                key={group.name ?? 'other'}
                className="grid gap-6 border-b border-line py-10 last:border-b-0 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-16 lg:py-14"
              >
                {group.name && (
                  <h2 className="font-display text-[clamp(1.35rem,2vw,1.9rem)] font-bold leading-tight tracking-[-0.01em] lg:sticky lg:top-28 lg:self-start">
                    {group.name}
                  </h2>
                )}
                {/* <details> rather than a button accordion: every answer stays
                    in the document while closed, so the text is there to be
                    crawled, found by ctrl-F and read by a screen reader without
                    anything having to be clicked first. The FAQPage graph above
                    is built from this same list for the same reason. */}
                <div className={`divide-y divide-line border-y border-line ${group.name ? '' : 'lg:col-span-2'}`}>
                  {group.items.map((item) => (
                    <details key={item.id} id={item.id} className="group scroll-mt-28 py-5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                        <h3 className="font-display text-lg font-bold text-content">{item.question}</h3>
                        <span aria-hidden className="text-accent transition-transform duration-300 group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 max-w-[62ch] whitespace-pre-line font-body text-[15px] leading-[1.7] text-content/70">
                        {renderAnswer(item.answer)}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-24 text-center">
              <p className="font-display text-2xl font-semibold">{p.emptyHeading || 'No matching questions yet.'}</p>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 font-body text-sm font-semibold text-accent underline underline-offset-4"
                >
                  {p.emptyResetLabel || 'Clear search'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Still stuck ──────────────────────────────────────── */}
      {p.closingHeading && (
        <section data-band="light" className="px-gutter py-20 md:py-28">
          <div className="mx-auto max-w-[1360px]">
            {p.closingEyebrow && (
              <span className="block font-body text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
                {p.closingEyebrow}
              </span>
            )}
            <h2 className="mt-6 max-w-[20ch] text-balance font-display font-bold leading-[1.08] tracking-[-0.02em] [font-size:clamp(1.9rem,3.4vw,3rem)]">
              {renderEmphasis(p.closingHeading)}
            </h2>
            {p.closingParagraph && (
              <p className="mt-6 max-w-[52ch] font-body text-[16px] leading-[1.7] text-content/70">
                {p.closingParagraph}
              </p>
            )}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <PrimePill href={p.ctaHref || '/contact'} onClick={onRoute(p.ctaHref || '/contact')}>
                {p.ctaLabel || 'Talk to us'}
              </PrimePill>
              {p.ctaSecondaryLabel && (
                <PrimePill
                  variant="outline"
                  href={p.ctaSecondaryHref || '/learn'}
                  onClick={onRoute(p.ctaSecondaryHref || '/learn')}
                >
                  {p.ctaSecondaryLabel}
                </PrimePill>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
