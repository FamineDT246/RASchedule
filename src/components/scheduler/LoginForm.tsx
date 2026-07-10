'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'

type Props = {
  onLoggedIn: () => void
}

export function LoginForm({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!email || !password) {
      toast.error('Email and password are required')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Login failed')
      toast.success('Logged in')
      onLoggedIn()
    } catch (e: any) {
      toast.error(e.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="h-12 w-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
            RA
          </div>
          <h1 className="text-xl font-semibold">RA Syncbot</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in to the camp scheduler
          </p>
        </div>

        <div className="space-y-3 bg-card/80 border border-border/60 rounded-lg p-4">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              Email
            </label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              Password
            </label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full px-3 py-2 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[40px]"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/40 text-[10px] text-muted-foreground">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Staff: use the invite link your boss sent you. Admin: use your email and password.
          </span>
        </div>
      </div>
    </div>
  )
}
