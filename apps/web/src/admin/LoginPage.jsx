import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { inputClass } from './components/Field'
import { useAdminTitle } from './adminUtils'
import { Alert, Button, IconButton } from './components/ui'

export default function LoginPage() {
  useAdminTitle('Sign in')
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to={location.state?.from?.pathname ?? '/admin'} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(location.state?.from?.pathname ?? '/admin', { replace: true })
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-void px-4 py-10 font-body text-bone">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-carbon p-6 sm:p-8">
        <h1 className="font-display text-2xl font-medium">Prime Developers Admin</h1>
        <p className="mt-1 text-sm text-bone-3">Sign in to manage the site.</p>

        <div className="mt-8 flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Email</span>
            {/* autocomplete lets a password manager fill the pair. */}
            <input
              type="email"
              required
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-bone-3">Password</span>
            <span className="relative">
              <input
                type={reveal ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-12`}
              />
              <IconButton
                icon={reveal ? EyeSlash : Eye}
                label={reveal ? 'Hide password' : 'Show password'}
                size="sm"
                onClick={() => setReveal((r) => !r)}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              />
            </span>
          </label>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" variant="primary" disabled={busy} className="mt-2 w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </main>
  )
}
