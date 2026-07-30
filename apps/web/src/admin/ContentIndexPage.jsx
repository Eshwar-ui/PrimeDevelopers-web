import { Link } from 'react-router-dom'
import { SECTIONS } from './content/sectionEditors'

export default function ContentIndexPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-medium">Site Content</h1>
      <p className="mt-1 text-sm text-bone/50">Edit the text and images on every page.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            to={`/admin/content/${s.key}`}
            className="rounded-2xl border border-white/10 bg-carbon p-6 transition-colors hover:border-white/25"
          >
            <p className="font-display text-lg font-medium">{s.label}</p>
            <p className="mt-2 text-sm text-bone/45">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
