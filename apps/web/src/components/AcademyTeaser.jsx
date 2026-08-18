import { Link } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import ArrowRight from './ArrowRight'

export default function AcademyTeaser() {
  const { terms = [] } = useSection('academy')
  const featured = terms.slice(0, 3)
  if (!featured.length) return null

  return (
    <section data-band="light" className="bg-surface px-gutter py-20 text-content md:px-gutter-lg md:py-28">
      <div className="mx-auto max-w-[1360px]">
        <div className="grid gap-10 border-b border-line pb-10 md:grid-cols-[1fr_auto] md:items-end">
          <h2 className="max-w-[13ch] text-balance font-display text-[clamp(2rem,4.4vw,4rem)] font-bold leading-[1.02] tracking-[-0.035em]">
            Real estate, explained clearly.
          </h2>
          <Link to="/learn" className="group inline-flex min-h-11 items-center gap-3 font-body text-[14px] font-bold uppercase tracking-[0.1em] text-accent">
            Explore the field guide
            <ArrowRight className="size-5 transition-transform duration-300 ease-brand group-hover:translate-x-1" />
          </Link>
        </div>

        <ol>
          {featured.map((item, index) => (
            <li key={item.slug}>
              <Link to={`/learn/${item.slug}`} className="group grid gap-4 border-b border-line py-7 transition-colors duration-300 hover:text-accent md:grid-cols-[4rem_minmax(12rem,0.8fr)_1.4fr_auto] md:items-center md:gap-8">
                <span className="numeral text-sm text-content/40">0{index + 1}</span>
                <strong className="font-display text-xl font-semibold">{item.term}</strong>
                <span className="font-body text-[15px] leading-relaxed text-content/60">{item.shortDefinition}</span>
                <ArrowRight className="size-5 transition-transform duration-300 ease-brand group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
