'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  hostColor,
  formatTime,
  formatPrettyDate,
  formatShortDate,
  parseSkills,
  parseDates,
  eventOnDate,
  addDaysISO,
  type EventView,
  type AssignmentView,
  type ProfileView,
  type ScheduleData,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, Users, CalendarX, Clock, ShieldAlert, CheckCircle2, X, ArrowRight, Wrench,
} from 'lucide-react'
import { Accordion } from './Accordion'
import { HelpTooltip } from './HelpTooltip'

async function fetchFullSchedule(): Promise<ScheduleData> {
  const r = await fetch('/api/schedule?from=2026-06-01&to=2026-09-30')
  if (!r.ok) throw new Error('Failed to load schedule')
  return r.json()
}

type Issue =
  | { type: 'double-booking'; date: string; profileId: string; profileName: string; events: { eventId: string; eventName: string; startTime: string; endTime: string }[] }
  | { type: 'unavailable'; date: string; profileId: string; profileName: string; eventName: string; eventId: string }
  | { type: 'fatigue'; profileId: string; profileName: string; streak: number; dates: string[] }
  | { type: 'unfilled'; date: string; eventId: string; eventName: string; hostColor: string; filled: number; needed: number }
  | { type: 'skill-gap'; date: string; eventId: string; eventName: string; hostColor: string; profileId: string; profileName: string; missingSkills: string[] }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function rangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(s2) < timeToMinutes(e1)
}

