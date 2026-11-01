import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoLoader from '../components/LogoLoader'
import { Alert, Button } from './components/ui'

export default function RequireAuth({ children }) {
  const { session, loading, restoreError, retry, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LogoLoader label="Checking your session" />
  }

  // The session may well be fine — the API just didn't answer. Sending the
  // admin to the login page here would discard a token that still works.
  if (restoreError && session === undefined) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-void px-4 py-10 font-body text-bone">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-carbon p-6 sm:p-8">
          <h1 className="font-display text-2xl font-medium">Couldn’t check your session</h1>
          <div className="mt-6 flex flex-col gap-5">
            <Alert>{restoreError.message}</Alert>
            <Button variant="primary" onClick={retry} className="w-full">
              Try again
            </Button>
            <Button variant="ghost" onClick={signOut} className="w-full">
              Sign in again
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return children
}
