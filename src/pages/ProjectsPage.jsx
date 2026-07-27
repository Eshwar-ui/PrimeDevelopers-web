import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useSection, useProjects, useCategories } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="numeral text-xl text-ember">{String(value).padStart(2, '0')}</span>
      <span className="eyebrow text-[0.6rem] text-bone/40">{label}</span>
    </div>
  )
}

export default function ProjectsPage() {
  const p = useSection('projects_page')
  const projects = useProjects()
  const categories = useCategories()
  const [filter, setFilter] = useState('All')
  const navigate = useNavigate()
  const list = filter === 'All' ? projects : projects.filter((pr) => pr.category === filter)

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="projects-hero"
        className="relative overflow-hidden bg-void px-6 pb-16 pt-36 text-bone md:px-[75px] md:pb-20 md:pt-48"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 55% at 100% 0%, rgba(0,115,164,0.16) 0%, rgba(0,115,164,0) 100%)',
          }}
        />
        <div className="relative">
          <span className="eyebrow mb-6 flex items-center gap-4 text-bone/70">
            <span className="h-px w-10 bg-accent-soft" />
            {p.heroEyebrow}
          </span>
          <h1 className="font-display text-display font-light leading-[0.98] tracking-[-0.02em]">
            {renderEmphasis(p.heroHeading)}
          </h1>
          <p className="mt-8 max-w-[52ch] font-body text-lg leading-relaxed text-bone/65">{p.heroParagraph}</p>
        </div>
      </section>

      {/* ── Filter + grid ────────────────────────────────────── */}
      <section className="bg-carbon px-6 py-16 md:px-[75px] md:py-24">
        {/* Filter tabs */}
        <div className="mb-12 flex flex-wrap gap-2.5">
          {categories.map((c) => {
            const active = c === filter
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`rounded-full border px-5 py-2 font-body text-[13px] font-bold uppercase tracking-[0.14em] transition-colors duration-300 ${
                  active
                    ? 'border-accent bg-accent text-void'
                    : 'border-[var(--color-line-inv)] text-bone/50 hover:border-bone/40 hover:text-bone'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>

        {/* Cards */}
        <motion.div layout className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((p) => {
              const soldPct = Math.round((p.sold / p.buildings) * 100)
              const soldOut = p.available === 0
              return (
                <motion.article
                  key={p.slug}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => navigate(`/projects/${p.slug}`)}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-ink transition-colors duration-300 hover:border-bone/25"
                >
                  <div className="relative h-56 overflow-hidden bg-void">
                    {p.image && (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0"
                      />
                    )}
                    <span className="absolute left-4 top-4 rounded-full bg-void/70 px-3 py-1 font-body text-[0.66rem] font-bold uppercase tracking-[0.16em] text-bone backdrop-blur-sm">
                      {p.category}
                    </span>
                    {soldOut && (
                      <span className="absolute right-4 top-4 rounded-full bg-ember px-3 py-1 font-body text-[0.66rem] font-bold uppercase tracking-[0.16em] text-void">
                        Sold out
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-6 text-bone">
                    <h3 className="font-display text-xl font-medium tracking-[-0.01em] md:text-2xl">
                      {p.name}
                    </h3>
                    <p className="mt-1.5 font-body text-sm leading-snug text-bone/45">{p.address}</p>

                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--color-line-inv)] pt-4">
                      <Stat label="Buildings" value={p.buildings} />
                      <Stat label="Sold" value={p.sold} />
                      <Stat label="Available" value={p.available} />
                    </div>

                    {/* Availability bar */}
                    <div className="mt-5">
                      <div className="h-1 overflow-hidden rounded-full bg-[var(--color-line-inv)]">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${soldPct}%` }} />
                      </div>
                      <p className="eyebrow mt-2 text-[0.6rem] text-bone/40">{soldPct}% reserved</p>
                    </div>

                    <span className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-bone transition-colors group-hover:text-accent-soft">
                      View details
                      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </span>
                  </div>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </section>
    </div>
  )
}
