'use client'

import {
  hostColor,
  formatTime,
  formatPrettyDate,
  SHIRT_COLORS,
  SHIRT_COLOR_SWATCH,
  EVENT_STATUS_COLOR,
  type EventView,
  type AssignmentView,
  type ProfileView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import {
  X, MapPin, Clock, Users, Calendar, GraduationCap, Tag, Trash2, Shield, Shirt, Star,
} from 'lucide-react'

type Props = {
  event: EventView | null
  date: string | null
  assignments: AssignmentView[]
  profiles: ProfileView[]
  onClose: () => void
  onRemove: (assignmentId: string) => void
  onUpdateAssignment: (assignmentId: string, patch: { isAlternative?: boolean; shirtColor?: string | null }) => void
}

export function EventDetailDrawer({
  event, date, assignments, profiles, onClose, onRemove, onUpdateAssignment,
}: Props) {
  if (!event || !date) return null
  const colors = hostColor(event.hostColor)
  const primaryAssignments = assignments.filter(a => !a.isAlternative)
  const altAssignments = assignments.filter(a => a.isAlternative)
  const filled = primaryAssignments.length
  const needed = event.requiredInstructors
  const isFull = filled >= needed

  return (
    <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-96 shadow-2xl border-l border-border/60 bg-card/95 backdrop-blur-md flex flex-col">
      <div className={cn('h-1', colors.bar)} />
      <div className="p-4 border-b border-border/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground">{event.code ?? 'No code'}</p>
          <h2 className="text-base font-semibold leading-tight">{event.name}</h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', colors.chip)}>
              {event.host}
            </span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', EVENT_STATUS_COLOR[event.status] ?? EVENT_STATUS_COLOR.Confirmed)}>
              {event.status}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" role="region" aria-label="Event details">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <DetailRow icon={<Calendar className="h-3 w-3" />} label="Date" value={formatPrettyDate(date)} />
            <DetailRow icon={<Clock className="h-3 w-3" />} label="Time" value={`${formatTime(event.startTime)} – ${formatTime(event.endTime)}`} />
            <DetailRow icon={<MapPin className="h-3 w-3" />} label="Location" value={event.location ?? 'TBD'} />
            <DetailRow icon={<Users className="h-3 w-3" />} label="Participants" value={event.participantCount?.toString() ?? 'TBD'} />
            <DetailRow icon={<GraduationCap className="h-3 w-3" />} label="Age range" value={event.ageRange ?? 'TBD'} />
            <DetailRow icon={<Tag className="h-3 w-3" />} label="Required" value={`${needed} instructors`} />
          </div>

          {event.description && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Description</h3>
              <p className="text-xs leading-relaxed">{event.description}</p>
            </div>
          )}

          {event.requiredSkills.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Skills <span className="normal-case text-muted-foreground/60">(informational — not enforced)</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {event.requiredSkills.map(s => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded bg-muted/60 text-foreground/80">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Primary ({filled}/{needed})
              </h3>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                isFull ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300',
              )}>
                {isFull ? 'Full' : `${needed - filled} more needed`}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mb-2 flex items-center gap-1">
              <Shirt className="h-2.5 w-2.5" />
              Shirt color is set per day per event — change it for each instructor below.
            </p>
            <div className="space-y-1.5">
              {primaryAssignments.length === 0 && altAssignments.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 border border-dashed border-border/60 rounded-md text-center">
                  No instructors assigned. Drag from the roster.
                </div>
              )}
              {primaryAssignments.map(a => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  event={event}
                  profile={profiles.find(p => p.id === a.profileId)}
                  onRemove={onRemove}
                  onUpdate={onUpdateAssignment}
                />
              ))}
            </div>
          </div>

          {altAssignments.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-amber-300 mb-2 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Alternatives ({altAssignments.length})
              </h3>
              <div className="space-y-1.5">
                {altAssignments.map(a => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    event={event}
                    profile={profiles.find(p => p.id === a.profileId)}
                    onRemove={onRemove}
                    onUpdate={onUpdateAssignment}
                  />
                ))}
              </div>
            </div>
          )}

          {event.notes && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Notes</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{event.notes}</p>
            </div>
          )}

          {/* Opt-ins section */}
          {event.optIns && (event.optIns.interested.length + event.optIns.available.length + event.optIns.unavailable.length > 0) && (
            <OptInsSection optIns={event.optIns} />
          )}
        </div>
      </div>
    </div>
  )
}

