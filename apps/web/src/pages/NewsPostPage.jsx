import { Link, useParams } from 'react-router-dom'
import { useNewsPost } from '../context/ContentContext'

export default function NewsPostPage() {
  const { slug } = useParams()
  const post = useNewsPost(slug)

  if (!post) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-void px-6 text-center">
        <h1 className="font-display text-3xl font-medium text-bone">Post not found</h1>
        <Link to="/news" className="eyebrow text-accent-soft">
          ← Back to news
        </Link>
      </section>
    )
  }

  const paragraphs = post.body.split(/\n{2,}/).filter(Boolean)

  return (
    <div>
      <section className="relative overflow-hidden bg-void px-6 pb-16 pt-32 text-bone md:px-[75px] md:pb-20 md:pt-44">
        <div className="relative">
          <Link to="/news" className="eyebrow mb-8 inline-block text-bone/50 hover:text-bone">
            ← All posts
          </Link>
          {post.publishedAt && (
            <span className="eyebrow mb-5 block text-accent-soft">
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
          <h1 className="font-display text-h2 font-light leading-[1.05] tracking-[-0.02em]">{post.title}</h1>
        </div>

        {post.coverImage && (
          <div className="relative mt-14 h-[300px] overflow-hidden rounded-3xl border border-[var(--color-line-inv)] md:h-[460px]">
            <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover" />
          </div>
        )}
      </section>

      <section className="bg-void px-6 pb-24 text-bone md:px-[75px]">
        <div className="mx-auto flex max-w-[70ch] flex-col gap-6 font-body text-base leading-relaxed text-bone/70">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>
    </div>
  )
}
