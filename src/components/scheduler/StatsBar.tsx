'use client'

import { Users, AlertTriangle, CheckCircle2, CalendarDays, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  totalSlots: number
  filledSlots: number
  conflictCount: number
  weekLabel: string
  onReseed: () => void
  reseeding: boolean
}

export function StatsBar({ totalSlots, filledSlots, conflictCount, weekLabel, onReseed, reseeding }: Props) {
  const fillPct = totalSlots === 0 ? 0 : Math.round((filledSlots / totalSlots) * 100)
  const stats = [
    { icon: <CalendarDays className="h-3.5 w-3.5" />, label: 'Current week', value: weekLabel, tone: 'neutral' as const },
    { icon: <Users className="h-3.5 w-3.5" />, label: 'Instructors assigned', value: `${filledSlots} / ${totalSlots}`, tone: 'neutral' as const },
    { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Fill rate', value: `${fillPct}%`, tone: fillPct >= 80 ? 'good' : fillPct >= 50 ? 'warn' : 'bad' },
    { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Conflict warnings', value: String(conflictCount), tone: conflictCount === 0 ? 'good' : 'bad' },
  ]
  return (
    <header className="border-b border-border/60 bg-card/40 px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          RA
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-tight truncate">Robot Adventure — Scheduler</h1>
          <p className="text-[10px] text-muted-foreground truncate">
            Camp &amp; workshop instructor assignment · Barbados time (AST)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {stats.map((s, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs whitespace-nowrap',
              s.tone === 'good' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
              s.tone === 'warn' && 'bg-amber-500/10 border-amber-500/30 text-amber-300',
              s.tone === 'bad' && 'bg-rose-500/10 border-rose-500/30 text-rose-300',
              s.tone === 'neutral' && 'bg-muted/40 border-border/60 text-foreground/80',
            )}
          >
            {s.icon}
            <span className="text-[10px] text-muted-foreground hidden sm:inline">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onReseed}
        disabled={reseeding}
        className="shrink-0 px-2.5 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground disabled:opacity-50 flex items-center gap-1.5"
        title="Reset database to seed data"
      >
        <RotateCcw className={cn('h-3 w-3', reseeding && 'animate-spin')} />
        <span className="hidden sm:inline">{reseeding ? 'Resetting…' : 'Reset data'}</span>
      </button>
    </header>
  )
}
