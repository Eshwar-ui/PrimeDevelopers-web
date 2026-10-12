import { Link } from 'react-router-dom'
import { sized, srcSetFor } from '../lib/images'
import { formatDate } from '../lib/posts'
import watermark from '../assets/watermark-p.svg'

const Arrow = () => <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>

/**
 * The house content card, same as the homepage's and the properties grid's:
 * `rounded-panel`, the accent hairline at rest rather than on hover, and the
 * same lift on approach at the same speed. The hairline is not decoration — a
 * `bg-surface` card on a `bg-base` ground is white on white in light mode, so a
 * grey line is the difference between a card and no card at all.
 *
 * `post` is a postView() — it carries the category and reading time.
 */
export default function NewsCard({ post }) {
  return (
    <Link
      to={`/news/${post.slug}`}
      className="group flex min-h-full flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]"
    >
      <div className="relative h-56 overflow-hidden bg-surface-alt md:h-64">
        {/* A post with no cover still gets a picture slot, so a row of cards
            keeps one baseline — the brand mark rather than an empty box that
            reads as an image that failed to load. */}
        {!post.coverImage && (
          <img src={watermark} alt="" aria-hidden className="absolute -bottom-10 -right-6 w-48 opacity-[0.2] transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        )}
        {post.coverImage && (
          <img
            src={sized(post.coverImage, 'card')}
            srcSet={srcSetFor(post.coverImage, 'card')}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-6 md:p-7">
        <span className="font-body text-[11px] font-bold uppercase tracking-[0.12em] text-accent">{post.category}</span>
        <h3 className="mt-3 text-balance font-display text-[1.35rem] font-bold leading-[1.15] tracking-[-0.018em] text-content">{post.title}</h3>
        {post.excerpt && <p className="mt-3 line-clamp-3 font-body text-[14px] leading-[1.65] text-content/62">{post.excerpt}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2 font-body text-[11px] text-content/48">
          {formatDate(post.publishedAt) && (
            <>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              <span aria-hidden>•</span>
            </>
          )}
          <span>{post.readingTime}</span>
        </div>
        <span className="mt-auto inline-flex items-center gap-2 pt-6 font-body text-[12px] font-bold text-accent">
          Read article <Arrow />
        </span>
      </div>
    </Link>
  )
}
