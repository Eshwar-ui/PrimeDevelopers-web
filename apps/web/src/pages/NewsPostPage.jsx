import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'motion/react'
import { CalendarBlank, Check, Clock, EnvelopeSimple, FacebookLogo, LinkSimple, LinkedinLogo, XLogo } from '@phosphor-icons/react'
import { useNews, useNewsPost } from '../context/ContentContext'
import Markdown, { headingsOf, parseMarkdown } from '../components/Markdown'
import NewsCard from '../components/NewsCard'
import ActionButton from '../components/ActionButton'
import ArrowRight from '../components/ArrowRight'
import { lenis } from '../hooks/useSmoothScroll'
import { sized, srcSetFor } from '../lib/images'
import { formatDate, postView } from '../lib/posts'

// Every section carries data-band="light". The navbar decides its own colour by
// observing a thin strip under itself for elements tagged that way, so a light
// section that omits it gets white chrome on a white ground — the links are
// still there, just invisible.

const SITE_NAME = 'Prime Developers'

/**
 * Title, description and BlogPosting structured data for the open article.
 *
 * The site has no per-route head management, so these are written directly
 * and put back on the way out — a description left behind would describe this
 * article on whichever page the visitor goes to next.
 */
function useArticleHead(post) {
  useEffect(() => {
    if (!post) return
    const previousTitle = document.title
    document.title = `${post.title} — ${SITE_NAME}`

    const description = document.querySelector('meta[name="description"]')
    const previousDescription = description?.getAttribute('content')
    if (description && post.excerpt) description.setAttribute('content', post.excerpt)

    const ld = document.createElement('script')
    ld.type = 'application/ld+json'
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt || undefined,
      image: post.coverImage ? [post.coverImage] : undefined,
      datePublished: post.publishedAt || undefined,
      dateModified: post.updatedAt || post.publishedAt || undefined,
      author: { '@type': post.author ? 'Person' : 'Organization', name: post.author || SITE_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME },
      mainEntityOfPage: window.location.href,
    })
    document.head.appendChild(ld)

    return () => {
      document.title = previousTitle
      if (description && previousDescription != null) description.setAttribute('content', previousDescription)
      ld.remove()
    }
  }, [post])
}

/** The h2 currently being read, for the contents list. */
function useActiveHeading(ids) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    if (!ids.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      // A band across the upper third: a heading counts as current once it has
      // scrolled up under the reader's eye, not the moment it peeks in below.
      { rootMargin: '-15% 0px -65% 0px' },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [ids])
  return active
}

