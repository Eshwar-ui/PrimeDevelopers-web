import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import ArrowRight from './ArrowRight'
import SectionHeader from './SectionHeader'
import { useSectionNav } from '../hooks/useSectionNav'
import { useSection, useProjects } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

const TEASER_COUNT = 7

export default function Projects() {
  const { heading } = useSection('projects_home')
  const allProjects = useProjects()
  const projects = allProjects.slice(0, TEASER_COUNT)
  const scope = useRef(null)
  const go = useSectionNav()
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const prev = useRef(0)
  const current = projects[active]
  const previous = projects[prev.current]

  const select = (i) => {
    if (i !== active) {
      prev.current = active
      setActive(i)
    }
  }

  useGSAP(
    () => {
      gsap.from('[data-card]', {
        x: -60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: scope.current, start: 'top 65%' },
      })
      gsap.from('[data-row]', {
        x: 40,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: scope.current, start: 'top 65%' },
      })

      const drift = (sel, dist) =>
        gsap.fromTo(
          sel,
          { yPercent: dist },
          {
            yPercent: -dist,
            ease: 'none',
            scrollTrigger: { trigger: scope.current, start: 'top bottom', end: 'bottom top', scrub: true },
          }
        )
      drift('[data-depth-back]', 12)
      drift('[data-depth-front]', 5)
      drift('[data-depth-list]', -6)
    },
    { scope }
  )

  if (projects.length === 0) return null

  return (
    <section
      id="projects"
      ref={scope}
      className="bg-carbon px-6 py-24 text-bone md:px-[134px] md:py-32"
    >
      <div className="mb-14 flex flex-col gap-8">
        <SectionHeader index="02" title="Work" />
        <h3 className="max-w-[16ch] font-display text-[2.2rem] font-light leading-[1.02] tracking-[-0.02em] md:text-h2">
          {renderEmphasis(heading)}
        </h3>
      </div>

      <div className="flex flex-col items-center gap-16 lg:flex-row lg:gap-24">
        {/* Stacked property cards */}
        <div data-card className="relative shrink-0">
          <div
            data-depth-back
            className="absolute -left-14 top-9 hidden h-[560px] w-[480px] overflow-hidden rounded-[20px] border border-[var(--color-line-inv)] opacity-30 md:block"
          >
            <img src={projects[0].image} alt="" className="h-full w-full object-cover" />
          </div>
          <div
            data-depth-front
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/projects/${current.slug}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${current.slug}`)}
            className="group/card relative h-[520px] w-[86vw] max-w-[420px] cursor-pointer overflow-hidden rounded-[24px] border border-bone/10 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.9)] md:h-[560px] md:w-[540px] md:max-w-none"
          >
            <img
              key={`back-${active}`}
              src={previous.image}
              alt=""
              className="proj-slide-out absolute inset-0 z-10 h-full w-full object-cover"
            />
            <img
              key={`front-${active}`}
              src={current.image}
              alt={current.name}
              className="proj-slide-in absolute inset-0 z-20 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.03]"
            />

            {/* gradient scrim so stats stay legible */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 z-20 h-1/2"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(26,26,26,0.85))' }}
            />

            <div className="absolute inset-x-8 bottom-8 z-30 border-t border-bone/25 pt-5">
              <p className="mb-4 font-display text-xl font-medium text-bone">{current.name}</p>
              <div className="flex items-end justify-between text-bone">
                {[
                  ['Buildings', current.buildings],
                  ['Units Sold', current.sold],
                  ['Available', current.available],
                ].map(([label, n]) => (
                  <div key={label} className="flex flex-col items-start gap-1.5">
                    <span className="numeral text-[2rem] text-ember">
                      {String(n).padStart(2, '0')}
                    </span>
                    <span className="eyebrow text-bone/50">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Project list + more link */}
        <div className="w-full max-w-[520px]">
          <ul data-depth-list>
            {projects.map((p, i) => {
              const isActive = i === active
              return (
                <li
                  key={p.slug}
                  data-row
                  role="link"
                  tabIndex={0}
                  onMouseEnter={() => select(i)}
                  onClick={() => navigate(`/projects/${p.slug}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${p.slug}`)}
                  className={`group flex cursor-pointer items-center gap-3 border-b py-4 transition-colors duration-300 ${
                    isActive ? 'border-bone/50' : 'border-[var(--color-line-inv)]'
                  }`}
                >
                  <span className="numeral w-8 shrink-0 text-sm text-ember">0{i + 1}</span>
                  <span
                    className={`flex-1 font-display text-2xl font-light leading-tight tracking-[-0.01em] transition-colors duration-300 md:text-[28px] ${
                      isActive ? 'text-bone' : 'text-bone/25'
                    }`}
                  >
                    {p.name}
                  </span>
                  <ArrowRight
                    className={`size-7 shrink-0 text-accent-soft transition-all duration-300 ${
                      isActive ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
                    }`}
                  />
                </li>
              )
            })}
          </ul>

          <a
            href="/projects"
            onClick={(e) => {
              e.preventDefault()
              go('/projects')
            }}
            className="group mt-10 inline-flex items-center gap-2.5 font-body text-sm font-bold uppercase tracking-[0.18em] text-bone transition-colors hover:text-accent-soft"
          >
            More Projects
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