function OptInsSection({ optIns }: { optIns: NonNullable<EventView['optIns']> }) {
  const total = optIns.interested.length + optIns.available.length + optIns.unavailable.length
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
        <Star className="h-3 w-3" />
        Opt-ins ({total})
      </h3>
      <div className="space-y-2">
        {optIns.available.length > 0 && (
          <OptInGroup label="Available" color="emerald" entries={optIns.available} />
        )}
        {optIns.interested.length > 0 && (
          <OptInGroup label="Interested" color="teal" entries={optIns.interested} />
        )}
        {optIns.unavailable.length > 0 && (
          <OptInGroup label="Can't make it" color="rose" entries={optIns.unavailable} />
        )}
      </div>
    </div>
  )
}

function OptInGroup({ label, color, entries }: {
  label: string
  color: 'emerald' | 'teal' | 'rose'
  entries: { id: string; userName: string; userProfileName: string | null; note: string | null }[]
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    teal: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  }
  return (
    <div>
      <div className={cn('inline-block text-[10px] px-1.5 py-0.5 rounded border mb-1', colorClasses[color])}>
        {label} ({entries.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {entries.map(e => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/60 text-foreground/90"
            title={e.note ?? undefined}
          >
            {e.userProfileName ?? e.userName}
            {e.note && <span className="text-muted-foreground">· {e.note}</span>}
          </span>
        ))}
      </div>
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

function AssignmentRow({
  assignment, event, profile, onRemove, onUpdate,
}: {
  assignment: AssignmentView
  event: EventView
  profile?: ProfileView
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: { isAlternative?: boolean; shirtColor?: string | null }) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md border',
        assignment.isAlternative
          ? 'bg-amber-500/5 border-amber-500/30 border-dashed'
          : 'bg-muted/40 border-border/40',
      )}
    >
      <div className="h-7 w-7 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
        {assignment.profileName.split(' ').map(n => n[0]).slice(0, 2).join('')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{assignment.profileName}</p>
        <p className="text-[10px] text-muted-foreground">{assignment.profileRoleTier}</p>
      </div>

      {/* Shirt color picker */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Shirt className="h-3 w-3 text-muted-foreground" />
        <select
          value={assignment.shirtColor ?? ''}
          onChange={e => onUpdate(assignment.id, { shirtColor: e.target.value || null })}
          className="text-[10px] bg-transparent border-0 focus:outline-none cursor-pointer hover:text-foreground text-muted-foreground"
          title="Shirt color for this day"
        >
          <option value="">—</option>
          {SHIRT_COLORS.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {assignment.shirtColor && SHIRT_COLOR_SWATCH[assignment.shirtColor] && (
          <span className={cn('h-3 w-3 rounded-full', SHIRT_COLOR_SWATCH[assignment.shirtColor])} />
        )}
      </div>

      {/* Alt toggle */}
      <button
        onClick={() => onUpdate(assignment.id, { isAlternative: !assignment.isAlternative })}
        className={cn(
          'shrink-0 p-1 rounded',
          assignment.isAlternative
            ? 'text-amber-300 bg-amber-500/10'
            : 'text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10',
        )}
        title={assignment.isAlternative ? 'Make primary' : 'Make alternative'}
      >
        <Shield className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={() => onRemove(assignment.id)}
        className="shrink-0 p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
        title="Remove from event"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
