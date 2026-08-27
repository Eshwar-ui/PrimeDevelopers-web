import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import ArrowRight from '../components/ArrowRight'
import { youtubeEmbedUrl } from '../lib/academy'

export default function LearnPage() {
  const { heading, paragraph, terms = [] } = useSection('academy')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [previewTerm, setPreviewTerm] = useState(null)
  const previewX = useMotionValue(-500)
  const previewY = useMotionValue(-500)
  const reducedMotion = useReducedMotion()
  const categories = ['All', ...new Set(terms.map((term) => term.category).filter(Boolean))]
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return terms.filter((term) => {
      const inCategory = category === 'All' || term.category === category
      const inSearch = !needle || `${term.term} ${term.shortDefinition} ${term.category}`.toLowerCase().includes(needle)
      return inCategory && inSearch
    })
  }, [terms, query, category])

  const positionPreview = (event) => {
    if (event.pointerType !== 'mouse') return
    const width = 360
    const height = 203
    const gap = 24
    const edge = 16
    const x = event.clientX + gap + width > window.innerWidth - edge
      ? event.clientX - gap - width
      : event.clientX + gap
    const y = Math.min(Math.max(event.clientY - height / 2, edge), window.innerHeight - height - edge)
    previewX.set(x)
    previewY.set(y)
  }

  const showPreview = (event, term) => {
    if (event.pointerType !== 'mouse') return
    positionPreview(event)
    setPreviewTerm(term)
  }

  return (
    <div className="bg-base text-content">
      <section data-band="light" className="px-gutter pb-16 pt-36 md:px-gutter-lg md:pb-24 md:pt-44">
        <div className="mx-auto grid max-w-[1360px] gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <h1 className="max-w-[18ch] text-balance font-display font-bold uppercase leading-[1.03] tracking-tight [font-size:clamp(1.85rem,min(4.2vw,8dvh),3.4rem)]">{heading}</h1>
          <p className="max-w-[48ch] font-body text-[17px] leading-[1.7] text-content/65">{paragraph}</p>
        </div>
      </section>

      <section data-band="light" className="bg-surface-alt px-gutter py-16 md:px-gutter-lg md:py-20">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid gap-5 border-b border-line pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="block">
              <span className="sr-only">Search real-estate terms</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a term or question" className="h-14 w-full border-b border-content/25 bg-transparent font-body text-[18px] text-content outline-none transition-colors placeholder:text-content/40 focus:border-accent lg:max-w-xl" />
            </label>
            <div className="flex flex-wrap gap-2" aria-label="Filter terms by category">
              {categories.map((item) => (
                <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-11 rounded-full border px-5 font-body text-[13px] font-semibold transition-colors ${category === item ? 'border-accent bg-accent text-white dark:text-void' : 'border-content/20 hover:border-content/50'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {visible.length ? (
            <ol>
              {visible.map((term, index) => (
                <li key={term.slug}>
                  <Link to={`/learn/${term.slug}`} onPointerEnter={(event) => showPreview(event, term)} onPointerMove={positionPreview} onPointerLeave={() => setPreviewTerm(null)} className="group grid gap-4 border-b border-line py-8 transition-colors duration-300 hover:text-accent md:grid-cols-[5rem_minmax(13rem,0.7fr)_1.3fr_8rem_auto] md:items-center md:gap-8">
                    <span className="numeral text-sm text-content/35">{String(index + 1).padStart(2, '0')}</span>
                    <strong className="font-display text-[clamp(1.35rem,2vw,2rem)] font-semibold leading-tight">{term.term}</strong>
                    <span className="font-body text-[15px] leading-relaxed text-content/60">{term.shortDefinition}</span>
                    <span className="font-body text-[12px] font-bold uppercase tracking-[0.12em] text-content/45">{term.category}</span>
                    <ArrowRight className="size-5 transition-transform duration-300 ease-brand group-hover:translate-x-1.5" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="py-24 text-center">
              <p className="font-display text-2xl font-semibold">No matching terms yet.</p>
              <button type="button" onClick={() => { setQuery(''); setCategory('All') }} className="mt-4 font-body text-sm font-semibold text-accent underline underline-offset-4">Clear search</button>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {previewTerm && (
          <motion.aside
            key={previewTerm.slug}
            style={{ x: previewX, y: previewY }}
            aria-hidden="true"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed left-0 top-0 z-[70] hidden aspect-video w-[360px] origin-left overflow-hidden rounded-2xl bg-carbon shadow-[0_24px_60px_-18px_rgba(0,0,0,0.65)] lg:block"
          >
            {youtubeEmbedUrl(previewTerm.videoUrl) ? (
              <iframe
                key={previewTerm.videoUrl}
                src={`${youtubeEmbedUrl(previewTerm.videoUrl)}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0`}
                title=""
                tabIndex="-1"
                className="size-full"
                allow="autoplay; encrypted-media; picture-in-picture"
              />
            ) : (
              <div className="flex size-full items-end bg-void p-5 text-bone">
                <span className="absolute left-5 top-5 grid size-11 place-items-center rounded-full bg-bone text-charcoal">
                  <svg viewBox="0 0 24 24" aria-hidden className="ml-0.5 size-5 fill-current"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <div>
                  <p className="font-display text-lg font-semibold">{previewTerm.term}</p>
                  <p className="mt-1 font-body text-xs text-bone/55">Video coming soon</p>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
