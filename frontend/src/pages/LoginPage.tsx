import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Loader2, Lock, LogIn, User } from 'lucide-react'
import { login, useAuth } from '../store/authStore'

const INPUT_CLASS = 'input input-vidrio pl-10 border-white/25 bg-white/10 text-white focus:border-white/70 focus:bg-white/15 focus:ring-white/15'
const LABEL_CLASS = 'label text-white/85'

export default function LoginPage() {
  const isAuthenticated = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (!username.trim() || !password) {
      setError('Ingresa tu usuario y contraseña.')
      return
    }
    setSubmitting(true)
    try {
      if (await login(username, password)) {
        navigate('/', { replace: true })
      } else {
        setError('Usuario o contraseña incorrectos.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-dvh bg-stone-950">
      <img src="/images/loginFondo.jpg" alt="" className="fixed inset-0 h-full w-full object-cover" />
      <div className="fixed inset-0 bg-stone-950/25" />

      <div className="relative flex min-h-dvh w-full items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:p-6">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex justify-center sm:mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white p-1.5 shadow-lg shadow-black/40 sm:h-32 sm:w-32">
              <img src="/images/cafelogo.jpg" alt="Logo Go Café" className="h-full w-full rounded-full object-cover" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/25 bg-stone-950/35 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <h1 className="text-center text-xl font-bold text-white">Go Café</h1>
            <p className="mt-1 text-center text-sm text-white/75">Sistema de producción<span className="hidden sm:inline"> · </span><br className="sm:hidden" />Inicia sesión para continuar.</p>

            {error && <div className="mt-5 rounded-xl border border-red-300/40 bg-red-500/25 p-3 text-center text-sm font-medium text-red-50">{error}</div>}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className={LABEL_CLASS}>Usuario</span>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
                  <input className={INPUT_CLASS} autoFocus={matchMedia('(pointer: fine)').matches} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" value={username} onChange={e => { setError(''); setUsername(e.target.value) }} placeholder="" />
                </div>
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Contraseña</span>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
                  <input type="password" className={INPUT_CLASS} autoComplete="current-password" enterKeyHint="go" value={password} onChange={e => { setError(''); setPassword(e.target.value) }} placeholder="" />
                </div>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-base sm:min-h-0 sm:py-2.5 sm:text-sm font-semibold text-stone-950 transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />} {submitting ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
