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
import { MapPin, Clock, Users, AlertTriangle, Shield, Star } from 'lucide-react'

type Props = {
  event: EventView
  date: string
  assignments: AssignmentView[]
  selected: boolean
  onSelect: (eventId: string, date: string) => void
  /** When true, this card renders as a "drop on all days" target (used on the first
   *  day a multi-day event appears in the current week). */
  showMultiDayHandle?: boolean
  // Mobile tap-to-assign: when true, card is not droppable (tap only)
  tapAssignMode?: boolean
  // When true + tapAssignMode, highlight this card as a valid tap target
  highlightTapTarget?: boolean
}

export function DroppableEventCard({
  event, date, assignments, selected, onSelect, showMultiDayHandle,
  tapAssignMode, highlightTapTarget,
}: Props) {
  // Per-day drop target (disabled in tap mode)
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${event.id}-${date}`,
    data: { type: 'event-drop', eventId: event.id, date },
    disabled: tapAssignMode,
  })

  const primaryCount = assignments.filter(a => !a.isAlternative).length
  const altCount = assignments.length - primaryCount
  const filled = primaryCount
  const needed = event.requiredInstructors
  const isFull = filled >= needed
  const isCancelled = event.status === 'Cancelled'
  const isTentative = event.status === 'Tentative'
  const colors = hostColor(event.hostColor)

  // Opt-in counts
  const optIns = event.optIns
  const optInTotal = (optIns?.interested.length ?? 0) + (optIns?.available.length ?? 0)

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(event.id, date)}
      className={cn(
        'relative rounded-lg border bg-card/95 backdrop-blur-sm transition-all cursor-pointer',
        'hover:shadow-md hover:border-foreground/30',
        selected && 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-background',
        isOver && 'ring-2 ring-emerald-400 scale-[1.02]',
        highlightTapTarget && 'ring-2 ring-emerald-400/60 animate-pulse',
        isCancelled
          ? 'border-rose-500/40 opacity-60'
          : isFull
            ? 'border-emerald-500/40'
            : 'border-amber-500/30',
      )}
      role="button"
      tabIndex={0}
      aria-label={`${event.name} on ${date}, ${filled} of ${needed} instructors assigned${altCount ? `, ${altCount} alternatives` : ''}${optInTotal ? `, ${optInTotal} opt-ins` : ''}${highlightTapTarget ? '. Tap to assign selected instructor' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(event.id, date)
        }
      }}
    >
      <div className={cn('h-1 rounded-t-lg', isCancelled ? 'bg-rose-500' : colors.bar)} />

      <div className="p-2.5 space-y-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
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
                title={a.isAlternative ? `${a.profileName} (Alternative)` : a.profileName}
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

        {/* Opt-in indicator + multi-day drop handle */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
          {optInTotal > 0 ? (
            <span
              className="flex items-center gap-0.5 text-[9px] text-emerald-300"
              title={`${optIns?.interested.length ?? 0} interested, ${optIns?.available.length ?? 0} available`}
            >
              <Star className="h-2.5 w-2.5" />
              {optInTotal} opt-in{optInTotal > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground/50">No opt-ins yet</span>
          )}
          {showMultiDayHandle && <MultiDayHandle eventId={event.id} />}
        </div>
      </div>
    </div>
  )
}

// Separate component to satisfy the lint rule about not accessing refs during render.
function MultiDayHandle({ eventId }: { eventId: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-multi-${eventId}`,
    data: { type: 'event-drop-all', eventId },
  })
  return (
    <button
      ref={setNodeRef as any}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'text-[9px] px-1.5 py-0.5 rounded border transition-colors',
        isOver
          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
          : 'border-border/60 text-muted-foreground hover:bg-muted/40',
      )}
      title="Drag an instructor here to assign them to ALL days of this event"
      aria-label="Drop zone: assign to all days of this event"
    >
      ↧ all days
    </button>
  )
}
