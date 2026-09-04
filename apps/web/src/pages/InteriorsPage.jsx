import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import ArrowRight from '../components/ArrowRight'
import CustomSelect from '../components/CustomSelect'
import { TIERS, tierMeta } from '../lib/interiors'
import { sized } from '../lib/images'

gsap.registerPlugin(ScrollTrigger)

const SORTS = [
  { id: 'default', label: 'Featured' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
]

const parsePrice = (value) => {
  const n = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export default function InteriorsPage() {
  const { heading, paragraph, options = [] } = useSection('interiors_page')
  const [tier, setTier] = useState('All')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('default')
  const scope = useRef(null)

  const categories = ['All', ...new Set(options.map((o) => o.category).filter(Boolean))]

  const visible = useMemo(() => {
    let list = options.filter((o) => (tier === 'All' || o.tier === tier) && (category === 'All' || o.category === category))
    if (sort === 'price-asc') list = [...list].sort((a, b) => parsePrice(a.pricePerSqft) - parsePrice(b.pricePerSqft))
    if (sort === 'price-desc') list = [...list].sort((a, b) => parsePrice(b.pricePerSqft) - parsePrice(a.pricePerSqft))
    return list
  }, [options, tier, category, sort])

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-catalog-card]', {
        y: 28,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.06,
        clearProps: 'transform,opacity',
      })
    },
    { scope, dependencies: [visible.map((o) => o.slug).join(',')] }
  )

  if (options.length === 0) {
    return (
      <div className="bg-base text-content">
        <section data-band="light" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-gutter text-center md:px-gutter-lg">
          <h1 className="font-display text-3xl font-bold text-content">The catalog is being put together</h1>
          <p className="max-w-md font-body text-content/60">Check back soon, or talk to us directly about interior finishes.</p>
          <Link to="/contact?source=interiors" className="font-body text-sm font-semibold text-accent underline underline-offset-4">Talk to us</Link>
        </section>
      </div>
    )
  }

  return (
    <div ref={scope} className="overflow-x-hidden bg-base text-content">
      <section data-band="light" className="px-gutter pb-10 pt-36 md:px-gutter-lg md:pb-14 md:pt-44">
        <div className="mx-auto grid max-w-[1360px] gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <h1 className="max-w-[20ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">{heading}</h1>
          <p className="max-w-[48ch] font-body text-[16px] leading-[1.7] text-content/65 sm:text-[17px]">{paragraph}</p>
        </div>
        <Link
          to="/enterprise/interiors/gallery"
          className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-content/20 px-5 font-body text-[13px] font-bold uppercase tracking-[0.08em] transition-colors hover:border-accent hover:text-accent"
        >
          View finished gallery
          <ArrowRight className="size-4" />
        </Link>
      </section>

      <section data-band="light" className="bg-surface-alt px-gutter py-10 md:px-gutter-lg md:py-14">
        <div className="mx-auto max-w-[1360px]">
          <div className="flex flex-col gap-4 border-b border-line pb-7 sm:pb-8 lg:flex-row lg:items-center lg:justify-between">
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
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[25.75rem] lg:shrink-0 lg:grid-cols-[12rem_13rem] lg:items-center">
              {categories.length > 2 && (
                <CustomSelect
                  label="Filter by category"
                  value={category}
                  onChange={setCategory}
                  options={categories.map((item) => ({
                    value: item,
                    label: item === 'All' ? 'All categories' : item,
                  }))}
                />
              )}
              <CustomSelect
                label="Sort finish options"
                value={sort}
                onChange={setSort}
                options={SORTS.map((item) => ({ value: item.id, label: item.label }))}
              />
            </div>
          </div>

          {visible.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {visible.map((option) => (
                <Link
                  key={option.slug}
                  data-catalog-card
                  to={`/enterprise/interiors/${option.slug}`}
                  className="group flex flex-col overflow-hidden rounded-panel border border-accent/45 bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-accent/75 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
                    {option.thumbnail && (
                      <img
                        src={sized(option.thumbnail, 'card')}
                        alt={option.name}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
                      />
                    )}
                    <span className={`absolute left-4 top-4 inline-flex items-center rounded-full px-3 py-1 font-body text-[11px] font-bold uppercase tracking-[0.08em] ${tierMeta(option.tier).chip}`}>
                      {option.tier}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-5">
                    <h3 className="font-display text-lg font-bold leading-tight text-content">{option.name}</h3>
                    {option.pricePerSqft && (
                      <p className="font-body text-[13px] text-content/70">
                        <span className="font-bold text-content">${option.pricePerSqft}</span> / sq ft
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="font-display text-xl font-semibold">No options match this filter.</p>
              <button
                type="button"
                onClick={() => { setTier('All'); setCategory('All') }}
                className="mt-4 font-body text-sm font-semibold text-accent underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
