'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  roleColor, formatShortDate, type ScheduleData,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import { Users, Calendar, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { Accordion } from './Accordion'
import { HelpTooltip } from './HelpTooltip'

async function fetchSchedule(): Promise<ScheduleData> {
  const r = await fetch('/api/schedule?from=2026-06-01&to=2026-09-30')
  if (!r.ok) throw new Error('Failed to load')
  return r.json()
}

export function WorkloadTab() {
  const { data, isLoading } = useQuery({ queryKey: ['schedule'], queryFn: fetchSchedule })

  const workload = useMemo(() => {
    if (!data) return []

    // Count assignments per instructor
    const counts = new Map<string, { profile: any; total: number; primary: number; alt: number; days: Set<string>; events: Set<string> }>()

    for (const p of data.profiles) {
      counts.set(p.id, { profile: p, total: 0, primary: 0, alt: 0, days: new Set(), events: new Set() })
    }

    for (const a of data.assignments) {
      const entry = counts.get(a.profileId)
      if (!entry) continue
      entry.total++
      if (a.isAlternative) entry.alt++
      else entry.primary++
      entry.days.add(a.date)
      entry.events.add(a.eventId)
    }

    // Convert to array and sort by total assignments (most first)
    const arr = Array.from(counts.values())
      .filter(w => w.total > 0)
      .sort((a, b) => b.total - a.total)

    // Also get instructors with 0 assignments
    const unassigned = Array.from(counts.values())
      .filter(w => w.total === 0)
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name))

    return { assigned: arr, unassigned }
  }, [data])

  const stats = useMemo(() => {
    if (!workload.assigned) return { total: 0, assigned: 0, unassigned: 0, avg: 0, max: 0 }
    const total = workload.assigned.length + workload.unassigned.length
    const assignedCount = workload.assigned.length
    const unassignedCount = workload.unassigned.length
    const totalAssignments = workload.assigned.reduce((sum, w) => sum + w.total, 0)
    const avg = assignedCount > 0 ? Math.round(totalAssignments / assignedCount) : 0
    const max = workload.assigned.length > 0 ? workload.assigned[0].total : 0
    return { total, assigned: assignedCount, unassigned: unassignedCount, avg, max }
  }, [workload])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading workload data…</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-4 border-b border-border/60 bg-card/40 flex items-center gap-2">
        <div>
          <h2 className="text-base font-semibold">Instructor Workload</h2>
          <p className="text-xs text-muted-foreground">Overview of assignments across the full summer</p>
        </div>
        <HelpTooltip text="Shows total assignments per instructor. Green bar = normal workload, Amber = above average, Red = busy (20+ days). Also shows days worked, events involved in, and alternatives. Unassigned instructors are listed separately at the bottom." />
      </div>

      <div className="flex-1 overflow-y-auto" role="region" aria-label="Workload summary">
        <div className="p-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Users className="h-4 w-4" />} label="Total staff" value={stats.total} tone="neutral" />
            <StatCard icon={<Calendar className="h-4 w-4" />} label="With assignments" value={stats.assigned} tone="good" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Unassigned" value={stats.unassigned} tone={stats.unassigned > 0 ? 'warn' : 'good'} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg per instructor" value={stats.avg} tone="neutral" />
          </div>

          {/* Workload bars */}
          <Accordion label="Assigned Instructors" labelClassName="bg-emerald-500/15 text-emerald-300 border-emerald-500/30" defaultOpen>
            <div className="space-y-2 pt-2">
              {workload.assigned.map((w, i) => {
                const maxBar = stats.max || 1
                const barWidth = (w.total / maxBar) * 100
                const isOverworked = w.days.size > 20 // more than 20 working days
                return (
                  <div key={w.profile.id} className="rounded-lg border border-border/60 bg-card/80 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {w.profile.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{w.profile.name}</p>
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded border', roleColor(w.profile.roleTier))}>
                            {w.profile.roleTier}
                          </span>
                          {isOverworked && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                              <AlertTriangle className="h-2 w-2" /> Busy
                            </span>
                          )}
                        </div>
                        {/* Workload bar */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                isOverworked ? 'bg-rose-500' : w.total > stats.avg ? 'bg-amber-500' : 'bg-emerald-500',
                              )}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold tabular-nums shrink-0">{w.total}</span>
                        </div>
                        {/* Stats line */}
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {w.days.size} days
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Users className="h-2.5 w-2.5" />
                            {w.events.size} events
                          </span>
                          {w.alt > 0 && (
                            <span className="text-amber-300">{w.alt} alt</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Accordion>

          {/* Unassigned */}
          {workload.unassigned.length > 0 && (
            <Accordion label={`Unassigned (${workload.unassigned.length})`} labelClassName="bg-amber-500/15 text-amber-300 border-amber-500/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
                {workload.unassigned.map((w) => (
                  <div key={w.profile.id} className="rounded-lg border border-border/60 bg-card/60 p-2 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-white text-[9px] font-semibold flex items-center justify-center shrink-0">
                      {w.profile.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{w.profile.name}</p>
                      <span className={cn('text-[9px] px-1 py-0.5 rounded border', roleColor(w.profile.roleTier))}>
                        {w.profile.roleTier}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Accordion>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, tone }: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'good' | 'warn' | 'bad' | 'neutral'
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3 flex items-center gap-2',
      tone === 'good' && 'border-emerald-500/30 bg-emerald-500/5',
      tone === 'warn' && 'border-amber-500/30 bg-amber-500/5',
      tone === 'bad' && 'border-rose-500/30 bg-rose-500/5',
      tone === 'neutral' && 'border-border/60',
    )}>
      <div className={cn(
        'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
        tone === 'good' && 'bg-emerald-500/15 text-emerald-300',
        tone === 'warn' && 'bg-amber-500/15 text-amber-300',
        tone === 'bad' && 'bg-rose-500/15 text-rose-300',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
      )}>
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
