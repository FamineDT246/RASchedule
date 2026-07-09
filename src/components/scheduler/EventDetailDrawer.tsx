'use client'

import {
  hostColor,
  formatTime,
  formatPrettyDate,
  type EventView,
  type AssignmentView,
  type ProfileView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import {
  X, MapPin, Clock, Users, Calendar, GraduationCap, Tag, Trash2,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

type Props = {
  event: EventView | null
  date: string | null
  assignments: AssignmentView[]
  profiles: ProfileView[]
  onClose: () => void
  onRemove: (assignmentId: string) => void
}

export function EventDetailDrawer({ event, date, assignments, profiles, onClose, onRemove }: Props) {
  if (!event || !date) return null
  const colors = hostColor(event.hostColor)
  const filled = assignments.length
  const needed = event.requiredInstructors
  const isFull = filled >= needed

  return (
    <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-96 shadow-2xl border-l border-border/60 bg-card/95 backdrop-blur-md flex flex-col">
      <div className={cn('h-1', colors.bar)} />
      <div className="p-4 border-b border-border/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground">{event.code ?? 'No code'}</p>
          <h2 className="text-base font-semibold leading-tight">{event.name}</h2>
          <span className={cn('inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border', colors.chip)}>
            {event.host}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <DetailRow icon={<Calendar className="h-3 w-3" />} label="Date" value={formatPrettyDate(date)} />
            <DetailRow icon={<Clock className="h-3 w-3" />} label="Time" value={`${formatTime(event.startTime)} – ${formatTime(event.endTime)}`} />
            <DetailRow icon={<MapPin className="h-3 w-3" />} label="Location" value={event.location ?? 'TBD'} />
            <DetailRow icon={<Users className="h-3 w-3" />} label="Participants" value={event.participantCount?.toString() ?? 'TBD'} />
            <DetailRow icon={<GraduationCap className="h-3 w-3" />} label="Age range" value={event.ageRange ?? 'TBD'} />
            <DetailRow icon={<Tag className="h-3 w-3" />} label="Status" value={event.status} />
          </div>

          {event.description && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Description</h3>
              <p className="text-xs leading-relaxed">{event.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Required skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {event.requiredSkills.length === 0 && (
                <span className="text-xs text-muted-foreground">None specified</span>
              )}
              {event.requiredSkills.map(s => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Assigned ({filled}/{needed})
              </h3>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                isFull ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300',
              )}>
                {isFull ? 'Full' : `${needed - filled} more needed`}
              </span>
            </div>
            <div className="space-y-1.5">
              {assignments.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 border border-dashed border-border/60 rounded-md text-center">
                  No instructors assigned. Drag from the roster.
                </div>
              )}
              {assignments.map(a => {
                const profile = profiles.find(p => p.id === a.profileId)
                const missingSkills = profile
                  ? event.requiredSkills.filter(s => !profile.skillsList.includes(s))
                  : []
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border/40"
                  >
                    <div className="h-7 w-7 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                      {a.profileName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{a.profileName}</p>
                      <p className="text-[10px] text-muted-foreground">{a.profileRoleTier}</p>
                      {missingSkills.length > 0 && (
                        <p className="text-[10px] text-amber-300 mt-0.5">
                          Missing: {missingSkills.join(', ')}
                          {a.overrideFlag && ' (overridden)'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(a.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground shrink-0"
                      title="Remove from event"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {event.notes && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Notes</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{event.notes}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2 rounded-md bg-muted/30 border border-border/40">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-xs font-medium truncate">{value}</p>
    </div>
  )
}
