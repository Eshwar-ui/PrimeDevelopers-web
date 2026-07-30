import { Link, useNavigate } from 'react-router-dom'
import { useProperties, useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'

export default function PropertiesListPage() {
  const properties = useProperties()
  const refetch = useContentRefetch()
  const navigate = useNavigate()

  const createProperty = async () => {
    const name = 'New Property'
    const slug = `${slugify(name)}-${Date.now().toString(36)}`
    try {
      const created = await api.post('/admin/properties', {
        name,
        slug,
        sortOrder: properties.length,
        published: false,
      })
      await refetch()
      navigate(`/admin/properties/${created.id}`)
    } catch (err) {
      alert(err.message)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this property? This cannot be undone.')) return
    try {
      await api.del(`/admin/properties/${id}`)
      refetch()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium">Properties</h1>
          <p className="mt-1 text-sm text-bone/50">{properties.length} properties</p>
        </div>
        <button
          type="button"
          onClick={createProperty}
          className="rounded-full bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-void"
        >
          + New property
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {properties.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-carbon p-4"
          >
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/20">
              {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display text-base font-medium">{p.name}</p>
                {!p.published && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bone/50">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-bone/45">
                {p.category} · {p.address}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-xs font-bold uppercase tracking-wide">
              <Link to={`/admin/properties/${p.id}`} className="text-bone/60 hover:text-bone">
                Edit
              </Link>
              <button type="button" onClick={() => remove(p.id)} className="text-red-400/70 hover:text-red-400">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
