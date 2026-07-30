import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/properties', label: 'Properties' },
  { to: '/admin/news', label: 'News' },
  { to: '/admin/content', label: 'Site Content' },
  { to: '/admin/leads', label: 'Leads' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-[100dvh] bg-void text-bone">
      <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-white/10 p-6">
        <div>
          <p className="font-display text-lg font-medium">Prime Admin</p>
          <nav className="mt-10 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-bone' : 'text-bone/55 hover:bg-white/5 hover:text-bone'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold uppercase tracking-wide text-bone/40 hover:text-bone/70"
          >
            View site ↗
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="w-fit text-xs font-bold uppercase tracking-wide text-bone/40 hover:text-bone/70"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
