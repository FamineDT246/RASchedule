'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  hostColor,
  formatTime,
  SHIRT_COLOR_SWATCH,
  type EventView,
  type AssignmentView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import { MapPin, Users, Clock, AlertTriangle, Shield } from 'lucide-react'

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

  const primaryCount = assignments.filter(a => !a.isAlternative).length
  const altCount = assignments.length - primaryCount
  const filled = primaryCount // only primaries count toward fill
  const needed = event.requiredInstructors
  const isFull = filled >= needed
  const isCancelled = event.status === 'Cancelled'
  const isTentative = event.status === 'Tentative'
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
        isCancelled
          ? 'border-rose-500/40 opacity-60'
          : isFull
            ? 'border-emerald-500/40'
            : 'border-amber-500/30',
      )}
    >
      <div className={cn('h-1 rounded-t-lg', isCancelled ? 'bg-rose-500' : colors.bar)} />

      <div className="p-2.5 space-y-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <p className={cn('text-xs font-semibold leading-tight truncate', isCancelled && 'line-through')}>
              {event.name}
            </p>
            <span className={cn('inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded border', colors.chip)}>
              {event.host}
            </span>
          </div>
          <div
            className={cn(
              'shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums',
              isFull ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300',
            )}
            title={`${filled}/${needed} primary instructors${altCount ? ` + ${altCount} alternative${altCount > 1 ? 's' : ''}` : ''}`}
          >
            <Users className="h-2.5 w-2.5" />
            {filled}/{needed}
            {altCount > 0 && <span className="text-amber-400">+{altCount}</span>}
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

        {isTentative && (
          <div className="flex items-center gap-1 text-[10px] text-amber-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            Tentative — dates not finalized
          </div>
        )}

        {assignments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assignments.map(a => (
              <span
                key={a.id}
                className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] max-w-[120px]',
                  a.isAlternative
                    ? 'bg-amber-500/10 text-amber-300 border border-dashed border-amber-500/40'
                    : 'bg-muted/80 text-foreground/90',
                )}
                title={
                  a.isAlternative
                    ? `${a.profileName} (Alternative)`
                    : a.profileName
                }
              >
                {a.isAlternative && <Shield className="h-2 w-2 shrink-0" />}
                <span className="truncate">{a.profileName.split(' ')[0]}</span>
                {a.shirtColor && SHIRT_COLOR_SWATCH[a.shirtColor] && (
                  <span
                    className={cn('h-2 w-2 rounded-full shrink-0', SHIRT_COLOR_SWATCH[a.shirtColor])}
                    title={`Shirt: ${a.shirtColor}`}
                  />
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