const scrollToId = (id) => (e) => {
  const target = document.getElementById(id)
  if (!target) return
  e.preventDefault()
  // Lenis owns the scroll position when it has mounted; native otherwise.
  if (lenis.current) lenis.current.scrollTo(target, { offset: -110 })
  else target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

function ShareLinks({ title, className = '' }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
  const enc = encodeURIComponent
  const links = [
    { label: 'Share on LinkedIn', Icon: LinkedinLogo, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: 'Share on X', Icon: XLogo, href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { label: 'Share on Facebook', Icon: FacebookLogo, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'Share by email', Icon: EnvelopeSimple, href: `mailto:?subject=${enc(title)}&body=${enc(url)}` },
  ]
  const button =
    'flex size-10 items-center justify-center rounded-full border border-content/15 text-content/70 transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the address bar still has it */
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map(({ label, Icon, href }) => (
        <a key={label} href={href} target={href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer" aria-label={label} className={button}>
          <Icon aria-hidden className="size-[18px]" />
        </a>
      ))}
      <button type="button" onClick={copy} aria-label={copied ? 'Link copied' : 'Copy link'} className={button}>
        {copied ? <Check aria-hidden className="size-[18px] text-accent" /> : <LinkSimple aria-hidden className="size-[18px]" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
    </div>
  )
}

export default function NewsPostPage() {
  const { slug } = useParams()
  const raw = useNewsPost(slug)
  const allPosts = useNews()
  const post = useMemo(() => (raw ? postView(raw) : null), [raw])
  const blocks = useMemo(() => (post ? parseMarkdown(post.content) : []), [post])
  const headings = useMemo(() => headingsOf(blocks), [blocks])
  const headingIds = useMemo(() => headings.map((h) => h.id), [headings])
  const activeHeading = useActiveHeading(headingIds)
  const related = useMemo(
    () => allPosts.filter((p) => p.slug !== slug).slice(0, 3).map(postView),
    [allPosts, slug],
  )

  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 })

  useArticleHead(post)

  if (!post) {
    return (
      <section data-band="light" className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-base px-6 text-center">
        <h1 className="font-display text-3xl font-bold tracking-[-0.01em] text-content">Post not found</h1>
        <Link to="/news" className="font-body text-[14px] uppercase tracking-[0.14em] text-accent transition-colors duration-300 hover:text-prime-deep">
          ← Back to news
        </Link>
      </section>
    )
  }

  const date = formatDate(post.publishedAt, 'long')
  const initials = (post.author || SITE_NAME)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <article className="bg-base text-content">
      {/* Reading progress. Above the navbar (z-50) so it reads as part of the
          window rather than of the page. */}
      <motion.div aria-hidden style={{ scaleX: progress }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-accent" />

      {/* ── header ───────────────────────────────────────────── */}
      <header data-band="light" className="px-gutter pb-12 pt-32 md:pb-16 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-body text-[13px] text-content/55">
            <Link to="/news" className="group inline-flex min-h-11 items-center gap-2 font-semibold transition-colors hover:text-accent">
              <ArrowRight className="size-4 rotate-180 transition-transform duration-300 group-hover:-translate-x-1" />
              Journal
            </Link>
            <span aria-hidden>/</span>
            <span className="font-semibold text-accent">{post.category}</span>
          </nav>

          <h1 className="mt-6 max-w-[22ch] text-balance font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-bold leading-[1.04] tracking-[-0.035em] text-content">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-6 max-w-[60ch] font-body text-[clamp(1.05rem,1.6vw,1.25rem)] leading-[1.65] text-content/65">{post.excerpt}</p>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-line pt-7">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/12 font-body text-[13px] font-bold text-accent">
                {initials}
              </span>
              <div className="font-body leading-tight">
                <p className="text-[14px] font-bold text-content">{post.author || SITE_NAME}</p>
                {post.authorRole && <p className="mt-1 text-[12px] text-content/55">{post.authorRole}</p>}
              </div>
            </div>
            <span aria-hidden className="hidden h-8 w-px bg-line sm:block" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-[13px] text-content/60">
              {date && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarBlank aria-hidden className="size-4" />
                  <time dateTime={post.publishedAt}>{date}</time>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden className="size-4" />
                {post.readingTime}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── cover ────────────────────────────────────────────── */}
      {post.coverImage && (
        <div data-band="light" className="px-gutter">
          <div className="mx-auto max-w-[1200px] overflow-hidden rounded-frame border border-line bg-surface-alt">
            <img
              src={sized(post.coverImage, 'full')}
              srcSet={srcSetFor(post.coverImage, 'full')}
              sizes="(min-width: 1360px) 1200px, 90vw"
              alt=""
              fetchPriority="high"
              decoding="async"
              className="aspect-[16/9] w-full object-cover md:aspect-[2/1]"
            />
          </div>
        </div>
      )}

      {/* ── body ─────────────────────────────────────────────── */}
      <section data-band="light" className="px-gutter pb-20 pt-14 md:pb-28 md:pt-20">
        <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-20">
          <div className="min-w-0 max-w-[70ch]">
            <Markdown blocks={blocks} />

            <div className="mt-16 flex flex-wrap items-center justify-between gap-5 border-t border-line pt-8">
              <p className="font-body text-[12px] font-bold uppercase tracking-[0.14em] text-content/50">Share this article</p>
              <ShareLinks title={post.title} />
            </div>
          </div>

          {/* The contents list only earns its column on a read long enough to
              need finding your way around; the share buttons above cover the
              rest at every width. */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 flex flex-col gap-10">
              {headings.length >= 2 && (
                <nav aria-label="On this page">
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/45">On this page</p>
                  <ol className="mt-4 flex flex-col border-l border-line">
                    {headings.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          onClick={scrollToId(h.id)}
                          aria-current={activeHeading === h.id ? 'location' : undefined}
                          className={`-ml-px block border-l-2 py-2 pl-4 font-body text-[13px] leading-snug transition-colors duration-200 ${
                            activeHeading === h.id
                              ? 'border-accent font-semibold text-content'
                              : 'border-transparent text-content/55 hover:text-content'
                          }`}
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <div>
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-content/45">Share</p>
                <ShareLinks title={post.title} className="mt-4" />
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ── call to action ───────────────────────────────────── */}
      <section data-band="light" className="px-gutter pb-20 md:pb-28">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 rounded-frame border border-accent/25 bg-surface-alt p-7 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="max-w-[36rem]">
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Talk to the team</p>
            <h2 className="mt-3 text-balance font-display text-[clamp(1.5rem,2.6vw,2.2rem)] font-bold leading-[1.1] tracking-[-0.025em] text-content">
              Questions about something in this article?
            </h2>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-content/62">
              Our team can walk you through current properties and opportunities across Central Texas.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionButton as={Link} to="/contact">
              Get in touch
              <ArrowRight className="size-4 -rotate-45 transition-transform duration-200 ease-brand group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </ActionButton>
            <ActionButton as={Link} to="/properties" tone="ghost">
              Explore properties
            </ActionButton>
          </div>
        </div>
      </section>

      {/* ── more from the journal ────────────────────────────── */}
      {related.length > 0 && (
        <section data-band="light" className="border-t border-line bg-base px-gutter py-20 md:py-28">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-[clamp(1.6rem,2.8vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-content">More from the journal</h2>
              <Link to="/news" className="group inline-flex items-center gap-2 font-body text-[13px] font-bold text-accent">
                All articles <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <NewsCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  )
}
