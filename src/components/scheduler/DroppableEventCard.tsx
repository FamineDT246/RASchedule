'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  hostColor,
  formatTime,
  type EventView,
  type AssignmentView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import { MapPin, Users, Clock, AlertTriangle } from 'lucide-react'

type Props = {
  event: EventView
  date: string
  assignments: AssignmentView[]
  selected: boolean
  onSelect: (eventId: string, date: string) => void
}

export function DroppableEventCard({ event, date, assignments, selected, onSelect }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${event.id}-${date}`,
    data: { type: 'event-drop', eventId: event.id, date },
  })

  const filled = assignments.length
  const needed = event.requiredInstructors
  const isFull = filled >= needed
  const under = filled < needed
  const colors = hostColor(event.hostColor)

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(event.id, date)}
      className={cn(
        'relative rounded-lg border bg-card/95 backdrop-blur-sm transition-all cursor-pointer',
        'hover:shadow-md hover:border-foreground/30',
        selected && 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-background',
        isOver && 'ring-2 ring-emerald-400 scale-[1.02]',
        isFull ? 'border-emerald-500/40' : under ? 'border-amber-500/30' : 'border-border/60',
      )}
    >
      {/* Host color bar across the top */}
      <div className={cn('h-1 rounded-t-lg', colors.bar)} />

      <div className="p-2.5 space-y-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight truncate">{event.name}</p>
            <span className={cn('inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded border', colors.chip)}>
              {event.host}
            </span>
          </div>
          <div
            className={cn(
              'shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums',
              isFull
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-amber-500/15 text-amber-300',
            )}
            title={`${filled}/${needed} instructors assigned`}
          >
            <Users className="h-2.5 w-2.5" />
            {filled}/{needed}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatTime(event.startTime)}
          </span>
          {event.location && (
            <span className="flex items-center gap-0.5 truncate" title={event.location}>
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>

        {event.status !== 'Confirmed' && (
          <div className="flex items-center gap-1 text-[10px] text-amber-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            {event.status}
          </div>
        )}

        {assignments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assignments.map(a => (
              <span
                key={a.id}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted/80 text-foreground/90 max-w-[110px]"
                title={`${a.profileName} — ${a.profileRoleTier}`}
              >
                <span className="truncate">{a.profileName.split(' ')[0]}</span>
                {a.overrideFlag && <AlertTriangle className="h-2 w-2 text-amber-400 shrink-0" />}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
