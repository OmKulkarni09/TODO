import { useState } from 'react'
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from './AuthProvider.jsx'
import { VenomSpider } from './VenomSpider.jsx'

export default function Login() {
  const { login, register, error: ctxError, setError } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)

  const error = localError || ctxError

  const onSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setError?.(null)
    setSubmitting(true)
    try {
      if (mode === 'register') await register(email.trim(), password)
      else await login(email.trim(), password)
    } catch (err) {
      setLocalError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setLocalError(null)
    setError?.(null)
  }

  return (
    <div className="grid min-h-screen place-items-center p-4 animate-fade-in">
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-2xl border p-6 sm:p-8 animate-slide-up
                   border-slate-200 bg-white shadow-2xl shadow-slate-900/30
                   dark:border-white/[0.08] dark:bg-[#13181f]
                   dark:shadow-[0_0_0_1px_rgba(184,255,58,0.06),inset_0_1px_0_rgba(255,255,255,0.05),0_30px_60px_-20px_rgba(0,0,0,0.95),0_0_80px_-30px_rgba(184,255,58,0.25)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-2xl">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-venom-300/60 to-transparent" />
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-venom-300/20 blur-md" />
            <VenomSpider
              size={44}
              glow
              className="relative ring-1 ring-venom-300/40"
            />
          </div>
          <div>
            <div className="text-2xl font-black italic leading-none tracking-tight">
              <span className="text-slate-900 dark:text-white">ven</span>
              <span className="text-venom-300 text-venom-glow">OM</span>
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'Welcome back' : 'Claim your hunt'}
            </div>
          </div>
        </div>

        <h2 className="mb-1 text-lg font-bold tracking-tight">
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login'
            ? 'Welcome back. Your prey list awaits.'
            : 'Pick an email + password. Your tasks stay private to your account.'}
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Mail size={12} /> Email
            </label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Lock size={12} /> Password
            </label>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 6 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
              className="input"
            />
            {mode === 'register' && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Stored as a bcrypt hash on the backend. Plain-text password
                never leaves your device once you submit.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary mt-5 w-full"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <div className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-semibold text-venom-600 hover:underline dark:text-venom-300"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  )
}
