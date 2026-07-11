'use client'

import { useState, useSyncExternalStore } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Users, AlertTriangle, CheckCircle2, CalendarDays, ChevronDown, KeyRound, LogOut, User, Sun, Moon, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from './NotificationBell'
import { InstallAppMenuItem } from './InstallAppMenuItem'

type Props = {
  totalSlots: number
  filledSlots: number
  conflictCount: number
  weekLabel: string
  userName?: string
  userEmail?: string | null
  onChangePassword: () => void
  onLogout: () => void
}

export function StatsBar({
  totalSlots, filledSlots, conflictCount, weekLabel,
  userName, userEmail, onChangePassword, onLogout,
}: Props) {
  const { theme, setTheme } = useTheme()
  const qc = useQueryClient()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [menuOpen, setMenuOpen] = useState(false)

  const sendNowMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/notifications/send-now', { method: 'POST' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: (data: any) => {
      toast.success(`Sent ${data.sent} digest email${data.sent !== 1 ? 's' : ''}${data.skipped ? ' (skipped — no API key)' : ''}`)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('Failed to send notifications'),
  })

  const fillPct = totalSlots === 0 ? 0 : Math.round((filledSlots / totalSlots) * 100)
  const stats = [
    { icon: <CalendarDays className="h-3.5 w-3.5" />, label: 'Current week', value: weekLabel, tone: 'neutral' as const },
    { icon: <Users className="h-3.5 w-3.5" />, label: 'Instructors assigned', value: `${filledSlots} / ${totalSlots}`, tone: 'neutral' as const },
    { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Fill rate', value: `${fillPct}%`, tone: fillPct >= 80 ? 'good' : fillPct >= 50 ? 'warn' : 'bad' },
    { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Conflict warnings', value: String(conflictCount), tone: conflictCount === 0 ? 'good' : 'bad' },
  ]
  return (
    <header
      className="border-b border-border/60 bg-card/40 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 sm:gap-4"
      role="banner"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <img src="/logo.png" alt="RA Syncbot" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover shrink-0" />
        <div className="min-w-0 hidden sm:block">
          <h1 className="text-base font-semibold leading-tight truncate">RA Syncbot</h1>
          <p className="text-[10px] text-muted-foreground truncate">
            Barbados time (AST)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto flex-1" role="group" aria-label="Schedule statistics">
        {stats.map((s, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md border text-xs whitespace-nowrap shrink-0',
              s.tone === 'good' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
              s.tone === 'warn' && 'bg-amber-500/10 border-amber-500/30 text-amber-300',
              s.tone === 'bad' && 'bg-rose-500/10 border-rose-500/30 text-rose-300',
              s.tone === 'neutral' && 'bg-muted/40 border-border/60 text-foreground/80',
            )}
            aria-label={`${s.label}: ${s.value}`}
          >
            {s.icon}
            <span className="text-[10px] text-muted-foreground hidden md:inline">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[32px] flex items-center justify-center"
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Send pending notifications now (admin) */}
        <button
          onClick={() => sendNowMutation.mutate()}
          disabled={sendNowMutation.isPending}
          className="p-2 rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[32px] flex items-center justify-center disabled:opacity-50"
          aria-label="Send pending notification emails now"
          title="Send all pending digest emails immediately (instead of waiting for the 8am digest)"
        >
          <Send className="h-3.5 w-3.5" />
        </button>

        {/* Notifications */}
        <NotificationBell />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[32px]"
            aria-label="User menu"
            aria-expanded={menuOpen}
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline truncate max-w-[100px]">{userName ?? 'Account'}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-card border border-border/60 rounded-md shadow-lg py-1">
                <div className="px-3 py-2 border-b border-border/40">
                  <p className="text-xs font-medium truncate">{userName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); onChangePassword() }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Change password
                </button>
                <InstallAppMenuItem onAfterAction={() => setMenuOpen(false)} />
                <button
                  onClick={() => { setMenuOpen(false); onLogout() }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted text-rose-300 flex items-center gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
