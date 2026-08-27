import { Link, Navigate, useParams } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import ArrowRight from '../components/ArrowRight'
import { relatedSlugs, youtubeEmbedUrl } from '../lib/academy'

export default function LearnTermPage() {
  const { slug } = useParams()
  const { terms = [] } = useSection('academy')
  const term = terms.find((item) => item.slug === slug)

  if (!term) return <Navigate to="/learn" replace />

  const embedUrl = youtubeEmbedUrl(term.videoUrl)
  const related = relatedSlugs(term.related)
    .map((relatedSlug) => terms.find((item) => item.slug === relatedSlug))
    .filter(Boolean)

  return (
    <div className="bg-base text-content">
      <header data-band="light" className="px-gutter pb-14 pt-32 md:px-gutter-lg md:pb-20 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <Link to="/learn" className="group inline-flex min-h-11 items-center gap-2 font-body text-sm font-semibold text-content/55 transition-colors hover:text-accent">
            <ArrowRight className="size-4 rotate-180 transition-transform duration-300 group-hover:-translate-x-1" />
            All terms
          </Link>
          <p className="mt-9 font-body text-xs font-bold uppercase tracking-[0.14em] text-accent">{term.category}</p>
          <h1 className="mt-4 max-w-[18ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">{term.term}</h1>
          <p className="mt-7 max-w-[52ch] font-body text-[clamp(1.1rem,2vw,1.4rem)] leading-relaxed text-content/65">{term.shortDefinition}</p>
        </div>
      </header>

      <section data-band="dark" className="bg-void px-gutter py-10 text-bone md:px-gutter-lg md:py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="aspect-video overflow-hidden rounded-[22px] border border-white/10 bg-carbon shadow-[0_35px_90px_-50px_rgba(0,0,0,0.9)]">
            {embedUrl ? (
              <iframe className="size-full" src={embedUrl} title={`${term.term} explained`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            ) : (
              <div className="flex size-full flex-col items-center justify-center px-8 text-center">
                <span className="grid size-16 place-items-center rounded-full border border-white/20 bg-white/5">
                  <svg viewBox="0 0 24 24" aria-hidden className="ml-1 size-6 fill-current"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <h2 className="mt-6 font-display text-2xl font-semibold">Video coming soon</h2>
                <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-bone/55">The written guide is ready below. Add a YouTube link in the CMS to publish the video here.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section data-band="light" className="px-gutter py-20 md:px-gutter-lg md:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-24">
          <article className="space-y-14">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-accent">01 · The definition</p>
              <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold tracking-[-0.035em]">What it means</h2>
              <p className="mt-6 max-w-[62ch] whitespace-pre-line font-body text-[17px] leading-[1.85] text-content/70">{term.explanation}</p>
            </div>
            {term.example && (
              <div className="border-l-2 border-accent pl-7 md:pl-10">
                <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">Practical example</p>
                <p className="mt-4 max-w-[58ch] font-display text-[clamp(1.35rem,2.5vw,2rem)] leading-relaxed">{term.example}</p>
              </div>
            )}
          </article>

          <aside>
            <div className="rounded-[20px] bg-surface-alt p-7 lg:sticky lg:top-28">
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-accent">Why it matters</p>
              <p className="mt-4 font-body text-[15px] leading-[1.75] text-content/65">{term.whyItMatters}</p>
              <Link to="/properties" className="primary-button-flood group relative mt-7 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-accent px-6 font-body text-sm font-semibold text-white dark:text-void">
                <span className="relative z-10">Browse properties</span>
                <ArrowRight className="relative z-10 size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="mx-auto mt-20 max-w-[1200px] border-t border-line pt-10">
            <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">Continue learning</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {related.map((item) => <Link key={item.slug} to={`/learn/${item.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-content/20 px-5 font-body text-sm font-semibold transition-colors hover:border-accent hover:text-accent">{item.term}</Link>)}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
