'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  hostColor, formatTime, formatPrettyDate, formatShortDate,
  EVENT_STATUS_COLOR, type EventView, type AssignmentView, type AuthUser,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import {
  Calendar, Clock, MapPin, Users, Check, X, Star, AlertCircle, Shield, Shirt,
  Plus, X as XIcon, CalendarDays,
} from 'lucide-react'
import { Accordion } from './Accordion'
import { CalendarView } from './CalendarView'
import { EquipmentSection } from './EquipmentSection'

type OptInMap = Record<string, { status: string; note: string | null }>

async function fetchSchedule() {
  const r = await fetch('/api/schedule?from=2026-06-01&to=2026-09-30')
  if (!r.ok) throw new Error('Failed to load schedule')
  return r.json()
}

async function fetchMyOptIns(): Promise<OptInMap> {
  const r = await fetch('/api/opt-ins')
  if (!r.ok) throw new Error('Failed to load opt-ins')
  const list = await r.json()
  const map: OptInMap = {}
  for (const o of list) {
    map[o.eventId] = { status: o.status, note: o.note }
  }
  return map
}

async function fetchMyProfile() {
  const profileId = 'me' // The API will use the cookie to find the user's profile
  const r = await fetch('/api/profiles/me')
  if (!r.ok) return null
  return r.json()
}