export function ConflictSummaryTab({ onJumpToEvent }: { onJumpToEvent: (eventId: string, date: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: fetchFullSchedule,
  })

  const issues = useMemo(() => {
    if (!data) return { doubleBookings: [], unavailable: [], fatigue: [], unfilled: [], skillGaps: [] } as {
      doubleBookings: Issue[]
      unavailable: Issue[]
      fatigue: Issue[]
      unfilled: Issue[]
      skillGaps: Issue[]
    }

    const profiles = data.profiles as ProfileView[]
    const events = data.events as EventView[]
    const assignments = data.assignments as AssignmentView[]

    // Build a map of (profileId + date) → assignments
    const byProfileDate = new Map<string, AssignmentView[]>()
    for (const a of assignments) {
      const key = `${a.profileId}|${a.date}`
      if (!byProfileDate.has(key)) byProfileDate.set(key, [])
      byProfileDate.get(key)!.push(a)
    }

    // 1. Double-bookings: same profile, same date, overlapping times
    const doubleBookings: Issue[] = []
    for (const [key, dayAssignments] of byProfileDate) {
      if (dayAssignments.length < 2) continue
      const [profileId, date] = key.split('|')
      const profile = profiles.find(p => p.id === profileId)
      // Check all pairs for time overlap
      for (let i = 0; i < dayAssignments.length; i++) {
        for (let j = i + 1; j < dayAssignments.length; j++) {
          const a1 = dayAssignments[i]
          const a2 = dayAssignments[j]
          const e1 = events.find(e => e.id === a1.eventId)
          const e2 = events.find(e => e.id === a2.eventId)
          if (!e1 || !e2) continue
          if (rangesOverlap(e1.startTime, e1.endTime, e2.startTime, e2.endTime)) {
            // Avoid duplicate pairs (only add once per profile+date)
            if (i === 0 && j === 1) {
              doubleBookings.push({
                type: 'double-booking',
                date,
                profileId,
                profileName: profile?.name ?? a1.profileName,
                events: dayAssignments.map(a => {
                  const ev = events.find(e => e.id === a.eventId)!
                  return { eventId: a.eventId, eventName: ev.name, startTime: ev.startTime, endTime: ev.endTime }
                }),
              })
            }
          }
        }
      }
    }

    // 2. Unavailable violations: profile assigned on a date they're marked unavailable
    const unavailable: Issue[] = []
    for (const a of assignments) {
      const profile = profiles.find(p => p.id === a.profileId)
      if (!profile?.unavailableList?.includes(a.date)) continue
      const ev = events.find(e => e.id === a.eventId)
      if (!ev) continue
      unavailable.push({
        type: 'unavailable',
        date: a.date,
        profileId: a.profileId,
        profileName: profile.name,
        eventName: ev.name,
        eventId: ev.id,
      })
    }

    // 3. Fatigue: >5 consecutive working days
    const fatigue: Issue[] = []
    for (const profile of profiles) {
      const myDates = new Set(
        assignments
          .filter(a => a.profileId === profile.id)
          .map(a => a.date)
          .sort(),
      )
      if (myDates.size === 0) continue
      // Find consecutive streaks
      const sortedDates = Array.from(myDates).sort()
      let streakStart = sortedDates[0]
      let streakEnd = sortedDates[0]
      const streaks: { start: string; end: string; dates: string[] }[] = []
      const currentDates = [sortedDates[0]]
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = sortedDates[i - 1]
        const curr = sortedDates[i]
        if (addDaysISO(prev, 1) === curr) {
          streakEnd = curr
          currentDates.push(curr)
        } else {
          if (currentDates.length > 5) {
            streaks.push({ start: streakStart, end: streakEnd, dates: [...currentDates] })
          }
          streakStart = curr
          streakEnd = curr
          currentDates.length = 0
          currentDates.push(curr)
        }
      }
      if (currentDates.length > 5) {
        streaks.push({ start: streakStart, end: streakEnd, dates: [...currentDates] })
      }
      for (const s of streaks) {
        fatigue.push({
          type: 'fatigue',
          profileId: profile.id,
          profileName: profile.name,
          streak: s.dates.length,
          dates: s.dates,
        })
      }
    }

    // 4. Unfilled slots: events with fewer primaries than required
    const unfilled: Issue[] = []
    for (const ev of events) {
      // For each day the event runs
      const eventDates = new Set<string>()
      if (ev.specificDatesList?.length) {
        ev.specificDatesList.forEach(d => eventDates.add(d))
      } else {
        let d = ev.startDate
        while (d <= ev.endDate) {
          eventDates.add(d)
          d = addDaysISO(d, 1)
        }
      }
      for (const date of eventDates) {
        const dayAssignments = assignments.filter(a => a.eventId === ev.id && a.date === date)
        const primaries = dayAssignments.filter(a => !a.isAlternative).length
        if (primaries < ev.requiredInstructors) {
          unfilled.push({
            type: 'unfilled',
            date,
            eventId: ev.id,
            eventName: ev.name,
            hostColor: ev.hostColor,
            filled: primaries,
            needed: ev.requiredInstructors,
          })
        }
      }
    }

    // Sort all by date
    const sortByDate = (a: Issue, b: Issue) => {
      const da = 'date' in a ? a.date : ''
      const db = 'date' in b ? b.date : ''
      return da.localeCompare(db)
    }
    doubleBookings.sort(sortByDate)
    unavailable.sort(sortByDate)
    unfilled.sort(sortByDate)

    // 5. Skill gaps: instructors assigned to events where they don't have the required skills
    const skillGaps: Issue[] = []
    for (const a of assignments) {
      const profile = profiles.find(p => p.id === a.profileId)
      const ev = events.find(e => e.id === a.eventId)
      if (!profile || !ev || ev.requiredSkills.length === 0) continue
      const missing = ev.requiredSkills.filter(s => !profile.skillsList.includes(s))
      if (missing.length > 0) {
        skillGaps.push({
          type: 'skill-gap',
          date: a.date,
          eventId: ev.id,
          eventName: ev.name,
          hostColor: ev.hostColor,
          profileId: profile.id,
          profileName: profile.name,
          missingSkills: missing,
        })
      }
    }
    skillGaps.sort(sortByDate)

    return { doubleBookings, unavailable, fatigue, unfilled, skillGaps }
  }, [data])

  const totalIssues = issues.doubleBookings.length + issues.unavailable.length + issues.fatigue.length + issues.unfilled.length + issues.skillGaps.length

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-4 border-b border-border/60 bg-card/40 flex items-center gap-2">
        <div>
          <h2 className="text-base font-semibold">Conflict Summary</h2>
          <p className="text-xs text-muted-foreground">Scans the entire summer for scheduling problems.</p>
        </div>
        <HelpTooltip text="This tab scans the entire summer for problems: Double-bookings (same person at overlapping events), Unavailable violations (person assigned on a day they marked unavailable), Fatigue streaks (>5 consecutive work days), Unfilled slots (events below required instructor count), Skill gaps (instructor missing required skills — informational, not blocking). Click any item to jump to that event in the scheduler." />
      </div>

      <div className="flex-1 overflow-y-auto" role="region" aria-label="Conflict summary">
        <div className="p-4 space-y-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Scanning schedule…</p>
          )}

          {!isLoading && totalIssues === 0 && (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
              <h3 className="text-sm font-semibold text-emerald-300">No conflicts found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                All events are fully staffed, no double-bookings, no unavailable violations, no fatigue streaks.
              </p>
            </div>
          )}

          {/* Summary cards */}
          {!isLoading && totalIssues > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                icon={<CalendarX className="h-4 w-4" />}
                label="Double-bookings"
                count={issues.doubleBookings.length}
                tone="bad"
              />
              <SummaryCard
                icon={<X className="h-4 w-4" />}
                label="Unavailable violations"
                count={issues.unavailable.length}
                tone="bad"
              />
              <SummaryCard
                icon={<ShieldAlert className="h-4 w-4" />}
                label="Fatigue streaks"
                count={issues.fatigue.length}
                tone="warn"
              />
              <SummaryCard
                icon={<Users className="h-4 w-4" />}
                label="Unfilled slots"
                count={issues.unfilled.length}
                tone="warn"
              />
              <SummaryCard
                icon={<Wrench className="h-4 w-4" />}
                label="Skill gaps"
                count={issues.skillGaps.length}
                tone="warn"
              />
            </div>
          )}

          {/* Double-bookings */}
          {issues.doubleBookings.length > 0 && (
            <IssueSection title="Double-bookings" icon={<CalendarX className="h-3.5 w-3.5" />} tone="bad">
              {issues.doubleBookings.map((issue, i) => (
                <IssueCard key={i}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{issue.profileName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatPrettyDate(issue.date)}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
                      {issue.events.length} events
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {issue.events.map((e, j) => (
                      <div key={j} className="flex items-center gap-2 text-[11px]">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{formatTime(e.startTime)} – {formatTime(e.endTime)}</span>
                        <span className="truncate">{e.eventName}</span>
                      </div>
                    ))}
                  </div>
                </IssueCard>
              ))}
            </IssueSection>
          )}

          {/* Unavailable violations */}
          {issues.unavailable.length > 0 && (
            <IssueSection title="Unavailable violations" icon={<X className="h-3.5 w-3.5" />} tone="bad">
              {issues.unavailable.map((issue, i) => (
                <IssueCard key={i}>
                  <button
                    onClick={() => onJumpToEvent(issue.eventId, issue.date)}
                    className="flex items-center justify-between gap-2 w-full text-left hover:text-emerald-300 transition-colors group"
                    aria-label={`Jump to ${issue.eventName} on ${formatPrettyDate(issue.date)}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{issue.profileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Assigned to <span className="text-foreground/90">{issue.eventName}</span> on {formatPrettyDate(issue.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        Marked unavailable
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-emerald-300" />
                    </div>
                  </button>
                </IssueCard>
              ))}
            </IssueSection>
          )}

          {/* Fatigue */}
          {issues.fatigue.length > 0 && (
            <IssueSection title="Fatigue streaks (>5 consecutive days)" icon={<ShieldAlert className="h-3.5 w-3.5" />} tone="warn">
              {issues.fatigue.map((issue, i) => (
                <IssueCard key={i}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{issue.profileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatShortDate(issue.dates[0])} – {formatShortDate(issue.dates[issue.dates.length - 1])}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                      {issue.streak} days
                    </span>
                  </div>
                </IssueCard>
              ))}
            </IssueSection>
          )}

          {/* Unfilled slots */}
          {issues.unfilled.length > 0 && (
            <IssueSection title="Unfilled slots" icon={<Users className="h-3.5 w-3.5" />} tone="warn">
              {issues.unfilled.map((issue, i) => {
                const colors = hostColor(issue.hostColor)
                return (
                  <IssueCard key={i}>
                    <button
                      onClick={() => onJumpToEvent(issue.eventId, issue.date)}
                      className="flex items-center justify-between gap-2 w-full text-left hover:text-emerald-300 transition-colors group"
                      aria-label={`Jump to ${issue.eventName} on ${formatPrettyDate(issue.date)}`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', colors.bar)} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{issue.eventName}</p>
                          <p className="text-[10px] text-muted-foreground">{formatPrettyDate(issue.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 tabular-nums">
                          {issue.filled}/{issue.needed}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-emerald-300" />
                      </div>
                    </button>
                  </IssueCard>
                )
              })}
            </IssueSection>
          )}

          {/* Skill gaps */}
          {issues.skillGaps.length > 0 && (
            <IssueSection title="Skill gaps (needs practice gear)" icon={<Wrench className="h-3.5 w-3.5" />} tone="warn">
              {issues.skillGaps.map((issue, i) => {
                const si = issue as any
                const colors = hostColor(si.hostColor)
                return (
                  <IssueCard key={i}>
                    <button
                      onClick={() => onJumpToEvent(si.eventId, si.date)}
                      className="flex items-center justify-between gap-2 w-full text-left hover:text-emerald-300 transition-colors group"
                      aria-label={`Jump to ${si.eventName} on ${formatPrettyDate(si.date)}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full shrink-0', colors.bar)} />
                          <p className="text-sm font-medium truncate">{si.profileName}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {si.eventName} · {formatPrettyDate(si.date)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {si.missingSkills.map((skill: string) => (
                            <span key={skill} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                              <Wrench className="h-2 w-2" />
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-emerald-300 shrink-0" />
                    </button>
                  </IssueCard>
                )
              })}
            </IssueSection>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, count, tone }: {
  icon: React.ReactNode
  label: string
  count: number
  tone: 'bad' | 'warn' | 'good'
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3 flex items-center gap-2',
      tone === 'bad' && 'border-rose-500/30 bg-rose-500/5',
      tone === 'warn' && 'border-amber-500/30 bg-amber-500/5',
      tone === 'good' && 'border-emerald-500/30 bg-emerald-500/5',
    )}>
      <div className={cn(
        'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
        tone === 'bad' && 'bg-rose-500/15 text-rose-300',
        tone === 'warn' && 'bg-amber-500/15 text-amber-300',
        tone === 'good' && 'bg-emerald-500/15 text-emerald-300',
      )}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={cn(
          'text-lg font-bold tabular-nums',
          tone === 'bad' && 'text-rose-300',
          tone === 'warn' && 'text-amber-300',
          tone === 'good' && 'text-emerald-300',
        )}>
          {count}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  )
}

function IssueSection({ title, icon, tone, children }: {
  title: string
  icon: React.ReactNode
  tone: 'bad' | 'warn'
  children: React.ReactNode
}) {
  return (
    <Accordion
      label={title}
      labelClassName={cn(
        'flex items-center gap-1',
        tone === 'bad'
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      )}
    >
      <div className="space-y-1.5 pt-2">
        {children}
      </div>
    </Accordion>
  )
}

function IssueCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3">
      {children}
    </div>
  )
}
