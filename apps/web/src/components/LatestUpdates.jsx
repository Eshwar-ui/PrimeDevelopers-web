import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSection, useNews } from '../context/ContentContext'
import SectionIntro from './SectionIntro'
import SocialIcon from './SocialIcon'
import { platformMeta } from '../lib/platforms'

// One horizontal stream keeps the homepage composed while still surfacing six
// updates. Responsive card widths leave the next item within reach instead of
// turning the section into a second archive grid.
const MAX_CARDS = 6
const FOLLOW_PLATFORMS = ['instagram', 'facebook', 'x', 'youtube', 'whatsapp']

// Missing and unparseable dates both sort last rather than to 1970 — an update
// nobody dated should fall to the end of the stream, not the head of it.
const stamp = (value) => {
  const t = Date.parse(value ?? '')
  return Number.isNaN(t) ? -Infinity : t
}

const formatDate = (value) => {
  const t = Date.parse(value ?? '')
  if (Number.isNaN(t)) return null
  return new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0"
    >
      <path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

/**
 * What the company has been doing lately, wherever it happened.
 *
 * This replaced a straight news teaser. The journal is real but slow; the social
 * accounts move weekly, and a homepage that only surfaced the blog read as a
 * company that had gone quiet since its last long-form post.
 *
 * The social side is curated rather than synced, and that is a deliberate limit
 * rather than a stopgap: Instagram and Facebook both need Meta Graph credentials
 * and app review to read a feed, and WhatsApp has no readable feed at all. An
 * admin pastes the post's own URL, so every card still points at the live thing.
 * The item shape is what a future sync would write, so wiring one up later fills
 * this table rather than replacing it.
 */
export default function LatestUpdates() {
  const { heading, paragraph, items = [], scrollLabel, followText } = useSection('news_home')
  const { socials = [] } = useSection('footer')
  const { socials: contactSocials = [] } = useSection('contact_page')
  const posts = useNews()
  const railRef = useRef(null)
  const [railPosition, setRailPosition] = useState({ atStart: true, atEnd: false })

  // Blog posts and curated updates normalised to one shape before they are
  // merged — the sort has to compare them, and a card must not care which side
  // of the union it came from.
  const stream = [
    ...posts.map((p) => ({
      key: `post-${p.slug}`,
      platform: 'article',
      title: p.title,
      body: p.excerpt,
      image: p.coverImage,
      to: `/news/${p.slug}`,
      date: p.publishedAt,
    })),
    ...items.map((it, i) => ({
      key: `update-${i}`,
      platform: (it.platform ?? '').trim().toLowerCase() || 'instagram',
      title: it.title,
      body: it.caption,
      image: it.image,
      href: it.href,
      date: it.postedAt,
    })),
  ]
    .filter((u) => u.title || u.image)
    .sort((a, b) => stamp(b.date) - stamp(a.date))
    .slice(0, MAX_CARDS)

  // Assembled from both account lists the CMS already keeps rather than from a
  // third one of its own. The footer holds the site-wide set; the contact page
  // is where the real WhatsApp number happens to live. Deduped by label,
  // preferring whichever entry has a URL that actually goes somewhere, so a
  // placeholder '#' in one list never wins over a real link in the other.
  const socialByPlatform =
    [...socials, ...contactSocials].reduce((acc, s) => {
      const key = (s.label ?? '').trim().toLowerCase()
      if (!key) return acc
      const real = (href) => Boolean(href) && href !== '#'
      if (!acc[key] || (real(s.href) && !real(acc[key].href))) acc[key] = s
      return acc
    }, {})

  // Keep the requested channels visible even before every profile URL has
  // been entered in the CMS. Missing links render as non-interactive pills;
  // once an editor adds a real URL, the same pill becomes an external link.
  const follow = FOLLOW_PLATFORMS.map((platform) => ({
    platform,
    label: platformMeta(platform).label,
    href: socialByPlatform[platform]?.href,
  }))

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return undefined

    const updatePosition = () => {
      const remaining = rail.scrollWidth - rail.clientWidth - rail.scrollLeft
      setRailPosition({
        atStart: rail.scrollLeft <= 2,
        atEnd: remaining <= 2,
      })
    }

    updatePosition()
    rail.addEventListener('scroll', updatePosition, { passive: true })
    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(rail)

    return () => {
      rail.removeEventListener('scroll', updatePosition)
      resizeObserver.disconnect()
    }
  }, [stream.length])

  const scrollRail = (direction) => {
    const rail = railRef.current
    const card = rail?.firstElementChild
    if (!rail || !card) return
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0
    rail.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: 'smooth' })
  }

  if (stream.length === 0 && follow.length === 0) return null

  return (
    <section
      id="news"
      data-band="light"
      className="bg-base px-gutter py-20 text-content md:px-gutter-lg md:py-28"
    >
      <div className="mx-auto max-w-[1560px]">
        <SectionIntro heading={heading} paragraph={paragraph} />

        {stream.length > 0 && (
          <>
            <div className="mt-10 flex items-center justify-between gap-5 md:mt-12">
              <p className="flex items-center gap-3 font-body text-[12px] font-bold uppercase tracking-[0.16em] text-content/45">
                <span aria-hidden className="h-px w-8 bg-content/20" />
                {scrollLabel}
              </p>
              <div className="flex items-center gap-2" aria-label="Latest updates navigation">
                <button
                  type="button"
                  onClick={() => scrollRail(-1)}
                  disabled={railPosition.atStart}
                  aria-label="Previous updates"
                  aria-controls="latest-updates-rail"
                  className="group grid size-11 place-items-center rounded-full border border-content/20 text-content outline-none transition-[color,border-color,background-color,transform,opacity] duration-300 ease-brand hover:border-content hover:bg-content hover:text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                >
                  <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 transition-transform duration-300 ease-brand group-hover:-translate-x-0.5 motion-reduce:transform-none">
                    <path d="m14.5 5-7 7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => scrollRail(1)}
                  disabled={railPosition.atEnd}
                  aria-label="Next updates"
                  aria-controls="latest-updates-rail"
                  className="group grid size-11 place-items-center rounded-full border border-content/20 text-content outline-none transition-[color,border-color,background-color,transform,opacity] duration-300 ease-brand hover:border-content hover:bg-content hover:text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                >
                  <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 motion-reduce:transform-none">
                    <path d="m9.5 5 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <ul
              ref={railRef}
              id="latest-updates-rail"
              aria-label="Latest updates"
              className="mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-5 scroll-smooth [scrollbar-color:color-mix(in_srgb,var(--color-content)_22%,transparent)_transparent] [scrollbar-width:thin] md:mt-5 md:gap-6"
            >
            {stream.map((u) => {
              const { label, tint } = platformMeta(u.platform)
              const external = !u.to && u.href
              const date = formatDate(u.date)

              // An internal route gets a router link; an external post gets a
              // real anchor with the tab-opening contract spelled out. Same
              // card either way — the difference belongs in the element, not
              // in a second copy of the markup.
              const Wrapper = u.to ? Link : 'a'
              const linkProps = u.to
                ? { to: u.to }
                : {
                    href: u.href || undefined,
                    target: u.href ? '_blank' : undefined,
                    rel: u.href ? 'noopener noreferrer' : undefined,
                  }

              return (
                <li
                  key={u.key}
                  className="w-[86%] shrink-0 snap-start sm:w-[66%] md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
                >
                  <Wrapper
                    {...linkProps}
                    className="group flex h-full flex-col overflow-hidden rounded-frame border border-content/10 bg-surface p-5 outline-none transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/40 hover:shadow-[0_30px_70px_-50px_rgba(0,0,0,0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <div className="relative overflow-hidden rounded-panel bg-surface-alt">
                      {u.image ? (
                        <img
                          src={u.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="aspect-16/10 w-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.05]"
                        />
                      ) : (
                        // The platform's own mark, large and faint. A card with
                        // no picture still has to be the same shape as the five
                        // beside it, and this at least says where it came from.
                        <div aria-hidden className="flex aspect-16/10 w-full items-center justify-center">
                          <SocialIcon
                            platform={u.platform}
                            className="size-10 opacity-25"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-2 pt-5">
                      <p className="flex items-center gap-2 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-content/45">
                        <SocialIcon
                          platform={u.platform}
                          className="size-3.5 shrink-0"
                          // Inline because the tints are per-platform values,
                          // not palette tokens — a utility class per brand
                          // would put six one-off colours in the theme.
                          style={{ color: tint }}
                        />
                        {label}
                        {date && (
                          <>
                            <span aria-hidden className="text-content/25">·</span>
                            <time dateTime={u.date} className="font-medium tracking-[0.06em]">
                              {date}
                            </time>
                          </>
                        )}
                      </p>

                      <h3 className="mt-2.5 font-display text-[1.15rem] font-bold leading-tight tracking-[-0.01em] text-content transition-colors duration-300 group-hover:text-accent">
                        {u.title}
                      </h3>

                      {u.body && (
                        <p className="mt-3 flex-1 font-body text-[14px] leading-[1.7] text-content/55 line-clamp-3">
                          {u.body}
                        </p>
                      )}

                      <span className="mt-6 inline-flex items-center gap-2 font-body text-[13px] font-bold text-accent">
                        {external ? 'View post' : 'Read more'}
                        {external ? (
                          <ExternalIcon />
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-1 motion-reduce:transform-none"
                          >
                            <path d="M5 12h14m-6-6 6 6-6 6" />
                          </svg>
                        )}
                        {external && <span className="sr-only">(opens in a new tab)</span>}
                      </span>
                    </div>
                  </Wrapper>
                </li>
              )
            })}
            </ul>
          </>
        )}

        {/* ── the follow strip ──────────────────────────────────────────
            WhatsApp lives here rather than among the cards above, and that is
            the honest place for it: a WhatsApp channel has no readable feed, so
            it can never be a post — only a way to reach us. The rest of the row
            keeps it company so it doesn't read as a lone afterthought.

            Reads the socials the footer already holds, so there is one list of
            accounts in the CMS rather than two that drift apart. */}
        {follow.length > 0 && (
          <div className="mt-12 flex flex-col items-start gap-5 border-t border-content/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-[14px] text-content/55">
              {followText}
            </p>
            <ul className="flex flex-wrap items-center gap-2.5">
              {follow.map((s) => {
                const linked = Boolean(s.href) && s.href !== '#'
                const Wrapper = linked ? 'a' : 'span'

                return (
                  <li key={s.platform}>
                    <Wrapper
                      {...(linked
                        ? { href: s.href, target: '_blank', rel: 'noopener noreferrer' }
                        : { 'aria-disabled': true, title: `${s.label} link coming soon` })}
                      className={`inline-flex min-h-11 items-center gap-2.5 rounded-full border px-4 font-body text-[13px] font-medium outline-none transition-[color,border-color,background-color] duration-300 ease-brand ${
                        linked
                          ? 'border-content/20 text-content/75 hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                          : 'cursor-default border-content/10 text-content/45'
                      }`}
                    >
                      <SocialIcon
                        platform={s.platform}
                        className="size-4 shrink-0"
                        style={{ color: platformMeta(s.platform).tint }}
                      />
                      {s.label}
                      {linked && <span className="sr-only">(opens in a new tab)</span>}
                    </Wrapper>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
