import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LeadsPage() {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setLeads(data)
  }

  useEffect(() => {
    load()
  }, [])

  const markRead = async (id, status) => {
    await supabase.from('leads').update({ status }).eq('id', id)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-medium">Leads</h1>
      <p className="mt-1 text-sm text-bone/50">Contact form submissions from the public site.</p>

      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex flex-col gap-3">
        {leads?.length === 0 && <p className="text-sm text-bone/40">No submissions yet.</p>}
        {leads?.map((l) => (
          <div
            key={l.id}
            className={`rounded-2xl border p-6 ${
              l.status === 'new' ? 'border-ember/40 bg-carbon' : 'border-white/10 bg-carbon/50'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-lg font-medium">{l.name}</p>
                <p className="text-sm text-bone/50">
                  {l.email}
                  {l.phone ? ` · ${l.phone}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs font-bold uppercase tracking-wide">
                <span className="text-bone/35">{new Date(l.created_at).toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => markRead(l.id, l.status === 'new' ? 'read' : 'new')}
                  className="text-bone/50 hover:text-bone"
                >
                  {l.status === 'new' ? 'Mark read' : 'Mark new'}
                </button>
                <button type="button" onClick={() => remove(l.id)} className="text-red-400/70 hover:text-red-400">
                  Delete
                </button>
              </div>
            </div>
            {l.message && <p className="mt-4 whitespace-pre-wrap text-sm text-bone/70">{l.message}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
