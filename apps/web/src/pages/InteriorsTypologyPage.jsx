import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import ArrowRight from '../components/ArrowRight'
import BeforeAfterSlider from '../components/BeforeAfterSlider'
import { youtubeEmbedUrl } from '../lib/academy'
import { tierMeta, parseSlugList } from '../lib/interiors'
import { sized } from '../lib/images'

export default function InteriorsTypologyPage() {
  const { slug } = useParams()
  const { options = [] } = useSection('interiors_page')
  const { entries: galleryEntries = [] } = useSection('interiors_gallery')
  const [searchParams] = useSearchParams()
  const [activeImage, setActiveImage] = useState(0)

  const option = options.find((item) => item.slug === slug)

  if (!option) return <Navigate to="/enterprise/interiors" replace />

  const images = [option.heroImage, ...(option.images ?? [])].filter(Boolean)
  const embedUrl = youtubeEmbedUrl(option.videoUrl)
  const related = galleryEntries.filter((entry) => parseSlugList(entry.optionSlugs).includes(option.slug))

  // Carries a property/unit context through if this page was reached from
  // one (e.g. a future "view finishes for this unit" link) — same
  // comma-list/query-param convention FloorPlanSection's enquire button uses.
  const property = searchParams.get('property')
  const unit = searchParams.get('unit')
  const quoteParams = new URLSearchParams({ source: 'interiors', options: option.slug })
  if (property) quoteParams.set('property', property)
  if (unit) quoteParams.set('unit', unit)

  return (
    <div className="overflow-x-hidden bg-base text-content">
      <header data-band="light" className="px-gutter pb-10 pt-32 md:px-gutter-lg md:pb-14 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <Link to="/enterprise/interiors" className="group inline-flex min-h-11 items-center gap-2 font-body text-sm font-semibold text-content/55 transition-colors hover:text-accent">
            <ArrowRight className="size-4 rotate-180 transition-transform duration-300 group-hover:-translate-x-1" />
            All finishes
          </Link>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.08em] ${tierMeta(option.tier).chip}`}>
              {option.tier}
            </span>
            {option.category && <span className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/45">{option.category}</span>}
          </div>
          <h1 className="mt-4 max-w-[20ch] text-balance font-display font-bold leading-[1.05] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.2rem)]">{option.name}</h1>
          {option.pricePerSqft && (
            <p className="mt-4 font-display text-2xl font-bold text-accent">
              ${option.pricePerSqft} <span className="font-body text-sm font-normal text-content/50">/ sq ft</span>
            </p>
          )}
        </div>
      </header>

      {images.length > 0 && (
        <section className="px-gutter pb-10 md:px-gutter-lg md:pb-14">
          <div className="mx-auto max-w-[1200px]">
            {option.beforeImage && option.heroImage && activeImage === 0 ? (
              <BeforeAfterSlider
                before={sized(option.beforeImage, 'full')}
                after={sized(option.heroImage, 'full')}
                alt={option.name}
              />
            ) : (
              <img
                src={sized(images[activeImage], 'full')}
                alt={option.name}
                className="h-[clamp(14rem,72vw,18.75rem)] w-full rounded-xl object-cover sm:rounded-2xl md:h-[460px]"
              />
            )}
            {images.length > 1 && (
              <div className="-mx-gutter mt-4 flex snap-x gap-3 overflow-x-auto px-gutter pb-2 sm:mx-0 sm:px-0">
                {images.slice(0, 6).map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-20 shrink-0 snap-start overflow-hidden rounded-lg border transition-colors ${
                      i === activeImage ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={sized(src, 'thumb')} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section data-band="dark" className="bg-void px-gutter py-10 text-bone md:px-gutter-lg md:py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="aspect-[4/3] overflow-hidden rounded-[18px] border border-white/10 bg-carbon shadow-[0_35px_90px_-50px_rgba(0,0,0,0.9)] sm:aspect-video sm:rounded-[22px]">
            {embedUrl ? (
              <iframe className="size-full" src={embedUrl} title={`${option.name} walkthrough`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            ) : (
              <div className="flex size-full flex-col items-center justify-center px-5 text-center sm:px-8">
                <span className="grid size-12 place-items-center rounded-full border border-white/20 bg-white/5 sm:size-16">
                  <svg viewBox="0 0 24 24" aria-hidden className="ml-1 size-5 fill-current sm:size-6"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <h2 className="mt-4 font-display text-xl font-semibold sm:mt-6 sm:text-2xl">Video coming soon</h2>
                <p className="mt-2 max-w-md font-body text-xs leading-relaxed text-bone/55 sm:text-sm">The written specification is ready below. Add a YouTube link in the CMS to publish a walkthrough here.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section data-band="light" className="px-gutter py-14 sm:py-20 md:px-gutter-lg md:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-10 sm:gap-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-24">
          <article className="space-y-14">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-accent">The specification</p>
              <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold tracking-[-0.035em]">What it is</h2>
              <p className="mt-6 max-w-[62ch] whitespace-pre-line font-body text-[17px] leading-[1.85] text-content/70">{option.description}</p>
            </div>
          </article>

          <aside>
            <div className="rounded-[20px] bg-surface-alt p-7 lg:sticky lg:top-28">
              {option.specs?.length > 0 && (
                <dl className="flex flex-col gap-4">
                  {option.specs.map((spec) => (
                    <div key={spec.label} className="flex flex-col gap-1">
                      <dt className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-content/50">{spec.label}</dt>
                      <dd className="font-display text-[15px] font-semibold text-content">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Link
                to={`/contact?${quoteParams.toString()}`}
                className="primary-button-flood group relative mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-accent px-4 py-3 text-center font-body text-sm font-semibold text-white dark:text-void sm:px-6"
              >
                <span className="relative z-10">Add this to my unit quote</span>
                <ArrowRight className="relative z-10 size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="mx-auto mt-20 max-w-[1200px] border-t border-line pt-10">
            <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-content/40">Finished with this option</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {related.map((entry) => (
                <Link key={entry.slug} to="/enterprise/interiors/gallery" className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-content/20 px-4 text-center font-body text-sm font-semibold transition-colors hover:border-accent hover:text-accent sm:w-auto sm:px-5">
                  {entry.propertySlug} — Unit {entry.unitLabel}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
