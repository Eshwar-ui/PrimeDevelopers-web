import { Link } from 'react-router-dom'
import { useSection, useNews } from '../context/ContentContext'

// The design lays out three cards on one row; a fourth would wrap and leave a
// ragged shelf, so the homepage teaser stops there and /news carries the rest.
const TEASER_COUNT = 3

export default function NewsTeaser() {
  const { heading, paragraph } = useSection('news_home')
  const posts = useNews().slice(0, TEASER_COUNT)

  if (posts.length === 0) return null

  return (
    <section
      id="news"
      data-band="light"
      className="bg-surface px-6 py-16 text-content md:px-[75px] md:py-16"
    >
      <div className="mb-10">
        <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.01em] text-content">
          {heading}
        </h2>
        {paragraph && (
          <p className="mt-4 max-w-[52ch] font-body text-[16px] leading-normal text-content/60">
            {paragraph}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/news/${post.slug}`}
            className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition-colors duration-300 hover:border-content/25"
          >
            {/* The block is unconditional. Cards sit in a grid row that stretches
                to the tallest of them, so skipping the image on a post that
                lacks one didn't shorten that card — it just left a hole where
                the picture should be. A placeholder keeps every card the same
                shape whether or not anyone uploaded artwork. */}
            <div className="overflow-hidden rounded-xl">
              {post.coverImage ? (
                <img
                  src={post.coverImage}
                  alt=""
                  className="h-50 w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-50 w-full items-center justify-center bg-prime-soft"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-9 text-accent/40"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L3 21" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col pt-5">
              {post.publishedAt && (
                <time
                  dateTime={post.publishedAt}
                  className="font-body text-[14px] text-content/45"
                >
                  {new Date(post.publishedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              )}

              <h3 className="mt-2.5 font-display text-[20px] font-bold leading-tight tracking-[-0.01em] text-content">
                {post.title}
              </h3>

              {post.excerpt && (
                <p className="mt-3 flex-1 font-body text-[14px] leading-[1.7] text-content/60">
                  {post.excerpt}
                </p>
              )}

              <span className="mt-6 inline-flex items-center gap-2 font-body text-[15px] font-medium text-accent">
                Read More
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
