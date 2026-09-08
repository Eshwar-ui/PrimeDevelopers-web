import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { lenis } from '../hooks/useSmoothScroll'
import { useSection } from '../context/ContentContext'
import { slugify } from '../lib/slugify'
import ArrowRight from './ArrowRight'

/**
 * The shared shell for /privacy and /terms.
 *
 * These two are the only pages on the site whose body is not CMS-driven, and
 * that is deliberate. Legal text is reviewed and versioned by whoever signs off
 * on it; putting it behind a rich-text field invites a marketing edit to a
 * document that a court may one day read. What *is* pulled from the CMS is the
 * contact block — an email address that has gone stale in a privacy policy is
 * a real problem, and it is exactly the kind of thing an editor changes.
 *
 * `Clause` derives its anchor from its own heading and the contents rail
 * derives its links from the same strings, so a heading and the link to it
 * cannot drift apart — and the numbering is positional, so inserting a clause
 * in the middle does not mean renumbering everything after it by hand.
 */

export function Clause({ title, children }) {
  const id = slugify(title)
  return (
    <section id={id} className="scroll-mt-32">
      <h2 className="font-display text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <div className="mt-4 space-y-4 font-body text-[16px] leading-[1.8] text-content/70">
        {children}
      </div>
    </section>
  )
}

export function ClauseList({ items }) {
  return (
    <ul className="space-y-2.5 pl-5">
      {items.map((item) => (
        <li key={typeof item === 'string' ? item : item.key} className="list-disc marker:text-accent">
          {typeof item === 'string' ? item : item.body}
        </li>
      ))}
    </ul>
  )
}

export default function LegalPage({ title, summary, updated, headings = [], children }) {
  // The contents rail is derived from the same strings the Clause headings
  // use, so a heading and its anchor cannot drift apart.
  const items = useMemo(
    () => headings.map((h) => ({ label: h, id: slugify(h) })),
    [headings],
  )
  const { email, phone } = useSection('footer')

  // The href stays a real one so the link is copyable and works with
  // JavaScript off, but the jump goes through Lenis — a native hash jump sets
  // scrollTop directly and Lenis spends the next frame undoing it.
  const jumpTo = (e, id) => {
    const target = document.getElementById(id)
    if (!target || !lenis.current) return
    e.preventDefault()
    lenis.current.scrollTo(target, { offset: -110 })
    // The hash is still worth writing: it is what makes the position
    // shareable, and `replace` keeps the back button pointing at the page the
    // reader arrived from rather than at eleven of its own headings.
    window.history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className="bg-base text-content">
      <header data-band="light" className="px-gutter pb-12 pt-32 md:px-gutter-lg md:pb-16 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <Link
            to="/"
            className="group inline-flex min-h-11 items-center gap-2 font-body text-sm font-semibold text-content/55 transition-colors hover:text-accent"
          >
            <ArrowRight className="size-4 rotate-180 transition-transform duration-300 group-hover:-translate-x-1" />
            Home
          </Link>
          <h1 className="mt-9 max-w-[18ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            {title}
          </h1>
          {summary && (
            <p className="mt-7 max-w-[58ch] font-body text-[clamp(1.05rem,2vw,1.3rem)] leading-relaxed text-content/65">
              {summary}
            </p>
          )}
          {updated && (
            <p className="mt-7 font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">
              Last updated {updated}
            </p>
          )}
        </div>
      </header>

      <section data-band="light" className="px-gutter pb-24 md:px-gutter-lg md:pb-32">
        <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20">
          {/* Contents first in the source order, so a screen reader and a
              keyboard both meet the map before the territory. `order` moves it
              to the right-hand rail visually, and below `lg` it simply sits
              where it already is — above the text, which is where a table of
              contents belongs on a phone anyway. */}
          <aside className="lg:order-2">
            <nav aria-label="On this page" className="rounded-[20px] bg-surface-alt p-7 lg:sticky lg:top-28">
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-accent">
                On this page
              </p>
              <ul className="mt-5 space-y-1">
                {items.map((item, i) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => jumpTo(e, item.id)}
                      className="flex min-h-9 items-start gap-3 font-body text-[14px] leading-[1.5] text-content/60 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
                    >
                      <span className="mt-px w-5 shrink-0 tabular-nums text-content/35">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>

              <div className="mt-7 border-t border-line pt-6">
                <p className="font-body text-[13px] leading-[1.6] text-content/55">
                  Questions about this page?
                </p>
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="mt-1.5 inline-flex min-h-9 items-center font-body text-[14px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
                  >
                    {email}
                  </a>
                )}
                {phone && (
                  <p className="font-body text-[14px] text-content/55">{phone}</p>
                )}
              </div>
            </nav>
          </aside>

          <article className="max-w-[68ch] space-y-12 lg:order-1">{children}</article>
        </div>
      </section>
    </div>
  )
}
