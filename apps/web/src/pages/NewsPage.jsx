import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useSection, useNews } from '../context/ContentContext'
import MaskedHeading from '../components/MaskedHeading'
import { sized } from '../lib/images'
import { rise, stagger } from '../lib/motion'

// data-band="light" on every section — see the note in NewsPostPage.

export default function NewsPage() {
  const p = useSection('news_page')
  const posts = useNews()

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      {/* Centred, masked heading, same type ramp as the properties hero: these
          are the two interior index pages, and they should read as a pair. */}
      <section
        id="news-hero"
        data-band="light"
        className="bg-surface px-6 pb-14 pt-32 text-center md:px-12 md:pb-16 md:pt-40"
      >
        <motion.div variants={stagger} initial="hidden" animate="show">
          {p.heroEyebrow && (
            <motion.span
              variants={rise}
              className="block font-body text-[14px] uppercase tracking-[0.14em] text-accent"
            >
              {p.heroEyebrow}
            </motion.span>
          )}

          {/* Plain, not a motion child: the words carry their own masked rise,
              and a block-level lift would move each mask along with the word
              inside it, leaving nothing for the word to rise out of. */}
          <h1 className="mx-auto mt-5 max-w-[18ch] font-display font-bold uppercase leading-[1.03] tracking-tight text-content [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            <MaskedHeading text={p.heroHeading} accentClass="italic text-accent" />
          </h1>

          {p.heroParagraph && (
            <motion.p
              variants={rise}
              className="mx-auto mt-7 max-w-[40rem] font-body text-[15px] leading-relaxed text-content/70"
            >
              {p.heroParagraph}
            </motion.p>
          )}
        </motion.div>
      </section>

      {/* ── Post grid ────────────────────────────────────────── */}
      {/* surface-alt: the grid is a recessed tray under the hero, which is the
          only thing separating two white bands that would otherwise run
          together into one undifferentiated page. */}
      <section data-band="light" className="bg-surface-alt px-6 py-20 md:px-12 md:py-28">
        {posts.length === 0 ? (
          <p className="font-body text-[16px] text-content/70">No posts yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                to={`/news/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface transition-shadow duration-300 hover:shadow-[0_22px_48px_-30px_rgba(0,0,0,0.45)]"
              >
                <div className="relative h-56 overflow-hidden bg-surface-alt">
                  {post.coverImage && (
                    <img
                      src={sized(post.coverImage, 'card')}
                      alt={post.title}
                      loading="lazy"
                      decoding="async"
                      // No grayscale-to-colour on hover. The redesign shows
                      // photography at full colour throughout and moves the
                      // hover onto scale alone; leaving it here would make the
                      // news cards the one place the site desaturates its work.
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  {post.publishedAt && (
                    <span className="font-body text-[13px] uppercase tracking-[0.14em] text-content/70">
                      {new Date(post.publishedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  <h3 className="mt-2 font-display text-[1.55rem] font-bold leading-tight tracking-[-0.01em] text-content">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-3 font-body text-[15px] leading-[1.7] text-content/70">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-accent transition-colors group-hover:text-prime-deep">
                    Read more
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
