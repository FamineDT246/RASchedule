'use client'

import {
  hostColor,
  formatTime,
  formatPrettyDate,
  formatShortDate,
  eventOnDate,
  todayInBarbados,
  addDaysISO,
  SHIRT_COLOR_SWATCH,
  type EventView,
  type AssignmentView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'

type Props = {
  weekStartISO: string
  events: EventView[]
  assignments: AssignmentView[]
}

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function weekDates(weekStartISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i))
}

export function PrintLayout({ weekStartISO, events, assignments }: Props) {
  const dates = weekDates(weekStartISO)
  const todayISO = todayInBarbados()

  // Build per-day event+assignment data
  const dayData = dates.map(dateISO => {
    const dayEvents = events
      .filter(e => eventOnDate(e, dateISO))
      .map(ev => {
        const evAssignments = assignments.filter(a => a.eventId === ev.id && a.date === dateISO)
        const primaries = evAssignments.filter(a => !a.isAlternative)
        const alts = evAssignments.filter(a => a.isAlternative)
        return { event: ev, primaries, alts }
      })
    return { dateISO, dayEvents }
  })

  return (
    <div className="print-layout p-8 bg-white text-black min-h-screen" id="print-root">
      {/* Header */}
      <div className="mb-6 pb-4 border-b-2 border-black">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">RA Syncbot — Weekly Schedule</h1>
            <p className="text-sm text-gray-600 mt-1">
              Week of {formatShortDate(dates[0])} – {formatShortDate(dates[6])}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p>Barbados time (AST)</p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-4 gap-3 text-xs">
        {(() => {
          let totalSlots = 0, filledSlots = 0, eventsCount = 0
          for (const { dayEvents } of dayData) {
            for (const { event, primaries } of dayEvents) {
              totalSlots += event.requiredInstructors
              filledSlots += Math.min(primaries.length, event.requiredInstructors)
              eventsCount++
            }
          }
          return (
            <>
              <StatBox label="Events this week" value={eventsCount} />
              <StatBox label="Instructor slots" value={totalSlots} />
              <StatBox label="Filled" value={filledSlots} />
              <StatBox label="Unfilled" value={totalSlots - filledSlots} highlight={totalSlots - filledSlots > 0} />
            </>
          )
        })()}
      </div>

      {/* Day-by-day schedule */}
      <div className="space-y-4">
        {dayData.map(({ dateISO, dayEvents }, idx) => {
          const isToday = dateISO === todayISO
          return (
            <div key={dateISO} className={cn('break-inside-avoid', isToday && 'border-l-4 border-emerald-500 pl-3')}>
              <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-gray-300">
                <h2 className="text-base font-bold">
                  {WEEKDAY_LABELS[idx]}
                </h2>
                <span className="text-sm text-gray-600">
                  {formatPrettyDate(dateISO)}
                </span>
                {dayEvents.length === 0 && (
                  <span className="text-xs text-gray-400 ml-auto">No events</span>
                )}
              </div>

              {dayEvents.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-2">— No events scheduled —</div>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map(({ event, primaries, alts }) => {
                    const colors = hostColor(event.hostColor)
                    const filled = primaries.length
                    const needed = event.requiredInstructors
                    const isFull = filled >= needed
                    return (
                      <div key={event.id} className="border border-gray-300 rounded p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn('inline-block h-3 w-3 rounded-sm', colors.bar)} />
                              <h3 className="text-sm font-bold">{event.name}</h3>
                              {event.code && <span className="text-[10px] text-gray-500">({event.code})</span>}
                            </div>
                            <div className="text-[11px] text-gray-600 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span><strong>Host:</strong> {event.host}</span>
                              <span><strong>Time:</strong> {formatTime(event.startTime)} – {formatTime(event.endTime)}</span>
                              {event.location && <span><strong>Location:</strong> {event.location}</span>}
                            </div>
                          </div>
                          <div className={cn(
                            'text-xs font-bold px-2 py-1 rounded border',
                            isFull
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                              : 'bg-amber-100 border-amber-400 text-amber-800',
                          )}>
                            {filled}/{needed}
                          </div>
                        </div>

                        {/* Assigned instructors */}
                        <table className="w-full text-[11px] border-collapse">
                          <thead>
                            <tr className="border-b border-gray-300 text-left">
                              <th className="py-1 pr-2 w-8">#</th>
                              <th className="py-1 pr-2">Instructor</th>
                              <th className="py-1 pr-2 w-20">Role</th>
                              <th className="py-1 pr-2 w-20">Shirt</th>
                              <th className="py-1 w-16">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {primaries.map((a, i) => (
                              <AssignmentPrintRow key={a.id} idx={i + 1} assignment={a} />
                            ))}
                            {alts.map((a, i) => (
                              <AssignmentPrintRow key={a.id} idx={primaries.length + i + 1} assignment={a} isAlt />
                            ))}
                            {/* Empty rows for unfilled slots */}
                            {Array.from({ length: Math.max(0, needed - filled) }).map((_, i) => (
                              <tr key={`empty-${i}`} className="border-b border-gray-200 text-gray-400 italic">
                                <td className="py-1 pr-2">{filled + i + 1}</td>
                                <td className="py-1 pr-2 col-span-4" colSpan={4}>— Unfilled —</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {event.notes && (
                          <div className="text-[10px] text-gray-500 mt-1.5 italic">
                            Note: {event.notes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-[10px] text-gray-500 text-center">
        RA Syncbot Camp Scheduler · {formatShortDate(dates[0])} – {formatShortDate(dates[6])}
      </div>
    </div>
  )
}

function AssignmentPrintRow({ idx, assignment, isAlt }: {
  idx: number
  assignment: AssignmentView
  isAlt?: boolean
}) {
  return (
    <tr className={cn('border-b border-gray-200', isAlt && 'text-gray-500 italic')}>
      <td className="py-1 pr-2">{idx}</td>
      <td className="py-1 pr-2 font-medium">{assignment.profileName}</td>
      <td className="py-1 pr-2 text-gray-600">{assignment.profileRoleTier}</td>
      <td className="py-1 pr-2">
        {assignment.shirtColor ? (
          <span className="inline-flex items-center gap-1">
            <span
              className={cn(
                'inline-block h-3 w-3 rounded-full border border-gray-400',
                SHIRT_COLOR_SWATCH[assignment.shirtColor] ?? 'bg-gray-300',
              )}
            />
            {assignment.shirtColor}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="py-1 text-gray-600">{isAlt ? 'Alt' : 'Primary'}</td>
    </tr>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      'border rounded p-2 text-center',
      highlight ? 'border-amber-400 bg-amber-50' : 'border-gray-300',
    )}>
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className={cn('text-lg font-bold', highlight && 'text-amber-700')}>{value}</div>
    </div>
  )
}
