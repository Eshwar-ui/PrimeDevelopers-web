import { Link, useParams } from 'react-router-dom'
import { useNewsPost } from '../context/ContentContext'

// Every section carries data-band="light". The navbar decides its own colour by
// observing a thin strip under itself for elements tagged that way, so a light
// section that omits it gets white chrome on a white ground — the links are
// still there, just invisible.

export default function NewsPostPage() {
  const { slug } = useParams()
  const post = useNewsPost(slug)

  if (!post) {
    return (
      <section
        data-band="light"
        className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-surface px-6 text-center"
      >
        <h1 className="font-display text-3xl font-bold tracking-[-0.01em] text-content">
          Post not found
        </h1>
        <Link
          to="/news"
          className="font-body text-[14px] uppercase tracking-[0.14em] text-accent transition-colors duration-300 hover:text-prime-deep"
        >
          ← Back to news
        </Link>
      </section>
    )
  }

  const paragraphs = post.body.split(/\n{2,}/).filter(Boolean)

  return (
    <div>
      <section
        data-band="light"
        className="relative overflow-hidden bg-surface px-6 pb-16 pt-32 md:px-12 md:pb-20 md:pt-44"
      >
        <div className="relative mx-auto max-w-[76rem]">
          <Link
            to="/news"
            className="mb-8 inline-block font-body text-[14px] uppercase tracking-[0.14em] text-content/70 transition-colors duration-300 hover:text-accent"
          >
            ← All posts
          </Link>
          {post.publishedAt && (
            <span className="mb-5 block font-body text-[14px] uppercase tracking-[0.14em] text-accent">
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
          {/* Bold, not light: the display face carries the page at this size on
              a light ground, where a hairline weight goes thin and grey. */}
          <h1 className="max-w-[24ch] font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-content md:text-[3rem]">
            {post.title}
          </h1>

          {post.coverImage && (
            <div className="relative mt-14 h-[300px] overflow-hidden rounded-2xl border border-[var(--color-line)] md:h-[460px]">
              <img
                src={post.coverImage}
                alt={post.title}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </section>

      <section data-band="light" className="bg-surface px-6 pb-24 md:px-12">
        {/* The same 76rem wrapper the header uses, with the measure applied
            inside it. Centring the column on its own instead leaves the body
            starting well to the right of the headline it belongs to. */}
        <div className="mx-auto max-w-[76rem]">
          <div className="flex max-w-[70ch] flex-col gap-6 font-body text-[16px] leading-[1.7] text-content/70">
            {paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
