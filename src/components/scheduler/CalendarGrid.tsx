'use client'

import { useState } from 'react'
import {
  formatWeekday,
  formatDayNum,
  formatShortDate,
  formatPrettyDate,
  eventOnDate,
  todayInBarbados,
  isPastDate,
  type EventView,
  type AssignmentView,
} from '@/lib/scheduler-types'
import { DroppableEventCard } from './DroppableEventCard'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Download, FileText} from 'lucide-react'
import { exportCSV } from '@/lib/export-utils'
import { HelpTooltip } from './HelpTooltip'

type Props = {
  weekStartISO: string
  events: EventView[]
  assignments: AssignmentView[]
  selected: { eventId: string; date: string } | null
  onSelect: (eventId: string, date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onJumpToday: () => void
  onPrint: () => void
  tapAssignMode?: boolean
  hasSelectedProfile?: boolean
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
  weekStartISO, events, assignments, selected, onSelect, onPrevWeek, onNextWeek, onJumpToday, onPrint,
  tapAssignMode, hasSelectedProfile,
}: Props) {
  const dates = weekDates(weekStartISO)
  const todayISO = todayInBarbados()
  // Mobile: track which day is in focus (defaults to today if in this week, else first day)
  const [mobileDayIdx, setMobileDayIdx] = useState(() => {
    const todayIdx = dates.indexOf(todayISO)
    return todayIdx >= 0 ? todayIdx : 0
  })

  const renderDayColumn = (dateISO: string, idx: number, dates: string[]) => {
    const dayEvents = events.filter(e => eventOnDate(e, dateISO))
    const dayAssignments = assignments.filter(a => a.date === dateISO)
    const isToday = dateISO === todayISO
    const isPast = isPastDate(dateISO)
    const weekday = formatWeekday(dateISO)
    const dayNum = formatDayNum(dateISO)
    return (
      <div
        key={dateISO}
        className={cn(
          'flex flex-col border-r border-border/40 last:border-r-0 min-w-0 overflow-y-auto',
          isToday && 'bg-emerald-500/[0.04]',
          isPast && !isToday && 'bg-zinc-500/[0.03]',
        )}
        role="region"
        aria-label={`${weekday} ${dayNum}${isPast ? ' (past)' : ''}`}
      >
        <div className={cn(
          'p-2 border-b border-border/40 sticky top-0 backdrop-blur-sm bg-card/80 z-10',
          isToday && 'bg-emerald-500/10',
          isPast && !isToday && 'bg-zinc-500/5',
        )}>
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-[10px] uppercase tracking-wide',
              isPast ? 'text-muted-foreground/50' : 'text-muted-foreground',
            )}>{weekday}</span>
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
            const isMultiDay = ev.endDate > dateISO
            const isFirstDayThisWeek = ev.startDate === dateISO || dateISO === dates[0]
            const showMultiDayHandle = isMultiDay && isFirstDayThisWeek
            return (
              <DroppableEventCard
                key={ev.id}
                event={ev}
                date={dateISO}
                assignments={evAssignments}
                selected={!!isSelected}
                onSelect={(eventId, date) => onSelect(eventId, date)}
                showMultiDayHandle={showMultiDayHandle && !tapAssignMode}
                tapAssignMode={tapAssignMode}
                highlightTapTarget={tapAssignMode && hasSelectedProfile}
              />
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Week navigator */}
      <div className="flex items-center justify-between p-3 border-b border-border/60 bg-card/40 gap-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">
              Week of {formatShortDate(weekStartISO)}
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              {formatShortDate(dates[0])} – {formatShortDate(dates[6])}
            </p>
          </div>
          <HelpTooltip text="DRAG instructors from the left roster onto event cards to assign them. Each card shows X/Y (assigned/needed). Use CSV to export to Excel, PDF to print. '↧ all days' assigns to all days of a multi-day event at once. Past dates are locked (read-only). On mobile: tap an instructor, then tap an event to assign." />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Export dropdown */}
          <div className="relative group">
            <button
              onClick={() => exportCSV(weekStartISO, events, assignments)}
              className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[32px] flex items-center gap-1.5"
              aria-label="Export schedule as CSV"
              title="Export as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
          <button
            onClick={onPrint}
            className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[32px] flex items-center gap-1.5"
            aria-label="Export schedule as PDF"
            title="Export as PDF (opens print dialog — choose Save as PDF)"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={onJumpToday}
            className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[32px]"
          >
            Today
          </button>
          <button
            onClick={onPrevWeek}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Previous week"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onNextWeek}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Next week"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop: 7-day week view */}
      <div className="hidden sm:flex flex-1 flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20" role="row">
          {WEEKDAYS.map(wd => (
            <div
              key={wd}
              className="p-2 text-center text-[10px] font-medium text-muted-foreground border-r border-border/40 last:border-r-0"
              role="columnheader"
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 overflow-hidden">
          {dates.map((dateISO, i) => renderDayColumn(dateISO, i, dates))}
        </div>
      </div>

      {/* Mobile: single-day view with day switcher */}
      <div className="flex sm:hidden flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20">
          <button
            onClick={() => setMobileDayIdx(i => Math.max(0, i - 1))}
            disabled={mobileDayIdx === 0}
            className="p-3 disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center flex-1">
            <div className="text-xs font-semibold">
              {formatPrettyDate(dates[mobileDayIdx])}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Day {mobileDayIdx + 1} of 7
            </div>
          </div>
          <button
            onClick={() => setMobileDayIdx(i => Math.min(6, i + 1))}
            disabled={mobileDayIdx === 6}
            className="p-3 disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Day pills for quick jump */}
        <div className="flex border-b border-border/40 overflow-x-auto">
          {dates.map((d, i) => {
            const isToday = d === todayISO
            const isActive = i === mobileDayIdx
            return (
              <button
                key={d}
                onClick={() => setMobileDayIdx(i)}
                className={cn(
                  'flex-1 min-w-[44px] py-2 text-center text-[10px] border-r border-border/40 last:border-r-0',
                  isActive ? 'bg-emerald-500/15 text-emerald-300 font-semibold' : 'text-muted-foreground',
                  isToday && 'border-b-2 border-b-emerald-400',
                )}
              >
                <div className="uppercase">{formatWeekday(d).slice(0, 2)}</div>
                <div className="text-sm font-semibold tabular-nums">{formatDayNum(d)}</div>
              </button>
            )
          })}
        </div>
        <div className="flex-1 overflow-hidden">
          {renderDayColumn(dates[mobileDayIdx], mobileDayIdx, dates)}
        </div>
      </div>
    </div>
  )
}
