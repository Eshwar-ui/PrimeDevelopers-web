import { Link, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { parsePhase } from '../lib/phases'
import { sized } from '../lib/images'
import ArrowRight from './ArrowRight'

const cityFrom = (address = '') => {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  return (parts.length >= 3 ? parts.at(-2) : parts[0] ?? '').toLowerCase()
}

function similarityScore(candidate, current) {
  let score = 0
  const candidatePhase = parsePhase(candidate.name)
  const currentPhase = parsePhase(current.name)

  if (candidatePhase?.base && candidatePhase.base === currentPhase?.base) score += 100
  if (candidate.category && candidate.category === current.category) score += 30
  if (cityFrom(candidate.address) && cityFrom(candidate.address) === cityFrom(current.address)) score += 10
  if (Boolean(candidate.available) === Boolean(current.available)) score += 2
  return score
}

function gridSpan(index, count) {
  if (count === 1) return 'lg:col-span-12'
  if (count === 2) return index === 0 ? 'lg:col-span-7' : 'lg:col-span-5'
  return index === 0 ? 'lg:col-span-6' : 'lg:col-span-3'
}

export default function FooterSimilarProperties({ properties }) {
  const { pathname } = useLocation()
  const reducedMotion = useReducedMotion()
  const match = pathname.match(/^\/properties\/([^/]+)\/?$/)
  const current = match ? properties.find((property) => property.slug === match[1]) : null
  if (!current) return null

  const similar = properties
    .map((property, index) => ({ property, index }))
    .filter(({ property }) => property.slug !== current.slug)
    .sort((a, b) => similarityScore(b.property, current) - similarityScore(a.property, current) || a.index - b.index)
    .slice(0, 3)
    .map(({ property }) => property)

  if (similar.length === 0) return null
  return (
    <motion.section
      aria-labelledby='similar-properties-heading'
      initial={reducedMotion ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className='mb-16 border-b border-[var(--color-line-inv)] pb-16 md:mb-20 md:pb-20'
    >
      <div className='flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='font-body text-[11px] font-bold uppercase tracking-[0.18em] text-accent-soft'>Keep exploring</p>
          <h2 id='similar-properties-heading' className='mt-3 max-w-[16ch] text-balance font-display text-[clamp(1.9rem,4vw,3.35rem)] font-bold leading-[1.02] tracking-[-0.04em] text-bone'>
            Similar properties
          </h2>
        </div>
        <Link to='/properties' className='group inline-flex min-h-11 w-fit items-center gap-2 font-body text-[13px] font-bold text-bone/65 transition-colors duration-300 hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'>
          View all properties
          <ArrowRight className='size-4 transition-transform duration-300 group-hover:translate-x-1' />
        </Link>
      </div>

      <div className='-mx-4 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:mt-8 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-12 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0'>
        {similar.map((property, index) => {
          const availability = property.available > 0 ? `${property.available} available` : 'Fully reserved'

          return (
            <article key={property.slug} className={`group w-[min(78vw,19rem)] shrink-0 snap-start sm:w-[22rem] lg:w-auto lg:min-w-0 ${gridSpan(index, similar.length)}`}>
              <Link to={`/properties/${property.slug}`} className='relative block h-64 overflow-hidden rounded-[18px] bg-carbon outline-none sm:h-80 sm:rounded-[22px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-void'>
                {property.image && (
                  <img src={sized(property.image, 'card')} alt={`${property.name} property`} loading='lazy' decoding='async' className='absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.045] group-focus-within:scale-[1.045]' />
                )}
                <span aria-hidden className='absolute inset-0 bg-gradient-to-t from-void via-void/22 to-void/5' />
                <span className='absolute right-4 top-4 rounded-full border border-white/20 bg-void/65 px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.1em] text-white/85 backdrop-blur-sm'>
                  {availability}
                </span>
                <span className='absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-5 sm:p-6'>
                  <span className='min-w-0'>
                    <span className='font-body text-[10px] font-bold uppercase tracking-[0.17em] text-accent-soft'>{property.category}</span>
                    <span className='mt-2 block text-balance font-display text-[clamp(1.25rem,2.2vw,1.8rem)] font-bold leading-[1.08] tracking-[-0.025em] text-white'>{property.name}</span>
                    {property.address && <span className='mt-2 block truncate font-body text-[12px] text-white/60'>{property.address}</span>}
                  </span>
                  <span aria-hidden className='grid size-10 shrink-0 place-items-center rounded-full bg-white text-void transition-transform duration-300 group-hover:-rotate-45 group-focus-within:-rotate-45'>
                    <ArrowRight className='size-4' />
                  </span>
                </span>
              </Link>
            </article>
          )
        })}
      </div>
    </motion.section>
  )
}
