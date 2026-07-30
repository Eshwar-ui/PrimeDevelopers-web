import { Link } from 'react-router-dom'
import { useProperties } from '../context/ContentContext'

export default function DashboardPage() {
  const properties = useProperties()

  const cards = [
    { label: 'Properties', value: properties.length, to: '/admin/properties' },
    { label: 'Available units', value: properties.reduce((n, p) => n + p.available, 0), to: '/admin/properties' },
    { label: 'Site content sections', value: 11, to: '/admin/content' },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-medium">Dashboard</h1>
      <p className="mt-1 text-sm text-bone/50">Manage your properties, site text, images, and leads.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border border-white/10 bg-carbon p-6 transition-colors hover:border-white/25"
          >
            <p className="numeral text-3xl text-ember">{c.value}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-bone/45">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
