import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useSection, useNews } from '../context/ContentContext'
import MaskedHeading from '../components/MaskedHeading'
import { sized } from '../lib/images'
import { rise, stagger } from '../lib/motion'

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null
const readingTime = (post) => {
  const words = `${post.excerpt ?? ''} ${post.body ?? ''}`.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 220))} min read`
}
const Arrow = () => <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>

export default function NewsPage() {
  const p = useSection('news_page')
  const posts = useNews()
  const [featured, ...articles] = posts

  return (
    <div>
      <section id="news-hero" data-band="light" className="bg-base px-6 pb-14 pt-32 text-center md:px-12 md:pb-16 md:pt-40">
        <motion.div variants={stagger} initial="hidden" animate="show">
          {p.heroEyebrow && <motion.span variants={rise} className="block font-body text-[14px] uppercase tracking-[0.14em] text-accent">{p.heroEyebrow}</motion.span>}
          <h1 className="mx-auto mt-5 max-w-[18ch] font-display font-bold uppercase leading-[1.03] tracking-tight text-content [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            <MaskedHeading text={p.heroHeading} accentClass="italic text-accent" />
          </h1>
          {p.heroParagraph && <motion.p variants={rise} className="mx-auto mt-7 max-w-[40rem] font-body text-[15px] leading-relaxed text-content/70">{p.heroParagraph}</motion.p>}
        </motion.div>
      </section>

      <section data-band="light" className="bg-base px-6 pb-24 pt-8 md:px-12 md:pb-36 md:pt-12">
        <div className="mx-auto max-w-[1560px]">
          {!featured ? (
            <div className="mt-14 border-y border-line py-20 text-center">
              <h2 className="font-display text-2xl font-bold text-content">No articles found</h2>
              <p className="mt-3 font-body text-[15px] text-content/60">Try a different title, topic, or keyword.</p>
            </div>
          ) : (
            <>
              <Link to={`/news/${featured.slug}`} className="group grid min-h-[28rem] overflow-hidden rounded-[1.75rem] bg-void text-white lg:grid-cols-[0.88fr_1.12fr]">
                <div className="flex flex-col justify-center px-7 py-12 md:px-12 lg:px-14">
                  <span className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-accent-soft">Market insights</span>
                  <h2 className="mt-5 max-w-[18ch] text-balance font-display text-[clamp(2rem,3.5vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.035em]">{featured.title}</h2>
                  {featured.excerpt && <p className="mt-6 max-w-[58ch] font-body text-[15px] leading-[1.7] text-white/66">{featured.excerpt}</p>}
                  <div className="mt-6 flex flex-wrap items-center gap-3 font-body text-[12px] text-white/52">
                    {formatDate(featured.publishedAt) && <time dateTime={featured.publishedAt}>{formatDate(featured.publishedAt)}</time>}
                    <span aria-hidden>•</span><span>{readingTime(featured)}</span>
                  </div>
                  <span className="mt-8 inline-flex items-center gap-3 font-body text-[13px] font-bold text-accent-soft">Read full article <Arrow /></span>
                </div>
                <div className="relative min-h-[20rem] overflow-hidden bg-carbon lg:min-h-full">
                  {featured.coverImage && <img src={sized(featured.coverImage, 'full')} alt={featured.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]" />}
                </div>
              </Link>

              {articles.length > 0 && (
                <div className="mt-8 grid grid-cols-1 gap-5 md:mt-10 md:grid-cols-2 lg:grid-cols-3">
                  {articles.map((post) => (
                    // The house content card, same as the homepage's and the
                    // properties grid's: `rounded-panel`, the accent hairline at
                    // rest rather than on hover, and the same lift on approach at
                    // the same speed. The hairline is not decoration — a
                    // `bg-surface` card on a `bg-base` ground is white on white in
                    // light mode, so a grey line is the difference between a card
                    // and no card at all.
                    <Link key={post.slug} to={`/news/${post.slug}`} className="group flex min-h-full flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]">
                      <div className="h-56 overflow-hidden bg-surface-alt md:h-64">
                        {post.coverImage && <img src={sized(post.coverImage, 'card')} alt={post.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />}
                      </div>
                      <div className="flex flex-1 flex-col p-6 md:p-7">
                        <span className="font-body text-[11px] font-bold uppercase tracking-[0.12em] text-accent">Market insights</span>
                        <h3 className="mt-3 text-balance font-display text-[1.35rem] font-bold leading-[1.15] tracking-[-0.018em] text-content">{post.title}</h3>
                        {post.excerpt && <p className="mt-3 line-clamp-3 font-body text-[14px] leading-[1.65] text-content/62">{post.excerpt}</p>}
                        <div className="mt-5 flex flex-wrap items-center gap-2 font-body text-[11px] text-content/48">
                          {formatDate(post.publishedAt) && <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>}
                          <span aria-hidden>•</span><span>{readingTime(post)}</span>
                        </div>
                        <span className="mt-auto inline-flex items-center gap-2 pt-6 font-body text-[12px] font-bold text-accent">Read article <Arrow /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}