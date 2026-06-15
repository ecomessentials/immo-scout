'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'

const VALID_EMAIL = 'fabiokrieger23@gmail.com'
const VALID_PASSWORD = 'Immobilien12'

function IKLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="34" height="34" rx="9" fill="#1B4FD8" />
      <rect x="9" y="9" width="4" height="16" rx="1.5" fill="white" />
      <path d="M16 17L23 9h4L20 17l7 8h-4l-7-8z" fill="#F59E0B" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('authenticated') === 'true') router.replace('/')
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (email.trim() === VALID_EMAIL && password === VALID_PASSWORD) {
      localStorage.setItem('authenticated', 'true')
      router.replace('/')
    } else {
      setError('E-Mail oder Passwort ist falsch.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 mb-4">
            <IKLogo />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ImmobilienKrieger</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Dein automatischer Immobilien-Scout</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Anmelden</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Melde dich an um fortzufahren</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
                E-Mail
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="ihre@email.de"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
                Passwort
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-xl text-sm shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-60 mt-2"
            >
              {loading ? 'Anmelden…' : (
                <>Anmelden <ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-slate-600 mt-6">
          ImmobilienKrieger · Dein automatischer Immobilien-Scout
        </p>
      </div>
    </div>
  )
}
