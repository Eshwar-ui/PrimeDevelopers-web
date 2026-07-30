import { Link } from 'react-router-dom'
import { useSection, useNews } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

export default function NewsPage() {
  const p = useSection('news_page')
  const posts = useNews()

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="news-hero"
        className="relative overflow-hidden bg-void px-6 pb-16 pt-36 text-bone md:px-[75px] md:pb-20 md:pt-48"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 55% at 100% 0%, rgba(0,115,164,0.16) 0%, rgba(0,115,164,0) 100%)',
          }}
        />
        <div className="relative">
          <span className="eyebrow mb-6 flex items-center gap-4 text-bone/70">
            <span className="h-px w-10 bg-accent-soft" />
            {p.heroEyebrow}
          </span>
          <h1 className="font-display text-display font-light leading-[0.98] tracking-[-0.02em]">
            {renderEmphasis(p.heroHeading)}
          </h1>
          {p.heroParagraph && (
            <p className="mt-8 max-w-[52ch] font-body text-lg leading-relaxed text-bone/65">{p.heroParagraph}</p>
          )}
        </div>
      </section>

      {/* ── Post grid ────────────────────────────────────────── */}
      <section className="bg-carbon px-6 py-16 md:px-[75px] md:py-24">
        {posts.length === 0 ? (
          <p className="text-bone/45">No posts yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                to={`/news/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-ink transition-colors duration-300 hover:border-bone/25"
              >
                <div className="relative h-56 overflow-hidden bg-void">
                  {post.coverImage && (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6 text-bone">
                  {post.publishedAt && (
                    <span className="eyebrow text-bone/40">
                      {new Date(post.publishedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  <h3 className="mt-2 font-display text-xl font-medium tracking-[-0.01em] md:text-2xl">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-3 font-body text-sm leading-relaxed text-bone/50">{post.excerpt}</p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-bone transition-colors group-hover:text-accent-soft">
                    Read more
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
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
