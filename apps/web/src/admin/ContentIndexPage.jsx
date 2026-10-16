import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react'
import { SECTIONS } from './content/sectionEditors'
import { GROUPS } from './content/sectionMeta'
import { PageHeader, SearchInput, focusRing } from './components/ui'
import { useAdminTitle } from './adminUtils'

// Grouped by where a section appears on the site. Twenty-nine cards in one
// flat grid left an editor reading every title to find "the footer".
function grouped(sections) {
  const placed = new Set(GROUPS.flatMap((g) => g.keys))
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]))
  const groups = GROUPS.map((g) => ({ ...g, sections: g.keys.map((k) => byKey[k]).filter(Boolean) }))
  const other = sections.filter((s) => !placed.has(s.key))
  if (other.length) groups.push({ id: 'other', label: 'Other', sections: other })
  return groups.filter((g) => g.sections.length)
}

export default function ContentIndexPage() {
  useAdminTitle('Site content')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = q
    ? SECTIONS.filter((s) => `${s.label} ${s.description} ${s.key}`.toLowerCase().includes(q))
    : SECTIONS
  const groups = grouped(matches)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Site content" description="The text, images and links on every page. Pick a section to edit it." />

      <div className="mt-6">
        <SearchInput value={query} onChange={setQuery} placeholder="Find a section — e.g. footer, hero" label="Find a section" icon={MagnifyingGlass} />
      </div>

      {groups.length === 0 && <p className="mt-10 text-center text-sm text-bone-3">No section matches “{query}”.</p>}

      <div className="mt-8 flex flex-col gap-10">
        {groups.map((g) => (
          <section key={g.id} aria-labelledby={`group-${g.id}`}>
            <h2 id={`group-${g.id}`} className="eyebrow text-[11px] text-bone-3">
              {g.label} <span className="font-normal">· {g.sections.length}</span>
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.sections.map((s) => (
                <Link
                  key={s.key}
                  to={`/admin/content/${s.key}`}
                  className={`group flex flex-col rounded-2xl border border-white/10 bg-carbon p-5 transition-colors hover:border-white/30 ${focusRing}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-display text-[16px] font-medium text-bone">{s.label}</span>
                    <ArrowRight
                      weight="bold"
                      className="mt-1 size-4 shrink-0 text-bone-3 transition-transform group-hover:translate-x-0.5 group-hover:text-bone"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-1.5 line-clamp-3 text-sm text-bone-3">{s.description}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
