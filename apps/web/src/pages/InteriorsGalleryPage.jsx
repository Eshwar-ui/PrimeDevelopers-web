import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProperties, useSection } from '../context/ContentContext'
import { TIERS, tierMeta, parseSlugList } from '../lib/interiors'
import { sized } from '../lib/images'

export default function InteriorsGalleryPage() {
  const { heading, entries = [] } = useSection('interiors_gallery')
  const { options = [] } = useSection('interiors_page')
  const properties = useProperties()
  const [propertySlug, setPropertySlug] = useState('All')
  const [tier, setTier] = useState('All')

  const propertyOf = (slug) => properties.find((p) => p.slug === slug)
  const propertyName = (slug) => propertyOf(slug)?.name ?? slug
  const propertySlugs = ['All', ...new Set(entries.map((e) => e.propertySlug).filter(Boolean))]

  const visible = useMemo(
    () => entries.filter((e) => (propertySlug === 'All' || e.propertySlug === propertySlug) && (tier === 'All' || e.tier === tier)),
    [entries, propertySlug, tier]
  )

  return (
    <div className="overflow-x-hidden bg-base text-content">
      <header data-band="light" className="px-gutter pb-10 pt-32 md:px-gutter-lg md:pb-14 md:pt-40">
        <div className="mx-auto max-w-[1360px]">
          <Link to="/enterprise/interiors" className="font-body text-sm font-semibold text-content/55 transition-colors hover:text-accent">
            ← Back to finishes
          </Link>
          <h1 className="mt-6 max-w-[20ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">
            {heading || 'Finished spaces'}
          </h1>
        </div>
      </header>

      {entries.length === 0 ? (
        <section data-band="light" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-gutter text-center md:px-gutter-lg">
          <p className="font-display text-xl font-semibold">No finished spaces published yet.</p>
          <p className="max-w-md font-body text-content/60">Check back soon to see real units finished with these options.</p>
        </section>
      ) : (
        <section data-band="light" className="bg-surface-alt px-gutter py-10 md:px-gutter-lg md:py-14">
          <div className="mx-auto max-w-[1360px]">
            <div className="flex flex-col gap-4 border-b border-line pb-7 sm:gap-6 sm:pb-8">
              <div className="-mx-gutter flex snap-x gap-2 overflow-x-auto px-gutter pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Filter by property">
                {propertySlugs.map((slug) => {
                  const image = slug !== 'All' ? propertyOf(slug)?.image : null
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setPropertySlug(slug)}
                      aria-pressed={propertySlug === slug}
                      className={`flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border pl-1.5 pr-5 font-body text-[13px] font-bold transition-colors ${
                        slug === 'All' ? 'pl-5' : ''
                      } ${propertySlug === slug ? 'border-accent bg-accent text-white dark:text-void' : 'border-content/20 hover:border-content/50'}`}
                    >
                      {image && (
                        <span className="block size-8 shrink-0 overflow-hidden rounded-full bg-surface-alt">
                          <img src={sized(image, 'thumb')} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                        </span>
                      )}
                      {slug === 'All' ? 'All properties' : propertyName(slug)}
                    </button>
                  )
                })}
              </div>
              <div className="-mx-gutter flex snap-x gap-2 overflow-x-auto px-gutter pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Filter by tier">
                {['All', ...TIERS].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    aria-pressed={tier === t}
                    className={`min-h-11 shrink-0 snap-start rounded-full border px-5 font-body text-[13px] font-bold transition-colors ${
                      tier === t ? 'border-accent bg-accent text-white dark:text-void' : 'border-content/20 hover:border-content/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {visible.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {visible.map((entry) => {
                  const usedOptions = parseSlugList(entry.optionSlugs)
                    .map((s) => options.find((o) => o.slug === s))
                    .filter(Boolean)
                  return (
                    <div key={entry.slug} className="flex flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface">
                      <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
                        {entry.photos?.[0] && (
                          <img src={sized(entry.photos[0], 'card')} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                        )}
                        <span className={`absolute left-4 top-4 inline-flex items-center rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.08em] ${tierMeta(entry.tier).chip}`}>
                          {entry.tier}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-5">
                        <h3 className="font-display text-lg font-bold leading-tight text-content">{propertyName(entry.propertySlug)}</h3>
                        <p className="font-body text-[13px] text-content/60">Unit {entry.unitLabel}</p>
                        {usedOptions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {usedOptions.map((o) => (
                              <Link key={o.slug} to={`/enterprise/interiors/${o.slug}`} className="rounded-full border border-content/20 px-3 py-1 font-body text-[11px] font-semibold transition-colors hover:border-accent hover:text-accent">
                                {o.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-12 text-center font-body text-sm text-content/60">No finished spaces match this filter.</p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
