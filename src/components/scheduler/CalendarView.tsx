'use client'

import { useState, useMemo } from 'react'
import {
  hostColor, formatTime, eventOnDate, todayInBarbados, isPastDate,
  addDaysISO, type EventView, type AssignmentView, type ProfileView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Users, MapPin, Clock } from 'lucide-react'
import { HelpTooltip } from './HelpTooltip'

type Props = {
  events: EventView[]
  assignments: AssignmentView[]
  profiles?: ProfileView[]
  /** If provided, highlights this instructor's assignments */
  myProfileId?: string
  /** Read-only mode (instructors can't click to edit) */
  readOnly?: boolean
  onSelect?: (eventId: string, date: string) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthDates(year: number, month: number): string[] {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(year, month + 1, 0))

  // Find the Monday on or before the first day
  const start = new Date(firstDay)
  const dayOfWeek = start.getUTCDay() // 0=Sun
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  start.setUTCDate(start.getUTCDate() - offset)

  // Find the Sunday on or after the last day
  const end = new Date(lastDay)
  const endDayOfWeek = end.getUTCDay()
  const endOffset = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek
  end.setUTCDate(end.getUTCDate() + endOffset)

  const dates: string[] = []
  const d = new Date(start)
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}

export function CalendarView({ events, assignments, profiles, myProfileId, readOnly, onSelect }: Props) {
  const todayISO = todayInBarbados()
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Default to the month of the first event, or current month
    if (events.length > 0) {
      const d = new Date(events[0].startDate + 'T00:00:00.000Z')
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
    }
    const d = new Date()
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
  })

  const dates = useMemo(
    () => getMonthDates(currentMonth.year, currentMonth.month),
    [currentMonth],
  )

  const prevMonth = () => {
    setCurrentMonth(m => {
      const d = new Date(Date.UTC(m.year, m.month - 1, 1))
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
    })
  }

  const nextMonth = () => {
    setCurrentMonth(m => {
      const d = new Date(Date.UTC(m.year, m.month + 1, 1))
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
    })
  }

  const jumpToday = () => {
    const d = new Date()
    setCurrentMonth({ year: d.getUTCFullYear(), month: d.getMonth() })
  }

  // Group dates into weeks (rows of 7)
  const weeks: string[][] = []
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7))
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Month navigator */}
      <div className="flex items-center justify-between p-3 border-b border-border/60 bg-card/40 gap-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <h2 className="text-sm font-semibold">
            {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
          </h2>
          <HelpTooltip text="This is the full month calendar view. Each colored chip is an event on that date. The X/Y number shows how many instructors are assigned vs needed. Click any event to see details. Use the arrows to navigate between months. Past dates are dimmed." />
          <p className="text-[10px] text-muted-foreground hidden sm:block">
            {events.length} events total
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={jumpToday}
            className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[32px]"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable calendar */}
      <div className="flex-1 overflow-y-auto" role="region" aria-label="Month calendar">
        {/* Weekday header */}
        <div className="grid grid-cols-7 sticky top-0 bg-card/80 backdrop-blur-sm z-10 border-b border-border/60">
          {WEEKDAY_LABELS.map(wd => (
            <div
              key={wd}
              className="p-2 text-center text-[10px] font-medium text-muted-foreground border-r border-border/40 last:border-r-0"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {dates.map((dateISO, i) => {
            const dayEvents = events.filter(e => eventOnDate(e, dateISO))
            const isInMonth = new Date(dateISO + 'T00:00:00.000Z').getUTCMonth() === currentMonth.month
            const isToday = dateISO === todayISO
            const isPast = isPastDate(dateISO)
            const dayNum = new Date(dateISO + 'T00:00:00.000Z').getUTCDate()

            return (
              <div
                key={dateISO}
                className={cn(
                  'min-h-[90px] sm:min-h-[120px] border-r border-b border-border/40 last:border-r-0 p-1 sm:p-1.5 flex flex-col gap-0.5',
                  !isInMonth && 'bg-muted/5',
                  isToday && 'bg-emerald-500/[0.08] ring-1 ring-emerald-400/30 ring-inset',
                  isPast && !isToday && 'bg-zinc-500/[0.03]',
                )}
              >
                <div className={cn(
                  'text-[10px] sm:text-xs font-semibold tabular-nums mb-0.5',
                  !isInMonth && 'text-muted-foreground/30',
                  isToday && 'text-emerald-400',
                  isPast && !isToday && isInMonth && 'text-muted-foreground/50',
                )}>
                  {dayNum}
                </div>
                {dayEvents.map(ev => {
                  const colors = hostColor(ev.hostColor)
                  const dayAssignments = assignments.filter(a => a.eventId === ev.id && a.date === dateISO)
                  const primaries = dayAssignments.filter(a => !a.isAlternative).length
                  const myAssignment = myProfileId
                    ? dayAssignments.find(a => a.profileId === myProfileId)
                    : undefined

                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelect?.(ev.id, dateISO)}
                      className={cn(
                        'text-left rounded px-1 py-0.5 text-[9px] sm:text-[10px] leading-tight truncate transition-all border cursor-pointer hover:scale-[1.02] hover:shadow-sm',
                        isPast ? 'opacity-60' : '',
                        myAssignment ? 'ring-1 ring-emerald-400' : '',
                        colors.chip,
                      )}
                      title={`${ev.name} — ${formatTime(ev.startTime)}${ev.location ? ' @ ' + ev.location : ''}${dayAssignments.length ? ` (${primaries}/${ev.requiredInstructors} instructors)` : ''}${myAssignment ? ' — YOU ARE ASSIGNED' : ''}`}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors.dot)} />
                        <span className="truncate font-medium">{ev.name}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {!readOnly && (
                          <span className="flex items-center gap-0.5 opacity-70">
                            <Users className="h-2 w-2" />
                            {primaries}/{ev.requiredInstructors}
                          </span>
                        )}
                        {myAssignment && (
                          <span className="text-emerald-300 font-bold ml-auto">★</span>
                        )}
                      </div>
                      {readOnly && myAssignment && (
                        <span className="text-emerald-300 text-[9px] font-bold">★ You're in</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
