'use client'

import {
  formatWeekday,
  formatDayNum,
  formatShortDate,
  eventOnDate,
  todayInBarbados,
  type EventView,
  type AssignmentView,
} from '@/lib/scheduler-types'
import { DroppableEventCard } from './DroppableEventCard'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  weekStartISO: string
  events: EventView[]
  assignments: AssignmentView[]
  selected: { eventId: string; date: string } | null
  onSelect: (eventId: string, date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onJumpToday: () => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function weekDates(weekStartISO: string): string[] {
  const d = new Date(`${weekStartISO}T00:00:00.000Z`)
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export function CalendarGrid({
  weekStartISO, events, assignments, selected, onSelect, onPrevWeek, onNextWeek, onJumpToday,
}: Props) {
  const dates = weekDates(weekStartISO)
  const todayISO = todayInBarbados()

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Week navigator */}
      <div className="flex items-center justify-between p-3 border-b border-border/60 bg-card/40">
        <div>
          <h2 className="text-sm font-semibold">
            Week of {formatShortDate(weekStartISO)}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            {formatShortDate(dates[0])} – {formatShortDate(dates[6])}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onJumpToday}
            className="px-2 py-1 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground"
          >
            Today
          </button>
          <button
            onClick={onPrevWeek}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            title="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onNextWeek}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            title="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className="p-2 text-center text-[10px] font-medium text-muted-foreground border-r border-border/40 last:border-r-0">
            {wd}
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex-1 grid grid-cols-7 overflow-hidden">
        {dates.map((dateISO, i) => {
          const dayEvents = events.filter(e => eventOnDate(e, dateISO))
          const dayAssignments = assignments.filter(a => a.date === dateISO)
          const isToday = dateISO === todayISO
          const weekday = formatWeekday(dateISO)
          const dayNum = formatDayNum(dateISO)
          return (
            <div
              key={dateISO}
              className={cn(
                'flex flex-col border-r border-border/40 last:border-r-0 min-w-0 overflow-y-auto',
                isToday && 'bg-emerald-500/[0.04]',
              )}
            >
              <div className={cn(
                'p-2 border-b border-border/40 sticky top-0 backdrop-blur-sm bg-card/80 z-10',
                isToday && 'bg-emerald-500/10',
              )}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{weekday}</span>
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    isToday && 'text-emerald-400',
                  )}>
                    {dayNum}
                  </span>
                </div>
              </div>
              <div className="p-1.5 space-y-2 flex-1">
                {dayEvents.length === 0 && (
                  <div className="text-[10px] text-muted-foreground text-center py-2 opacity-50">
                    No events
                  </div>
                )}
                {dayEvents.map(ev => {
                  const evAssignments = dayAssignments.filter(a => a.eventId === ev.id)
                  const isSelected = selected?.eventId === ev.id && selected?.date === dateISO
                  return (
                    <DroppableEventCard
                      key={ev.id}
                      event={ev}
                      date={dateISO}
                      assignments={evAssignments}
                      selected={!!isSelected}
                      onSelect={(eventId, date) => onSelect(eventId, date)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