export function InstructorView({ user }: { user: AuthUser }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['schedule'], queryFn: fetchSchedule })
  const { data: optIns } = useQuery({ queryKey: ['my-opt-ins'], queryFn: fetchMyOptIns })
  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: fetchMyProfile })
  const [viewMode, setViewMode] = useState<'assignments' | 'events' | 'calendar'>('assignments')
  const [selectedEvent, setSelectedEvent] = useState<EventView | null>(null)

  // Close event drawer with Esc
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEvent) setSelectedEvent(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [selectedEvent])

  const optInMutation = useMutation({
    mutationFn: async (args: { eventId: string; status: string }) => {
      const r = await fetch('/api/opt-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-opt-ins'] })
      toast.success('Preference saved')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save preference'),
  })

  const ackMutation = useMutation({
    mutationFn: async (args: { id: string; ackStatus: 'confirmed' | 'declined' }) => {
      const r = await fetch(`/api/assignments?id=${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ackStatus: args.ackStatus }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success(vars.ackStatus === 'confirmed' ? 'Assignment confirmed' : 'Assignment declined — the boss has been notified')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to acknowledge'),
  })

  // My assignments = assignments where profileId matches the linked profile
  const myProfileId = user.profile?.id
  const myAssignments = useMemo(() => {
    if (!data || !myProfileId) return []
    return (data.assignments as AssignmentView[])
      .filter(a => a.profileId === myProfileId)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data, myProfileId])

  // Available events to opt in to (Confirmed + Tentative, exclude Draft/Cancelled)
  const optableEvents = useMemo(() => {
    if (!data) return []
    return (data.events as EventView[])
      .filter(e => e.status === 'Confirmed' || e.status === 'Tentative')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [data])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Tab navigation */}
      <nav
        className="border-b border-border/60 bg-card/30 flex items-center gap-1 px-2 sm:px-3 overflow-x-auto"
        role="tablist"
        aria-label="Instructor views"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <button
          role="tab"
          aria-selected={viewMode === 'assignments'}
          onClick={() => setViewMode('assignments')}
          className={cn(
            'px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center shrink-0',
            viewMode === 'assignments'
              ? 'border-emerald-400 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Calendar className="h-4 w-4 mr-1.5 inline" />
          My Assignments
          {myAssignments.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">({myAssignments.length})</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'events'}
          onClick={() => setViewMode('events')}
          className={cn(
            'px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center shrink-0',
            viewMode === 'events'
              ? 'border-emerald-400 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Star className="h-4 w-4 mr-1.5 inline" />
          Opt In
          {optableEvents.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">({optableEvents.length})</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'calendar'}
          onClick={() => setViewMode('calendar')}
          className={cn(
            'px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center shrink-0',
            viewMode === 'calendar'
              ? 'border-emerald-400 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <CalendarDays className="h-4 w-4 mr-1.5 inline" />
          Calendar
        </button>
      </nav>

      {viewMode === 'calendar' && data ? (
        <CalendarView
          events={data.events}
          assignments={data.assignments}
          myProfileId={user.profile?.id}
          readOnly
          onSelect={(eventId, date) => {
            const ev = data.events.find(e => e.id === eventId)
            if (ev) setSelectedEvent(ev)
          }}
        />
      ) : viewMode === 'assignments' ? (
        <div className="flex-1 overflow-y-auto" role="region" aria-label="My assignments">
          <div className="p-3 sm:p-4 space-y-4">
            <Accordion
              label={`My Assignments (${myAssignments.length})`}
              labelClassName="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              defaultOpen
            >
              {myAssignments.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  {user.profile
                    ? 'No assignments yet. Go to the Opt In tab to express interest in events.'
                    : 'No staff profile linked. Ask the boss to link your account.'}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {myAssignments.map(a => {
                    const ev = data?.events.find((e: EventView) => e.id === a.eventId)
                    if (!ev) return null
                    const colors = hostColor(ev.hostColor)
                    const acked = a.ackStatus === 'confirmed'
                    const declined = a.ackStatus === 'declined'
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded-lg border p-3 flex items-center gap-3 transition-all',
                          a.isAlternative
                            ? 'border-amber-500/30 border-dashed bg-amber-500/5'
                            : 'border-border/60 bg-card/80',
                          acked && 'border-emerald-500/40 bg-emerald-500/5',
                          declined && 'border-rose-500/40 bg-rose-500/5',
                        )}
                      >
                        <button
                          onClick={() => setSelectedEvent(ev)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          aria-label={`View details for ${ev.name}`}
                        >
                          <div className={cn('h-8 w-1 rounded-full shrink-0', colors.bar)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{ev.name}</p>
                              {a.isAlternative && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-0.5 shrink-0">
                                  <Shield className="h-3 w-3" /> Alt
                                </span>
                              )}
                              {acked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 flex items-center gap-0.5 shrink-0">
                                  <Check className="h-2.5 w-2.5" /> Confirmed
                                </span>
                              )}
                              {declined && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 flex items-center gap-0.5 shrink-0">
                                  <X className="h-2.5 w-2.5" /> Declined
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <Calendar className="h-3 w-3" />
                                {formatPrettyDate(a.date)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {formatTime(ev.startTime)}
                              </span>
                              {a.shirtColor && (
                                <span className="flex items-center gap-0.5">
                                  <Shirt className="h-3 w-3" />
                                  {a.shirtColor}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        {/* Acknowledge buttons (hidden if already acked) */}
                        {!acked && !declined && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); ackMutation.mutate({ id: a.id, ackStatus: 'confirmed' }) }}
                              disabled={ackMutation.isPending}
                              className="p-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 min-h-[36px] min-w-[36px] flex items-center justify-center"
                              aria-label="Confirm assignment — I'll be there"
                              title="Confirm — I'll be there"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); ackMutation.mutate({ id: a.id, ackStatus: 'declined' }) }}
                              disabled={ackMutation.isPending}
                              className="p-2 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 min-h-[36px] min-w-[36px] flex items-center justify-center"
                              aria-label="Decline assignment — I can't make it"
                              title="Decline — I can't make it"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Accordion>

            {/* Availability section */}
            {user.profile && (
              <AvailabilitySection
                profileId={user.profile.id}
                initialUnavailable={myProfile?.unavailableList ?? user.profile.unavailable?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? []}
              />
            )}
          </div>
        </div>
      ) : viewMode === 'events' ? (
        <div className="flex-1 overflow-y-auto" role="region" aria-label="Events to opt in to">
          <div className="p-3 sm:p-4">
            {optableEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">
                No events available for opt-in right now.
              </div>
            ) : (
              <CarouselGroup
                items={optableEvents.map(ev => {
                  const colors = hostColor(ev.hostColor)
                  const optIn = optIns?.[ev.id]
                  const isAssigned = myAssignments.some(a => a.eventId === ev.id)
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="rounded-lg border border-border/60 bg-card/80 p-3 cursor-pointer hover:border-foreground/30 transition-all flex flex-col gap-2 h-full"
                    >
                      <div className={cn('h-1 rounded-full', colors.bar)} />
                      <div className="flex items-start gap-2">
                        <div className={cn('h-8 w-1 rounded-full shrink-0', colors.bar)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{ev.name}</p>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {formatShortDate(ev.startDate)}{ev.endDate !== ev.startDate && ` – ${formatShortDate(ev.endDate)}`}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {formatTime(ev.startTime)}
                            </span>
                          </div>
                          {ev.location && (
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5 truncate">
                              <MapPin className="h-3 w-3" />
                              {ev.location}
                            </div>
                          )}
                        </div>
                      </div>
                      {isAssigned ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
                          <Check className="h-3.5 w-3.5" />
                          You&apos;re assigned to this event
                        </div>
                      ) : (
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          <OptInButton
                            active={optIn?.status === 'interested'}
                            color="active:bg-teal-500/20 bg-teal-500/10 text-teal-300 border-teal-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'interested' }) }}
                            icon={<Star className="h-3.5 w-3.5" />}
                            label="Interested"
                          />
                          <OptInButton
                            active={optIn?.status === 'available'}
                            color="active:bg-emerald-500/20 bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'available' }) }}
                            icon={<Check className="h-3.5 w-3.5" />}
                            label="Available"
                          />
                          <OptInButton
                            active={optIn?.status === 'unavailable'}
                            color="active:bg-rose-500/20 bg-rose-500/10 text-rose-300 border-rose-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'unavailable' }) }}
                            icon={<X className="h-3.5 w-3.5" />}
                            label="Can&apos;t"
                          />
                        </div>
                      )}
                      <p className="text-[9px] text-muted-foreground/50 text-center">Tap for details</p>
                    </div>
                  )
                })}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Event details drawer */}
      {selectedEvent && (
        <InstructorEventDrawer
          event={selectedEvent}
          optIn={optIns?.[selectedEvent.id]}
          isAssigned={myAssignments.some(a => a.eventId === selectedEvent.id)}
          onOptIn={(status) => optInMutation.mutate({ eventId: selectedEvent.id, status })}
          onClose={() => setSelectedEvent(null)}
          myProfileId={user.profile?.id}
        />
      )}
    </div>
  )
}

// ---------- Carousel (5 items per group, horizontal scroll on each group) ----------

function CarouselGroup({ items, itemsPerGroup = 5 }: { items: React.ReactNode[]; itemsPerGroup?: number }) {
  // Split items into groups of itemsPerGroup; each group is a horizontal scroll row
  const groups: React.ReactNode[][] = []
  for (let i = 0; i < items.length; i += itemsPerGroup) {
    groups.push(items.slice(i, i + itemsPerGroup))
  }
  if (groups.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border/60 rounded-md">
        No items to display.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => (
        <div
          key={gi}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
        >
          {group.map((item, ii) => (
            <div key={ii} className="min-w-[280px] sm:min-w-[320px] snap-start shrink-0">
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------- Event details drawer (instructor view) ----------

function InstructorEventDrawer({ event, optIn, isAssigned, onOptIn, onClose, myProfileId }: {
  event: EventView
  optIn?: { status: string; note: string | null }
  isAssigned: boolean
  onOptIn: (status: 'interested' | 'available' | 'unavailable') => void
  onClose: () => void
  myProfileId?: string | null
}) {
  const colors = hostColor(event.hostColor)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={event.name}
    >
      <div
        className="bg-card border border-border/60 rounded-t-lg sm:rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className={cn('h-1 rounded-t-lg', colors.bar)} />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
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
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-md bg-muted/30 border border-border/40">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Calendar className="h-3 w-3" />
                Dates
              </div>
              <p className="text-xs font-medium">
                {formatShortDate(event.startDate)}{event.endDate !== event.startDate && ` – ${formatShortDate(event.endDate)}`}
              </p>
            </div>
            <div className="p-2 rounded-md bg-muted/30 border border-border/40">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Clock className="h-3 w-3" />
                Time
              </div>
              <p className="text-xs font-medium">{formatTime(event.startTime)} – {formatTime(event.endTime)}</p>
            </div>
            {event.location && (
              <div className="p-2 rounded-md bg-muted/30 border border-border/40">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                  <MapPin className="h-3 w-3" />
                  Location
                </div>
                <p className="text-xs font-medium truncate">{event.location}</p>
              </div>
            )}
            <div className="p-2 rounded-md bg-muted/30 border border-border/40">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Users className="h-3 w-3" />
                Instructors
              </div>
              <p className="text-xs font-medium">{event.requiredInstructors} needed</p>
            </div>
          </div>

          {event.description && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Description</h3>
              <p className="text-xs leading-relaxed">{event.description}</p>
            </div>
          )}

          {event.requiredSkills.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {event.requiredSkills.map(s => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded bg-muted/60 text-foreground/80">
                    {s}
                  </span>
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

          {/* Equipment coordination (instructor view — only if assigned) */}
          {isAssigned && (
            <EquipmentSection event={event} mode="instructor" myProfileId={myProfileId} />
          )}

          {/* Opt-in section */}
          <div className="pt-2 border-t border-border/40">
            {isAssigned ? (
              <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
                <Check className="h-4 w-4" />
                You&apos;re assigned to this event
              </div>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  Your preference {optIn && `(currently: ${optIn.status})`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onOptIn('interested')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors min-h-[40px]',
                      optIn?.status === 'interested'
                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                    )}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Interested
                  </button>
                  <button
                    onClick={() => onOptIn('available')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors min-h-[40px]',
                      optIn?.status === 'available'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Available
                  </button>
                  <button
                    onClick={() => onOptIn('unavailable')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors min-h-[40px]',
                      optIn?.status === 'unavailable'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                    Can&apos;t
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Availability section ----------

function AvailabilitySection({ profileId, initialUnavailable }: {
  profileId: string
  initialUnavailable: string[]
}) {
  const qc = useQueryClient()
  const [unavailable, setUnavailable] = useState<string[]>(initialUnavailable)
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)

  const addDate = () => {
    if (!newDate) return
    if (unavailable.includes(newDate)) {
      toast.error('That date is already in your unavailable list')
      return
    }
    setUnavailable([...unavailable, newDate].sort())
    setNewDate('')
  }

  const removeDate = (date: string) => {
    setUnavailable(unavailable.filter(d => d !== date))
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/profiles?id=${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unavailable }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to save')
      toast.success('Availability updated')
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = JSON.stringify(unavailable.sort()) !== JSON.stringify(initialUnavailable.sort())

  return (
    <section aria-label="My availability">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          My Availability
        </h3>
        {hasChanges && (
          <button
            onClick={save}
            disabled={saving}
            className="px-2.5 py-1 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[28px]"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>
      <div className="rounded-lg border border-border/60 bg-card/80 p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Add dates you can&apos;t work. The boss will see these when assigning you to events, and the scheduler will block assignments on these dates.
        </p>

        {/* Add date */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={addDate}
            disabled={!newDate}
            className="px-2.5 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground disabled:opacity-50 flex items-center gap-1 min-h-[36px]"
          >
            <Plus className="h-3 w-3" />
            Add date
          </button>
        </div>

        {/* Unavailable dates list */}
        {unavailable.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-2">
            No unavailable dates set — you&apos;re available every day.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {unavailable.map(date => (
              <span
                key={date}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]"
              >
                <Calendar className="h-2.5 w-2.5" />
                {formatPrettyDate(date)}
                <button
                  onClick={() => removeDate(date)}
                  className="ml-1 hover:text-rose-100"
                  aria-label={`Remove ${date}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function OptInButton({ active, color, onClick, icon, label }: {
  active: boolean
  color: string
  onClick: (e: React.MouseEvent) => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-md border transition-colors min-h-[32px]',
        active
          ? color
          : 'border-border/60 text-muted-foreground hover:bg-muted/40',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ---------- Claim form (shown when visiting with a token but not yet claimed) ----------

export function ClaimInviteForm({ token, onClaimed }: { token: string; onClaimed: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [step, setStep] = useState<'details' | 'verify'>('details')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!email) {
      toast.error('Email is required')
      return
    }
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      if (step === 'details') {
        // Step 1: send verification code
        const r = await fetch('/api/auth/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, name, email, password }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Failed')
        if (j.step === 'verify') {
          setStep('verify')
          toast.success('Verification code sent to your email')
        } else {
          // No verification needed (dev mode) — account claimed
          toast.success('Account claimed')
          onClaimed()
        }
      } else {
        // Step 2: verify code + claim
        const r = await fetch('/api/auth/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, name, email, password, verifyCode }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Failed to claim')
        toast.success('Account verified!')
        onClaimed()
      }
    } catch (e: any) {
      toast.error(e.message || 'Claim failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="RA Syncbot" className="h-16 w-16 mx-auto mb-3 rounded-xl object-cover" />
          <h1 className="text-lg font-semibold">You&apos;re invited!</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {step === 'details'
              ? 'Claim your account to view the camp schedule and opt in to events.'
              : 'Enter the 6-digit code we sent to your email.'}
          </p>
        </div>

        <div className="space-y-3 bg-card/80 border border-border/60 rounded-lg p-4">
          {step === 'details' ? (
            <>
              <div className="flex items-start gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-200">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Set a password you&apos;ll remember — you&apos;ll use it with your email to log in next time. We&apos;ll send a verification code to your email.</span>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                  Your name (optional)
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Jamie Smith"
                  className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                  Email (required)
                </label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                  Password (min 6 characters)
                </label>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                  Confirm password
                </label>
                <input
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </div>
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full px-3 py-2 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[40px]"
              >
                {submitting ? 'Sending code…' : 'Send verification code'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-200">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Enter the 6-digit code sent to <strong>{email}</strong>. The code expires in 10 minutes.</span>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                  Verification code
                </label>
                <input
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="w-full px-2 py-3 text-center text-2xl tracking-[0.5em] rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  autoFocus
                />
              </div>
              <button
                onClick={submit}
                disabled={submitting || verifyCode.length !== 6}
                className="w-full px-3 py-2 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[40px]"
              >
                {submitting ? 'Verifying…' : 'Verify & claim account'}
              </button>
              <button
                onClick={() => { setStep('details'); setVerifyCode('') }}
                className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to details
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
